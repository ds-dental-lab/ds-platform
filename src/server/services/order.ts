// =========================================================
// 놓을 위치: src/server/services/order.ts
//
// 주문 저장. (설계서 §5.2 서비스 계층)
//
// ★ 화면에서 온 데이터를 그대로 믿지 않습니다.
//   브라우저는 조작할 수 있으므로 저장 직전에 도메인 규칙으로 다시 검사합니다.
//   (설계서 §5.3 결정 2 — 2중 검사)
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isValidTooth } from '@/server/domain/tooth';
import {
  isValidCombination,
  requiresImplantModel,
  allowsGingival,
  type ProsthesisCatalog,
} from '@/server/domain/prosthesis';
import { isAllowedPair, MAX_PER_TOOTH, type Placement } from '@/server/domain/duplicate';
import { computeBridges, type ToothPlacement } from '@/server/domain/bridge';
import { isValidShade } from '@/server/domain/shade';
import { checkDueDate, type DueDatePolicy } from '@/server/domain/due-date';
import { canEditSpec, type OrderStatus } from '@/server/domain/order-status';
import { todayInKst } from '@/server/domain/week';
import { publishOrderCreated } from '@/server/events';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';

// ---------- 입력 모양 ----------

export interface OrderItemInput {
  tooth: number;
  typeCode: string;
  materialCode: string;
  isPontic?: boolean;
  shadeSystem?: string | null;
  shadeCervical?: string | null;
  shadeIncisal?: string | null;
  implantManufacturer?: string | null;
  implantType?: string | null;
  implantSize?: string | null;
  implantScrew?: string | null;
  implantOption?: string | null;
  /** 치은포셀린. 추가 과금 항목입니다 */
  hasGingival?: boolean;
}

export interface CreateOrderInput {
  /**
   * 어느 치과의 주문인가. 디자인센터 주문등록에서 고릅니다.
   *
   * ★ 치과 계정이 보낸 값은 **무시합니다**.
   *   치과가 이 칸에 남의 치과 id 를 넣어 주문을 떠넘기지 못하게,
   *   치과일 때는 언제나 자기 소속으로 덮어씁니다.
   */
  clinicOrgId?: string | null;
  patientId?: string | null;
  patientLabel: string;
  orderType?: 'modelless' | 'analog' | 'with_model' | 'model_only' | 'repair';
  dueDate: string;          // YYYY-MM-DD
  notes?: string;
  items: OrderItemInput[];
  severedKeys?: string[];   // 사용자가 끊어 둔 브릿지 연결
  /** 제작옵션 — { 그룹id: 값id } (명세서 §4.2.8) */
  options?: Record<string, string>;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string };

// ---------- 검증 ----------

/**
 * 저장해도 되는 주문인지 확인합니다.
 * 문제가 있으면 첫 번째 이유를 돌려줍니다.
 */
