// =========================================================
// 놓을 위치: src/server/repositories/stats.ts
//
// 관리 통계 (초안). 디자인센터만 봅니다.
//
// ★ 원장(原帳)은 order_status_history 입니다.
//   누가 언제 디자인을 잡았고 언제 넘겼는지가 이미 거기 남아 있습니다.
//   따로 집계표를 만들어 두면 주문이 고쳐질 때마다 어긋납니다 —
//   지금 규모에서는 그때그때 세는 편이 정확하고 충분히 빠릅니다.
//   느려지면 그때 굳히면 됩니다 (마감처럼).
//
// ★ 디자이너는 **디자인 단계로 옮긴 사람**입니다.
//   담당자 칸이 따로 없습니다. 배정 기능이 생기면 그때 갈라도 됩니다.
//
// ★ 리메이크는 **원주문을 디자인한 사람**에게 답니다.
//   리메이크 주문 자체를 누가 잡았는지가 아니라, 다시 만들게 된 그 건을
//   누가 했는지가 알고 싶은 것입니다 (parent_order_id 로 거슬러 갑니다).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  ratePercent,
  sortDesigners,
  sortClinics,
  average,
  type DesignerTally,
  type ClinicTally,
} from '@/server/domain/stats';

export interface DesignStats {
  from: string;
  to: string;

  /** 그 기간에 접수된 주문 */
  orders: number;
  remakes: number;
  repairs: number;
  /** 리메이크 비율(%). 모수가 없으면 null */
  remakeRate: number | null;

  designers: DesignerTally[];
  clinics: ClinicTally[];
}

interface RawOrder {
  id: string;
  clinic_org_id: string;
  is_remake: boolean;
  is_repair: boolean;
  parent_order_id: string | null;
  received_at: string | null;
  clinic: { name: string } | null;
}

interface RawHistory {
  order_id: string;
  to_status: string;
  actor_user_id: string | null;
  created_at: string;
}

export async function getDesignStats(from: string, to: string): Promise<DesignStats> {
  const supabase = await createClient();

  const [orderRes, historyRes] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, clinic_org_id, is_remake, is_repair, parent_order_id, received_at, ' +
          'clinic:organizations!orders_clinic_org_id_fkey(name)',
      )
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .gte('received_at', `${from}T00:00:00`)
      .lte('received_at', `${to}T23:59:59`),

    /*
      ★ 이력은 기간으로 자르지 않습니다.
        기간 안에 접수된 주문의 이력이면, 그 이력이 기간을 조금 넘겨
        찍혔더라도 그 주문의 것입니다. 주문으로 자르고 이력은 따라옵니다.
    */
    supabase
      .from('order_status_history')
      .select('order_id, to_status, actor_user_id, created_at')
      .in('to_status', ['designing', 'production_wait'])
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59.999`)
      .order('created_at'),
  ]);

  const orders = (orderRes.data ?? []) as unknown as RawOrder[];
  const history = (historyRes.data ?? []) as unknown as RawHistory[];

  // ---------- 치과별 ----------
  const byClinic = new Map<string, ClinicTally>();

  for (const order of orders) {
    const found = byClinic.get(order.clinic_org_id) ?? {
      orgId: order.clinic_org_id,
      name: order.clinic?.name ?? '',
      orders: 0,
      remakes: 0,
      repairs: 0,
    };

    found.orders += 1;
    if (order.is_remake) found.remakes += 1;
    if (order.is_repair) found.repairs += 1;

    byClinic.set(order.clinic_org_id, found);
  }

  // ---------- 디자이너별 ----------
  //
  // 잡은 때(designing)와 넘긴 때(production_wait)를 주문별로 짝지어
  // '누가 며칠 걸려 끝냈나' 를 냅니다. 되돌아온 건은 마지막 것만 셉니다.
  const picked = new Map<string, RawHistory>();
  const handed = new Map<string, RawHistory>();

  for (const row of history) {
    // 차례가 오래된 것부터라 나중 것이 앞의 것을 덮습니다
    if (row.to_status === 'designing') picked.set(row.order_id, row);
    else handed.set(row.order_id, row);
  }

  const tally = new Map<string, DesignerTally & { spans: number[] }>();

  const seat = (userId: string) => {
    const found = tally.get(userId) ?? {
      userId,
      name: '',
      picked: 0,
      handed: 0,
      remade: 0,
      avgDays: null,
      spans: [] as number[],
    };
    tally.set(userId, found);

    return found;
  };

  for (const [orderId, row] of picked) {
    if (!row.actor_user_id) continue;

    const seatRow = seat(row.actor_user_id);
    seatRow.picked += 1;

    const done = handed.get(orderId);
    if (done && done.created_at >= row.created_at) {
      seatRow.handed += 1;
      seatRow.spans.push(daysBetween(row.created_at, done.created_at));
    }
  }

  // 리메이크는 원주문을 디자인한 사람에게 답니다
  const parents = orders.filter((o) => o.is_remake && o.parent_order_id);

  if (parents.length > 0) {
    const { data } = await supabase
      .from('order_status_history')
      .select('order_id, actor_user_id, created_at')
      .eq('to_status', 'designing')
      .in('order_id', parents.map((o) => o.parent_order_id as string))
      .order('created_at');

    const parentDesigner = new Map<string, string>();
    for (const row of (data ?? []) as RawHistory[]) {
      if (row.actor_user_id) parentDesigner.set(row.order_id, row.actor_user_id);
    }

    for (const remake of parents) {
      const who = parentDesigner.get(remake.parent_order_id as string);
      if (who) seat(who).remade += 1;
    }
  }

  // ---------- 이름 붙이기 ----------
  const ids = [...tally.keys()];

  if (ids.length > 0) {
    const { data } = await supabase.from('user_profiles').select('id, name').in('id', ids);

    for (const row of (data ?? []) as { id: string; name: string | null }[]) {
      const found = tally.get(row.id);
      if (found) found.name = row.name ?? '';
    }
  }

  const designers = [...tally.values()].map(({ spans, ...rest }) => ({
    ...rest,
    name: rest.name || '이름 없음',
    avgDays: average(spans),
  }));

  const remakes = orders.filter((o) => o.is_remake).length;

  return {
    from,
    to,
    orders: orders.length,
    remakes,
    repairs: orders.filter((o) => o.is_repair).length,
    remakeRate: ratePercent(remakes, orders.length),
    designers: sortDesigners(designers),
    clinics: sortClinics([...byClinic.values()]),
  };
}

/** 두 시각 사이의 날 수 (반올림). 같은 날이면 0 */
function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000));
}
