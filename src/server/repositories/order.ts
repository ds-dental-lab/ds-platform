// =========================================================
// 놓을 위치: src/server/repositories/order.ts
//
// 주문을 읽어오는 곳. (설계서 §6 repositories)
// RLS 가 걸려 있어 자기 조직 주문만 돌아옵니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import type { OrderStatus, Sector } from '@/server/domain/order-status';

/**
 * 환자 이름을 어느 컬럼에서 읽을지 정합니다. (설계서 §8.5)
 *
 * ★ 기공소에게는 마스킹 컬럼만 씁니다. 실명 컬럼은 select 에도 filter 에도
 *   들어가지 않습니다. 읽기만 막고 검색을 열어 두면, 이름을 넣어 보며
 *   맞는지 확인하는 식으로 실명을 알아낼 수 있기 때문입니다.
 *
 *   호출하는 쪽이 깜빡해도 새지 않도록 판정을 여기 한 곳에 둡니다.
 */
async function patientLabelColumn(): Promise<'patient_label' | 'patient_label_masked'> {
  const session = await getSession();
  return session?.orgType === 'lab' ? 'patient_label_masked' : 'patient_label';
}

export interface OrderListRow {
  id: string;
  order_no: string;
  patient_label: string;
  status: OrderStatus;
  order_type: string;
  due_date: string;
  created_at: string;
  item_count: number;
  file_count: number;
  /** 의뢰 치과 이름. 디자인센터는 여러 치과 주문이 섞여 보이므로 필요합니다 */
  clinic_name: string;
}

export interface OrderListFilter {
  status?: OrderStatus | 'all';
  keyword?: string;
  limit?: number;
}

/** Supabase 의 중첩 select 결과. 조인한 쪽은 배열이거나 null 로 옵니다 */
interface RawListRow {
  id: string;
  order_no: string;
  patient_label: string;
  status: OrderStatus;
  order_type: string;
  due_date: string;
  created_at: string;
  order_items: { count: number }[] | null;
  order_files: { count: number }[] | null;
  clinic: { name: string } | null;
}