export function validateOrder(
  input: CreateOrderInput,
  /**
   * 제품 목록. 반드시 줍니다.
   *
   * ★ 없으면 건너뛰게 두지 않습니다.
   *   빠뜨렸을 때 조용히 통과하면, 없는 재료가 주문서에 박혀도
   *   아무도 모릅니다. 인자를 빼먹으면 타입이 먼저 막아야 합니다.
   */
  catalog: ProsthesisCatalog,
  today?: string,
  /**
   * 요청시한 규칙. 디자인센터는 오늘부터입니다.
   * ★ 화면이 보낸 값이 아니라 **누가 로그인했는지**로 정합니다 —
   *   치과가 'free' 를 보내 최소 납기를 건너뛸 수 없어야 합니다.
   */
  dueDatePolicy: DueDatePolicy = 'standard',
): string | null {
  if (!input.patientLabel?.trim()) return '환자를 선택해 주세요';
  if (!input.dueDate) return '요청시한을 입력해 주세요';

  // ★ 화면에서 달력을 막아 둔 것만으로는 부족합니다 (설계서 §5.3 결정 2)
  if (today) {
    const verdict = checkDueDate(input.dueDate, today, dueDatePolicy);
    if (!verdict.selectable) return verdict.reason ?? '고를 수 없는 요청시한입니다';
  }
  if (input.items.length === 0) return '보철물을 하나 이상 선택해 주세요';

  const seen = new Map<number, Placement[]>();

  for (const item of input.items) {
    // 실제 있는 치아인가
    if (!isValidTooth(item.tooth)) {
      return `${item.tooth} 는 존재하지 않는 치식 번호입니다`;
    }

    // 종류에 그 재료를 붙일 수 있는가
    if (!isValidCombination(catalog, item.typeCode, item.materialCode)) {
      return `${item.tooth}번 — 선택한 종류와 재료가 맞지 않습니다`;
    }

    // 인레이 폰틱은 현실에 없습니다
    if (item.isPontic && item.typeCode === 'inlay') {
      return `${item.tooth}번 — 인레이는 폰틱이 될 수 없습니다`;
    }

    // 인레이는 잇몸에 닿는 부위가 없어 치은포셀린이 붙지 않습니다
    if (item.hasGingival && !allowsGingival(catalog, item.typeCode, item.materialCode)) {
      return `${item.tooth}번 — 이 제품에는 핑크 포셀린을 붙일 수 없습니다`;
    }

    // 임플란트는 모델이 필요합니다
    if (requiresImplantModel(catalog, item.typeCode) && !item.isPontic) {
      if (!item.implantManufacturer || !item.implantType) {
        return `${item.tooth}번 — 임플란트 제조사와 타입을 선택해 주세요`;
      }
    }

    // 쉐이드가 그 체계에 있는 값인가
    if (item.shadeSystem) {
      for (const shade of [item.shadeCervical, item.shadeIncisal]) {
        if (shade && !isValidShade(item.shadeSystem, shade)) {
          return `${item.tooth}번 — ${shade} 는 선택한 쉐이드 체계에 없습니다`;
        }
      }
    }

    // 한 치아에 몇 개까지, 어떤 조합인가
    const placement: Placement = {
      typeCode: item.typeCode,
      materialCode: item.materialCode,
    };
    const existing = seen.get(item.tooth) ?? [];

    if (existing.length >= MAX_PER_TOOTH) {
      return `${item.tooth}번 — 한 치아에는 최대 ${MAX_PER_TOOTH}개까지입니다`;
    }

    if (existing.length === 1 && !isAllowedPair(existing[0], placement)) {
      return `${item.tooth}번 — 함께 등록할 수 없는 조합입니다`;
    }

    if (existing.some((p) => p.typeCode === placement.typeCode && p.materialCode === placement.materialCode)) {
      return `${item.tooth}번 — 같은 보철이 두 번 들어 있습니다`;
    }

    seen.set(item.tooth, [...existing, placement]);
  }

  return null;
}

