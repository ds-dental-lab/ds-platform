// =========================================================
// 놓을 위치: src/server/repositories/home.ts
//
// HOME 카드들이 쓰는 숫자. (사용자가 준 화면 — 세 섹터 공통 틀)
//
// ★ 한 번에 다 읽고 화면에서 나눕니다.
//   카드마다 따로 물으면 같은 표를 여러 번 훑습니다. 지금 규모에서는
//   주문을 한 번 긁어 세는 편이 빠르고, 숫자가 서로 어긋날 일도 없습니다.
//
// ★ 누구의 주문인지는 RLS 가 정합니다.
//   치과는 자기 것, 디자인센터는 거래 치과 것, 기공소는 배정받은 것만
//   돌아옵니다. 여기서 조직을 다시 따지지 않습니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { todayInKst } from '@/server/domain/week';
import { getHomeMoney, type HomeMoney } from '@/server/repositories/home-money';
import { getSession } from '@/server/policies/session';
import { canManageMembers, type MemberRole } from '@/server/domain/member';
import { visibleWork, sortWork } from '@/server/domain/worklist';
import { listNotices, type NoticeRow } from '@/server/repositories/notice';
import type { OrderStatus } from '@/server/domain/order-status';
import type { IssueType } from '@/server/domain/order-list';

export interface HomeDelivery {
  id: string;
  patientLabel: string;
  clinicName: string;
  status: OrderStatus;
}

export interface HomePickup {
  id: string;
  clinicName: string;
  dueDate: string;
  memo: string;
}

/** 지금 디자인 중인 주문 한 줄 */
export interface HomeWork {
  id: string;
  clinicName: string;
  patientLabel: string;
  dueDate: string;
  status: OrderStatus;
  /** 디자인을 잡은 사람. 못 찾으면 빈 문자열 */
  designerName: string;
  /** 그 사람의 id — 사용자에게는 자기 것만 보여 주는 데 씁니다 */
  designerId: string | null;
  /** 디자인을 잡은 날 (KST) */
  startedOn: string;
  /** 잡은 날부터 오늘까지 며칠째인가. 오늘 잡았으면 1 */
  dayCount: number;
}

/**
 * 작업 리스트에 오르는 순간은 **디자인을 잡았을 때**입니다.
 * (사용자 결정 2026-08-12 — "디자인 잡았을떄 작업리스트에 리스트업")
 *
 * ★ 접수는 아직 작업이 아닙니다.
 *   들어오기만 하고 아무도 손대지 않은 건까지 세면, 이 목록이
 *   '할 일 더미' 가 됩니다. 누가 잡았는가가 이 목록의 뜻입니다.
 *
 * ★ 끝나지 않은 건은 계속 남습니다 (사용자 결정).
 *   자정에 목록이 새로 서지만 어제 잡고 못 끝낸 건은 그대로 있습니다 —
 *   대신 **며칠째인지**를 함께 보여 줍니다. 그게 없으면 오래 걸리는 건이
 *   새 건들 사이에 섞여 조용히 늙습니다.
 *
 * ★ 제작주문으로 넘기면 빠집니다. 그때부터 기공소의 일입니다.
 */
const DESIGN_WORK: OrderStatus[] = ['designing'];

export interface HomeSummary {
  /** 진행중 상태별 건수. 완료·취소는 세지 않습니다 */
  statusCounts: Record<string, number>;
  /** 진행중 이슈별 건수 — 아직 안 풀린 것만 */
  issueCounts: Record<string, number>;
  /** 오늘 나가야 하는 건 */
  todayDeliveries: HomeDelivery[];
  /** 아직 안 가져간 수거 */
  pickups: HomePickup[];
  /** 왼쪽 위 금액 카드. 세는 기준이 섹터마다 다릅니다 (home-money) */
  money: HomeMoney;
  /** 디자인센터 작업 리스트. 급한 것부터 */
  worklist: HomeWork[];
  /** 오른쪽 위 공지 카드. 고정 먼저, 최근 먼저 */
  notices: NoticeRow[];
}

/** HOME 카드에 몇 줄까지 보일지 */
const HOME_NOTICES = 5;

interface RawRow {
  id: string;
  status: OrderStatus;
  due_date: string;
  patient_label: string;
  designer_user_id: string | null;
  clinic: { name: string } | null;
  order_issues: { issue_type: IssueType; resolved_at: string | null }[] | null;
}

/** 완료·취소는 '진행중' 이 아닙니다 */
const DONE: OrderStatus[] = ['completed', 'cancelled'];