/** 목록. 최신순으로 돌려줍니다. RLS가 내 조직이 관련된 주문만 골라줍니다 */
export async function listOrders(filter: OrderListFilter = {}): Promise<OrderListRow[]> {
  const supabase = await createClient();
  const labelColumn = await patientLabelColumn();

  let query = supabase
    .from('orders')
    .select(
      `id, order_no, patient_label:${labelColumn}, status, order_type, due_date, created_at, ` +
        'order_items(count), order_files(count), ' +
        'clinic:organizations!orders_clinic_org_id_fkey(name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 50);

  if (filter.status && filter.status !== 'all') {
    query = query.eq('status', filter.status);
  }

  if (filter.keyword?.trim()) {
    const k = filter.keyword.trim();
    query = query.or(`order_no.ilike.%${k}%,${labelColumn}.ilike.%${k}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as RawListRow[]).map((row) => ({
    id: row.id,
    order_no: row.order_no,
    patient_label: row.patient_label,
    status: row.status,
    order_type: row.order_type,
    due_date: row.due_date,
    created_at: row.created_at,
    item_count: row.order_items?.[0]?.count ?? 0,
    file_count: row.order_files?.[0]?.count ?? 0,
    clinic_name: row.clinic?.name ?? '',
  }));
}

/** 상태별 건수. 필터 탭에 숫자를 붙입니다 */
export async function countByStatus(): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select('status')
    .is('deleted_at', null);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

// ---------- 상세 ----------

export interface OrderDetailItem {
  id: string;
  tooth_number: number;
  slot: number;
  type_code: string;
  material_code: string;
  is_pontic: boolean;
  shade_system: string | null;
  shade_cervical: string | null;
  shade_incisal: string | null;
  implant_manufacturer: string | null;
  implant_type: string | null;
  implant_size: string | null;
  implant_screw: string | null;
  implant_option: string | null;
  has_gingival: boolean;
}

export interface OrderDetailFile {
  id: string;
  kind: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

/** 주문에 딸린 제작옵션 한 줄 — '훅 · 미사용' */
export interface OrderDetailOption {
  groupName: string;
  value: string;
}

export interface OrderDetail {
  id: string;
  order_no: string;
  patient_label: string;
  status: OrderStatus;
  order_type: string;
  due_date: string;
  notes: string | null;
  created_at: string;
  received_at: string | null;
  clinic_name: string;
  /** 자사 제작인가 — 디자인센터가 직접 만드는 건 (통합 조직 모델) */
  in_house: boolean;
  /** 이 주문에서 내가 맡은 자리들. 한 조직이 둘을 겸할 수 있습니다 */
  roles: Sector[];
  items: OrderDetailItem[];
  files: OrderDetailFile[];
  options: OrderDetailOption[];
}

// ---------- 거래 기공소 ----------

export interface PartnerLab {
  id: string;
  name: string;
  /** 자사 제작인가. 디자인센터가 직접 만드는 건입니다 */
  inHouse: boolean;
}

/**
 * 디자인센터가 배정할 수 있는 기공소 목록. (설계서 Q-2)
 *
 * ★ 자기 자신이 맨 앞에 옵니다.
 *   조직 구조가 통합 모델이라 자사 기공소를 따로 두지 않습니다.
 *   디자인센터가 직접 만들면 주문의 lab_org_id 가 자기 자신을 가리키고,
 *   그것이 곧 "자사 제작"입니다. 정산에서 지급 대상에서 빠집니다.
 */
export async function listPartnerLabs(): Promise<PartnerLab[]> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('partnerships')
    .select('lab:organizations!partnerships_to_org_id_fkey(id, name)')
    .eq('from_org_id', session.orgId)
    .eq('relation', 'design_lab')
    .eq('status', 'active');

  const partners = error || !data
    ? []
    : (data as unknown as { lab: Omit<PartnerLab, 'inHouse'> | null }[])
        .map((row) => row.lab)
        .filter((lab): lab is Omit<PartnerLab, 'inHouse'> => lab !== null)
        .map((lab) => ({ ...lab, inHouse: false }));

  return [
    { id: session.orgId, name: '자사 제작', inHouse: true },
    ...partners,
  ];
}

// ---------- 상태 이력 ----------

export interface OrderHistoryRow {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  reason: string | null;
  created_at: string;
  /**
   * 실행한 조직 이름. 볼 권한이 없으면 빈 값입니다.
   * 치과는 기공소와 거래 관계가 없어 기공소 이름이 가려집니다 (설계서 §8.5).
   */
  actor_org_name: string;
}

/** 오래된 것부터. 위에서 아래로 읽으면 주문이 지나온 길이 됩니다 */
export async function listStatusHistory(orderId: string): Promise<OrderHistoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_status_history')
    .select('id, from_status, to_status, reason, created_at, actor:organizations(name)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  type RawHistoryRow = Omit<OrderHistoryRow, 'actor_org_name'> & {
    actor: { name: string } | null;
  };

  return (data as unknown as RawHistoryRow[]).map((row) => ({
    id: row.id,
    from_status: row.from_status,
    to_status: row.to_status,
    reason: row.reason,
    created_at: row.created_at,
    actor_org_name: row.actor?.name ?? '',
  }));
}

/** 상세. 이 조직이 볼 수 없는 주문이면 null 을 돌려줍니다 (RLS 가 걸러줌) */
export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const session = await getSession();

  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_no, patient_label:${await patientLabelColumn()}, ` +
        'status, order_type, due_date, notes, created_at, received_at, ' +
        'clinic_org_id, design_org_id, lab_org_id, ' +
        'clinic:organizations!orders_clinic_org_id_fkey(name), ' +
        'order_items(id, tooth_number, slot, type_code, material_code, is_pontic, shade_system, shade_cervical, shade_incisal, implant_manufacturer, implant_type, implant_size, implant_screw, implant_option, has_gingival), ' +
        'order_files(id, kind, file_name, file_size, mime_type, created_at), ' +
        'order_options(production_option_groups(name, sort_order), production_option_values(value))',
    )
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  type RawDetailRow = Omit<
    OrderDetail,
    'clinic_name' | 'items' | 'files' | 'options' | 'in_house' | 'roles'
  > & {
    clinic_org_id: string;
    design_org_id: string | null;
    lab_org_id: string | null;
    clinic: { name: string } | null;
    order_items: OrderDetailItem[] | null;
    order_files: OrderDetailFile[] | null;
    order_options:
      | {
          production_option_groups: { name: string; sort_order: number } | null;
          production_option_values: { value: string } | null;
        }[]
      | null;
  };

  const row = data as unknown as RawDetailRow;

  return {
    id: row.id,
    order_no: row.order_no,
    patient_label: row.patient_label,
    status: row.status,
    order_type: row.order_type,
    due_date: row.due_date,
    notes: row.notes,
    created_at: row.created_at,
    received_at: row.received_at,
    clinic_name: row.clinic?.name ?? '',
    // 기공소 자리를 디자인센터가 겸하면 자사 제작입니다
    in_house: Boolean(row.lab_org_id && row.lab_org_id === row.design_org_id),
    roles: rolesOf(row, session?.orgId ?? null),
    items: row.order_items ?? [],
    files: row.order_files ?? [],
    // 등록 화면에 놓였던 순서 그대로 보여 줍니다
    options: (row.order_options ?? [])
      .filter((o) => o.production_option_groups && o.production_option_values)
      .sort(
        (a, b) =>
          (a.production_option_groups?.sort_order ?? 0) -
          (b.production_option_groups?.sort_order ?? 0),
      )
      .map((o) => ({
        groupName: o.production_option_groups!.name,
        value: o.production_option_values!.value,
      })),
  };
}

/**
 * 이 주문에서 그 조직이 맡은 자리들.
 *
 * ★ 한 조직이 둘을 겸할 수 있습니다.
 *   자사 제작이면 디자인센터가 design_center 이면서 동시에 lab 입니다.
 *   화면은 이 값으로 어떤 버튼을 보여줄지 정합니다.
 */
function rolesOf(
  row: { clinic_org_id: string; design_org_id: string | null; lab_org_id: string | null },
  orgId: string | null,
): Sector[] {
  if (!orgId) return [];

  const roles: Sector[] = [];
  if (row.clinic_org_id === orgId) roles.push('clinic');
  if (row.design_org_id === orgId) roles.push('design_center');
  if (row.lab_org_id === orgId) roles.push('lab');

  return roles;
}

// ---------- 거래 치과 ----------

export interface PartnerClinic {
  id: string;
  name: string;
}

/**
 * 디자인센터가 담당하는 치과 목록.
 * partnerships 는 치과 → 디자인센터 방향이므로 to_org_id 로 찾습니다.
 */
export async function listPartnerClinics(): Promise<PartnerClinic[]> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('partnerships')
    .select('clinic:organizations!partnerships_from_org_id_fkey(id, name)')
    .eq('to_org_id', session.orgId)
    .eq('relation', 'clinic_design')
    .eq('status', 'active');

  if (error || !data) return [];

  return (data as unknown as { clinic: PartnerClinic | null }[])
    .map((row) => row.clinic)
    .filter((clinic): clinic is PartnerClinic => clinic !== null);
}

// ---------- 배송 보드 ----------

/**
 * 요청시한이 이 기간에 걸린 주문. (설계서 §9 배송조회)
 *
 * 배송조회는 별도 표가 아니라 **요청시한 기준 달력**입니다 (§1.2).
 * orders.due_date 가 곧 배송 기준일이라 여기서 바로 읽습니다.
 * 실제 송장·택배사는 Q-5 가 확정되면 deliveries 로 옮깁니다.
 *
 * RLS 가 섹터별로 걸러 주므로 치과는 자기 것만, 디자인센터는 거래 치과 전부,
 * 기공소는 배정받은 것만 보입니다.
 */
export async function listOrdersByDueDate(
  from: string,
  to: string,
): Promise<OrderListRow[]> {
  const supabase = await createClient();
  const labelColumn = await patientLabelColumn();

  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_no, patient_label:${labelColumn}, status, order_type, due_date, created_at, ` +
        'order_items(count), order_files(count), ' +
        'clinic:organizations!orders_clinic_org_id_fkey(name)',
    )
    .is('deleted_at', null)
    .gte('due_date', from)
    .lte('due_date', to)
    .order('due_date');

  if (error || !data) return [];

  return (data as unknown as RawListRow[]).map((row) => ({
    id: row.id,
    order_no: row.order_no,
    patient_label: row.patient_label,
    status: row.status,
    order_type: row.order_type,
    due_date: row.due_date,
    created_at: row.created_at,
    item_count: row.order_items?.[0]?.count ?? 0,
    file_count: row.order_files?.[0]?.count ?? 0,
    clinic_name: row.clinic?.name ?? '',
  }));
}