// ---------- 저장 ----------

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = await createClient();

  // 내가 누구인지, 어느 치과 소속인지
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id, organizations(org_type)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  const org = membership?.organizations as { org_type: string } | undefined;
  if (!membership || (org?.org_type !== 'clinic' && org?.org_type !== 'design_center')) {
    return { ok: false, error: '치과 또는 디자인센터만 주문을 등록할 수 있습니다' };
  }

  // ★ 검증을 로그인 확인 뒤로 옮겼습니다.
  //   요청시한 규칙이 '누가 넣는가' 에 따라 다릅니다 —
  //   디자인센터는 오늘부터 고를 수 있습니다.
  //   화면이 보낸 값이 아니라 세션으로 정해야 치과가 우회하지 못합니다.
  const catalog = await getProsthesisCatalog({ includeInactive: true });
  const problem = validateOrder(
    input,
    catalog,
    todayInKst(),
    org.org_type === 'design_center' ? 'free' : 'standard',
  );
  if (problem) return { ok: false, error: problem };

  const owners = await resolveOwners(supabase, membership.org_id, org.org_type, input);
  if ('error' in owners) return { ok: false, error: owners.error };

  // 주문번호 발급
  const { data: orderNo, error: noError } = await supabase.rpc('next_order_no');
  if (noError || !orderNo) {
    return { ok: false, error: '주문번호를 만들지 못했습니다' };
  }

  // ★ 환자 표시값은 화면이 보낸 문자열을 쓰지 않고 DB 에서 다시 만듭니다.
  //   실명과 마스킹 값이 어긋나면 기공소에 실명이 새기 때문입니다. (설계서 §8.5)
  const labels = await buildPatientLabels(supabase, input, owners.clinicOrgId);
  if (!labels) return { ok: false, error: '환자를 찾을 수 없습니다' };

  // 주문 만들기
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_no: orderNo,
      clinic_org_id: owners.clinicOrgId,
      design_org_id: owners.designOrgId,
      patient_id: input.patientId ?? null,
      patient_label: labels.plain,
      patient_label_masked: labels.masked,
      order_type: input.orderType ?? 'modelless',
      status: 'received',
      due_date: input.dueDate,
      notes: input.notes ?? null,
      created_by: user.id,
      received_at: new Date().toISOString(),
    })
    .select('id, order_no')
    .single();

  if (orderError || !order) {
    return { ok: false, error: `주문 저장에 실패했습니다: ${orderError?.message}` };
  }

  // 항목 만들기 — 같은 치아의 두 번째는 slot 2
  const slotCount = new Map<number, number>();

  const rows = input.items.map((item) => {
    const slot = (slotCount.get(item.tooth) ?? 0) + 1;
    slotCount.set(item.tooth, slot);

    return {
      order_id: order.id,
      tooth_number: item.tooth,
      slot,
      type_code: item.typeCode,
      material_code: item.materialCode,
      is_pontic: item.isPontic ?? false,
      shade_system: item.shadeSystem ?? null,
      shade_cervical: item.shadeCervical ?? null,
      shade_incisal: item.shadeIncisal ?? null,
      implant_manufacturer: item.implantManufacturer ?? null,
      implant_type: item.implantType ?? null,
      implant_size: item.implantSize ?? null,
      implant_screw: item.implantScrew ?? null,
      implant_option: item.implantOption ?? null,
      has_gingival: item.hasGingival ?? false,
    };
  });

  const { data: savedItems, error: itemError } = await supabase
    .from('order_items')
    .insert(rows)
    .select('id, tooth_number, slot, type_code, material_code, is_pontic');

  if (itemError || !savedItems) {
    // 주문만 남으면 안 되므로 되돌립니다
    await supabase.from('orders').delete().eq('id', order.id);
    return { ok: false, error: `보철물 저장에 실패했습니다: ${itemError?.message}` };
  }

  // 브릿지 묶음 저장
  await saveBridges(supabase, order.id, savedItems, input);

  // 제작옵션 저장 (명세서 §4.2.8)
  const optionRows = Object.entries(input.options ?? {}).map(([groupId, valueId]) => ({
    order_id: order.id,
    option_group_id: groupId,
    option_value_id: valueId,
  }));

  if (optionRows.length > 0) {
    await supabase.from('order_options').insert(optionRows);
  }

  // 디자인센터에 접수 알림 (설계서 Q-7 ①)
  await publishOrderCreated({
    orderId: order.id,
    actorOrgId: membership.org_id,
    actorUserId: user.id,
  });

  return { ok: true, orderId: order.id, orderNo: order.order_no };
}

/**
 * 목록에 찍을 환자 표시값 두 벌을 만듭니다.
 *   plain  — 치과 · 디자인센터가 봅니다 (실명)
 *   masked — 기공소가 봅니다 (김*수)
 *
 * 환자를 고르지 않은 주문은 기공소에 알려줄 것이 없으므로 비공개로 둡니다.
 */
/**
 * 이 주문이 어느 치과의 것이고 어느 디자인센터가 맡는가.
 *
 * ★ 치과가 보낸 clinicOrgId 는 버립니다.
 *   그대로 믿으면 치과 A 가 치과 B 이름으로 주문을 넣어
 *   남의 정산에 금액을 얹을 수 있습니다.
 *
 * ★ 디자인센터는 자기 거래처만, 그것도 거래중인 곳만 됩니다.
 *   RLS 가 한 번 더 막지만(order_insert), 거기서 걸리면 사용자에게
 *   "저장 실패" 만 보입니다. 여기서 걸러야 이유를 말해 줄 수 있습니다.
 */
