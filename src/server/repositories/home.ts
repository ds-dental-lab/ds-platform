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

/** 디자인센터가 지금 손대야 하는 주문 한 줄 */
export interface HomeWork {
  id: string;
  clinicName: string;
  patientLabel: string;
  dueDate: string;
  status: OrderStatus;
}

/**
 * 디자인센터의 '작업' 은 어디까지인가.
 *
 * ★ 제작대기부터는 기공소의 일입니다.
 *   넘긴 뒤에도 목록에 남아 있으면 "아직 할 일이 열두 건" 으로 보여,
 *   정작 손대야 할 두 건이 묻힙니다.
 *
 * ★ 재스캔이 맨 앞입니다.
 *   막혀 있는 건이고, 푸는 사람이 디자인센터입니다 (치과에 다시 받아야 함).
 */
const DESIGN_WORK: OrderStatus[] = ['rescan', 'received', 'designing'];

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
}

interface RawRow {
  id: string;
  status: OrderStatus;
  due_date: string;
  patient_label: string;
  clinic: { name: string } | null;
  order_issues: { issue_type: IssueType; resolved_at: string | null }[] | null;
}

/** 완료·취소는 '진행중' 이 아닙니다 */
const DONE: OrderStatus[] = ['completed', 'cancelled'];

export async function getHomeSummary(): Promise<HomeSummary> {
  const supabase = await createClient();
  const today = todayInKst();

  // 금액은 세는 기준이 달라 따로 읽습니다 (접수일/배송일 · 정산기간/달력 월)
  const money = getHomeMoney();

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, status, due_date, patient_label, ' +
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
      });
    }
  }

  /*
    ★ 요청시한이 이른 것부터입니다. 접수순이 아닙니다 —
      어제 들어온 내일 마감 건이, 지난주에 들어온 다음주 건보다 급합니다.
      같은 날이면 재스캔을 위로 올립니다 (막혀 있어 시간이 더 듭니다).
  */
  worklist.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      DESIGN_WORK.indexOf(a.status) - DESIGN_WORK.indexOf(b.status),
  );

  return {
    statusCounts,
    issueCounts,
    todayDeliveries,
    pickups: await listOpenPickups(supabase),
    money: await money,
    worklist,
  };
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