export async function getHomeSummary(): Promise<HomeSummary> {
  const supabase = await createClient();
  const today = todayInKst();

  /*
    ★ 서로 안 쓰는 것은 **동시에** 보냅니다.
      금액·공지·수거는 주문 조회 결과를 하나도 안 씁니다. 그런데
      수거만 맨 아래에서 따로 기다리고 있었습니다 — 왕복 하나를
      줄줄이 세워 둔 셈입니다.
  */
  const money = getHomeMoney();
  const notices = listNotices(HOME_NOTICES);
  const pickups = listOpenPickups(supabase);

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, status, due_date, patient_label, designer_user_id, ' +
        'clinic:organizations!orders_clinic_org_id_fkey(name), ' +
        'order_issues(issue_type, resolved_at)',
    )
    .is('deleted_at', null);

  const rows = error || !data ? [] : (data as unknown as RawRow[]);

  const statusCounts: Record<string, number> = {};
  const issueCounts: Record<string, number> = {};
  const todayDeliveries: HomeDelivery[] = [];
  const worklist: HomeWork[] = [];

  for (const row of rows) {
    if (DONE.includes(row.status)) continue;

    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;

    // ★ 아직 안 풀린 이슈만 셉니다. 지나간 재스캔까지 세면
    //   "지금 손봐야 할 것" 이 아니라 "여태 있었던 일" 이 됩니다.
    for (const issue of row.order_issues ?? []) {
      if (issue.resolved_at) continue;
      issueCounts[issue.issue_type] = (issueCounts[issue.issue_type] ?? 0) + 1;
    }

    if (row.due_date === today) {
      todayDeliveries.push({
        id: row.id,
        patientLabel: row.patient_label,
        clinicName: row.clinic?.name ?? '',
        status: row.status,
      });
    }

    // ★ 조회를 더 하지 않습니다 — 위에서 이미 다 읽어 온 줄들입니다
    if (DESIGN_WORK.includes(row.status)) {
      worklist.push({
        id: row.id,
        clinicName: row.clinic?.name ?? '',
        patientLabel: row.patient_label,
        dueDate: row.due_date,
        status: row.status,
        designerName: '',
        // ★ 이제 이력에서 캐지 않고 배정된 사람을 그대로 씁니다
        designerId: row.designer_user_id,
        startedOn: '',
        dayCount: 1,
      });
    }
  }

  await fillDesignStart(supabase, worklist, today);

  // 누구에게 무엇이 보이고 어떤 차례인지는 domain/worklist 가 정합니다
  const me = await getSession();
  const mine = sortWork(
    visibleWork(worklist, me?.user.id ?? null, canManageMembers(me?.role as MemberRole | null)),
  );

  return {
    statusCounts,
    issueCounts,
    todayDeliveries,
    pickups: await pickups,
    money: await money,
    worklist: mine,
    notices: await notices,
  };
}

/**
 * 디자인을 **언제** 잡았는지와, 맡은 사람의 이름을 채웁니다.
 *
 * ★ '누구' 는 이제 여기서 안 정합니다 (2026-08-12).
 *   전에는 '디자인 단계로 옮긴 사람' 을 이력에서 캐냈습니다. 읽기에는
 *   충분했지만 **막을 수가 없었습니다** — 지나간 일을 뒤에서 읽는 값이라
 *   두 사람이 나란히 눌러도 둘 다 통과했습니다.
 *   이제 orders.designer_user_id 가 사실이고, 여기서는 이름만 붙입니다.
 *
 * ★ 언제는 여전히 이력에서 읽습니다.
 *   배정된 날이 아니라 **디자인을 잡은 날**부터 세야 '며칠째' 가 맞습니다.
 *
 * ★ 되돌렸다 다시 잡으면 **마지막에 잡은 때**입니다.
 *   기공소가 수정을 요청해 디자인으로 되돌아온 건은, 그 시점부터 다시
 *   세는 것이 맞습니다 — 처음 잡은 날부터 세면 며칠째가 부풀어 오릅니다.
 */
async function fillDesignStart(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: HomeWork[],
  today: string,
): Promise<void> {
  if (rows.length === 0) return;

  const { data } = await supabase
    .from('order_status_history')
    .select('order_id, created_at')
    .eq('to_status', 'designing')
    .in('order_id', rows.map((r) => r.id))
    .order('created_at', { ascending: false });

  type Raw = { order_id: string; created_at: string };

  // 차례가 최근 먼저라 처음 만나는 줄이 '마지막에 잡은 때' 입니다
  const latest = new Map<string, Raw>();
  for (const row of (data ?? []) as Raw[]) {
    if (!latest.has(row.order_id)) latest.set(row.order_id, row);
  }

  const userIds = [...new Set(rows.map((r) => r.designerId).filter(Boolean))] as string[];
  const names = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name')
      .in('id', userIds);

    for (const p of (profiles ?? []) as { id: string; name: string | null }[]) {
      if (p.name) names.set(p.id, p.name);
    }
  }

  for (const row of rows) {
    if (row.designerId) row.designerName = names.get(row.designerId) ?? '';

    const hit = latest.get(row.id);
    if (!hit) continue;

    row.startedOn = toKstDate(hit.created_at);
    row.dayCount = daysBetween(row.startedOn, today) + 1;
  }
}

/** UTC 시각을 한국 날짜로. 자정 경계가 여기서 갈립니다 */
function toKstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86400000));
}

/** 아직 안 가져간 수거요청 */
async function listOpenPickups(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<HomePickup[]> {
  const { data } = await supabase
    .from('pickup_requests')
    .select('id, memo, created_at, order:orders(due_date, clinic:organizations!orders_clinic_org_id_fkey(name))')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(10);

  type RawPickup = {
    id: string;
    memo: string | null;
    order: { due_date: string; clinic: { name: string } | null } | null;
  };

  return ((data ?? []) as unknown as RawPickup[]).map((row) => ({
    id: row.id,
    clinicName: row.order?.clinic?.name ?? '',
    dueDate: row.order?.due_date ?? '',
    memo: row.memo ?? '',
  }));
}