async function resolveOwners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  myOrgId: string,
  myOrgType: string,
  input: CreateOrderInput,
): Promise<{ clinicOrgId: string; designOrgId: string } | { error: string }> {
  if (myOrgType === 'design_center') {
    const target = input.clinicOrgId;
    if (!target) return { error: '어느 치과의 주문인지 골라 주세요' };

    const { data: clinic } = await supabase
      .from('organizations')
      .select('id, status, org_type')
      .eq('id', target)
      .is('deleted_at', null)
      .maybeSingle();

    const found = clinic as { status: string; org_type: string } | null;

    // RLS 는 남의 치과를 0행으로 막습니다 — 오류가 아니라 '없음' 으로 옵니다
    if (!found || found.org_type !== 'clinic') {
      return { error: '거래처 치과가 아닙니다' };
    }
    if (found.status !== 'active') {
      return { error: '거래중지된 치과에는 새 주문을 넣을 수 없습니다' };
    }

    const { data: partnership } = await supabase
      .from('partnerships')
      .select('id')
      .eq('from_org_id', target)
      .eq('to_org_id', myOrgId)
      .eq('relation', 'clinic_design')
      .eq('status', 'active')
      .maybeSingle();

    if (!partnership) return { error: '이 치과와 거래 관계가 없습니다' };

    return { clinicOrgId: target, designOrgId: myOrgId };
  }

  // 치과 계정 — 언제나 자기 소속입니다
  const { data: partnership } = await supabase
    .from('partnerships')
    .select('to_org_id')
    .eq('from_org_id', myOrgId)
    .eq('relation', 'clinic_design')
    .eq('status', 'active')
    .maybeSingle();

  if (!partnership) return { error: '연결된 디자인센터가 없습니다' };

  return {
    clinicOrgId: myOrgId,
    designOrgId: (partnership as { to_org_id: string }).to_org_id,
  };
}

async function buildPatientLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: CreateOrderInput,
  clinicOrgId: string,
): Promise<{ plain: string; masked: string } | null> {
  if (!input.patientId) {
    return { plain: input.patientLabel.trim(), masked: '(비공개)' };
  }

  // ★ 그 치과의 환자여야 합니다.
  //   디자인센터는 모든 거래처 치과의 환자를 읽을 수 있어(patient_select),
  //   그대로 두면 남의 치과 환자가 붙을 수 있습니다.
  const { data: patient } = await supabase
    .from('patients')
    .select('name, name_masked, chart_no')
    .eq('id', input.patientId)
    .eq('clinic_org_id', clinicOrgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!patient) return null;

  return {
    plain: `${patient.name} (${patient.chart_no})`,
    masked: `${patient.name_masked} (${patient.chart_no})`,
  };
}

/**
 * 브릿지는 화면에서 받지 않고 규칙으로 다시 계산합니다.
 * 화면과 저장 결과가 어긋날 수 없게 하려는 것입니다.
 */
async function saveBridges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  savedItems: Array<{
    id: string;
    tooth_number: number;
    slot: number;
    type_code: string;
    material_code: string;
    is_pontic: boolean;
  }>,
  input: CreateOrderInput,
): Promise<void> {
  const placements: ToothPlacement[] = savedItems.map((row) => ({
    tooth: row.tooth_number,
    typeCode: row.type_code,
    materialCode: row.material_code,
    isPontic: row.is_pontic,
  }));

  const bridges = computeBridges(placements, input.severedKeys ?? []);

  for (const bridge of bridges) {
    const { data: saved } = await supabase
      .from('order_bridges')
      .insert({ order_id: orderId, created_by_rule: true })
      .select('id')
      .single();

    if (!saved) continue;

    const memberIds = savedItems
      .filter(
        (row) =>
          row.type_code === bridge.typeCode &&
          row.material_code === bridge.materialCode &&
          bridge.teeth.includes(row.tooth_number),
      )
      .map((row) => ({ bridge_id: saved.id, order_item_id: row.id }));

    if (memberIds.length > 0) {
      await supabase.from('order_bridge_members').insert(memberIds);
    }
  }
}

// ---------- 수정 ----------

export interface UpdateOrderInput extends CreateOrderInput {
  orderId: string;
}

export type UpdateOrderResult = { ok: true } | { ok: false; error: string };

/**
 * 주문 사양을 고칩니다. (설계서 §2.1 C-4 — 2026-08-11 확정 A안)
 *
 * ★ 접수 상태에서만 됩니다.
 *   재스캔에서는 파일만 바꿉니다 — 디자인센터가 요청한 것은 파일이지
 *   사양이 아닌데, 몰래 사양이 바뀌면 그대로 잘못 만듭니다.
 *   화면에서도 막지만 여기서 다시 봅니다 (설계서 §5.3 결정 2).
 *
 * ★ 항목은 고치지 않고 지웠다 다시 넣습니다.
 *   치아 하나를 빼고 둘을 더하는 식의 변경을 일일이 맞춰 넣으려면
 *   slot 번호와 브릿지 묶음이 어긋나기 쉽습니다. 통째로 다시 만들면
 *   저장 결과가 늘 화면과 같습니다.
 */
export async function updateOrder(input: UpdateOrderInput): Promise<UpdateOrderResult> {
  const catalog = await getProsthesisCatalog({ includeInactive: true });
  const problem = validateOrder(input, catalog, todayInKst());
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };

  // RLS 가 관련 조직만 읽게 해 줍니다 — 여기서는 상태만 다시 봅니다
  const { data: current } = await supabase
    .from('orders')
    .select('status, patient_id, clinic_org_id')
    .eq('id', input.orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!current) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const status = current.status as OrderStatus;
  if (!canEditSpec(status)) {
    return {
      ok: false,
      error:
        status === 'rescan'
          ? '재스캔 상태에서는 파일만 바꿀 수 있습니다. 사양을 바꾸려면 주문을 취소하고 새로 넣어 주세요'
          : '이미 작업이 시작되어 고칠 수 없습니다',
    };
  }

  // 환자 표시값은 화면 문자열을 믿지 않고 DB 에서 다시 만듭니다.
  // 치과는 옮길 수 없으므로 원래 주문의 치과로 환자를 좁힙니다
  const labels = await buildPatientLabels(supabase, input, current.clinic_org_id as string);
  if (!labels) return { ok: false, error: '환자를 찾을 수 없습니다' };

  const { error: headError } = await supabase
    .from('orders')
    .update({
      patient_id: input.patientId ?? null,
      patient_label: labels.plain,
      patient_label_masked: labels.masked,
      order_type: input.orderType ?? 'modelless',
      due_date: input.dueDate,
      notes: input.notes ?? null,
    })
    .eq('id', input.orderId);

  if (headError) {
    return { ok: false, error: `저장하지 못했습니다: ${headError.message}` };
  }

  // ★ 항목·브릿지·옵션을 통째로 갈아끼웁니다.
  //   order_bridges 는 order_id 로 매달려 있어 지우면 멤버도 따라 지워집니다.
  await supabase.from('order_bridges').delete().eq('order_id', input.orderId);
  await supabase.from('order_items').delete().eq('order_id', input.orderId);
  await supabase.from('order_options').delete().eq('order_id', input.orderId);

  const slotCount = new Map<number, number>();

  const rows = input.items.map((item) => {
    const slot = (slotCount.get(item.tooth) ?? 0) + 1;
    slotCount.set(item.tooth, slot);

    return {
      order_id: input.orderId,
      tooth_number: item.tooth,
      slot,
      type_code: item.typeCode,
      material_code: item.materialCode,
      is_pontic: item.isPontic ?? false,
      shade_system: item.shadeSystem ?? null,
      shade_cervical: item.shadeCervical ?? null,
      shade_incisal: item.shadeIncisal ?? null,
      implant_manufacturer: item.implantManufacturer ?? null,
      implant_type: item.implantType ?? null,
      implant_size: item.implantSize ?? null,
      implant_screw: item.implantScrew ?? null,
      implant_option: item.implantOption ?? null,
      has_gingival: item.hasGingival ?? false,
    };
  });

  const { data: savedItems, error: itemError } = await supabase
    .from('order_items')
    .insert(rows)
    .select('id, tooth_number, slot, type_code, material_code, is_pontic');

  if (itemError || !savedItems) {
    return { ok: false, error: `보철물 저장에 실패했습니다: ${itemError?.message}` };
  }

  await saveBridges(supabase, input.orderId, savedItems, input);

  const optionRows = Object.entries(input.options ?? {}).map(([groupId, valueId]) => ({
    order_id: input.orderId,
    option_group_id: groupId,
    option_value_id: valueId,
  }));

  if (optionRows.length > 0) {
    await supabase.from('order_options').insert(optionRows);
  }

  return { ok: true };
}
