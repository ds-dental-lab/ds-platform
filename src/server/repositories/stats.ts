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
// ★ 디자이너는 **배정된 담당자**입니다 (orders.designer_user_id).
//   전에는 '디자인 단계로 옮긴 사람' 을 이력에서 캐냈습니다. 배정 기능이
//   생긴 뒤에도 그대로 두면, 담당을 넘겨받아 실제로 끝낸 사람 대신
//   **처음 눌렀던 사람에게 일량이 쌓입니다.** 그건 통계가 아니라 오해입니다.
//   '언제 잡았고 언제 넘겼나' 는 여전히 이력이 답합니다.
//
// ★ 리메이크는 **원주문을 디자인한 사람**에게 답니다.
//   리메이크 주문 자체를 누가 잡았는지가 아니라, 다시 만들게 된 그 건을
//   누가 했는지가 알고 싶은 것입니다 (parent_order_id 로 거슬러 갑니다).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { itemAmount } from '@/server/domain/billing';
import { resolvePartyPrice } from '@/server/domain/pricing';
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

  /*
    ★ 누구의 일인가는 주문이 답합니다.
      이력에는 '그때 누른 사람' 만 있습니다. 담당을 넘겨받아 끝낸 사람이
      있어도 이력은 처음 누른 사람을 가리킵니다.

      기간 밖에 접수됐지만 기간 안에 디자인을 잡은 건도 있어서,
      위에서 읽은 orders 만으로는 모자랍니다. 필요한 id 를 모아
      한 번 더 물어봅니다.
  */
  const parentIds = orders
    .filter((o) => o.is_remake && o.parent_order_id)
    .map((o) => o.parent_order_id as string);

  const needDesigner = [...new Set([...picked.keys(), ...parentIds])];
  const designerOf = new Map<string, string>();

  if (needDesigner.length > 0) {
    const { data } = await supabase
      .from('orders')
      .select('id, designer_user_id')
      .in('id', needDesigner);

    for (const row of (data ?? []) as { id: string; designer_user_id: string | null }[]) {
      if (row.designer_user_id) designerOf.set(row.id, row.designer_user_id);
    }
  }

  const tally = new Map<string, DesignerTally & { spans: number[] }>();

  const seat = (userId: string) => {
    const found = tally.get(userId) ?? {
      userId,
      name: '',
      picked: 0,
      handed: 0,
      remade: 0,
      amount: 0,
      amountUnpriced: false,
      avgDays: null,
      spans: [] as number[],
    };
    tally.set(userId, found);

    return found;
  };

  for (const [orderId, row] of picked) {
    const who = designerOf.get(orderId);
    if (!who) continue;

    const seatRow = seat(who);
    seatRow.picked += 1;

    const done = handed.get(orderId);
    if (done && done.created_at >= row.created_at) {
      seatRow.handed += 1;
      seatRow.spans.push(daysBetween(row.created_at, done.created_at));
    }
  }

  // 리메이크는 원주문을 디자인한 사람에게 답니다
  for (const parentId of parentIds) {
    const who = designerOf.get(parentId);
    if (who) seat(who).remade += 1;
  }

  /*
    ★ 완성 금액 — 그 기간에 **배송된** 건의 치과 판매가 (2026-08-13).

      접수된 건(orders)이 아니라 나간 건을 다시 읽습니다. 접수와 배송은
      달이 다릅니다 — 7월에 받아 8월에 나간 건은 8월 능률입니다.

    ★ 이 화면은 관리자만 봅니다 (requireManagerSector).
      디자이너에게는 금액이 아예 안 보이는 것이 이 프로젝트의 규칙이라,
      여기 숫자가 디자이너 화면으로 새 나갈 길이 없어야 합니다.
  */
  await addShippedAmounts(supabase, from, to, designerOf, seat);

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

/**
 * 기간 안에 배송된 건의 **치과 판매가**를 담당 디자이너에게 더합니다.
 * (사용자 결정 2026-08-13 — "완성한 금액으로 능률을 측정")
 *
 * ★ 값은 정산과 같은 방법으로 셉니다.
 *   제품 기본가에 치과별 단가가 있으면 그것이 이깁니다
 *   (resolvePartyPrice). 정산과 다른 셈을 쓰면 "통계는 이런데 청구서는
 *   저렇다" 가 생깁니다.
 *
 * ★ 조정(billing_adjustments)은 안 더합니다.
 *   깎아 준 것은 디자인센터의 결정이라 담당자 능률과 무관합니다.
 *
 * ★ 리메이크·리페어는 애초에 빠집니다 (is_billable = false).
 */
async function addShippedAmounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string,
  designerOf: Map<string, string>,
  seat: (userId: string) => DesignerTally & { spans: number[] },
): Promise<void> {
  const { data: shipped } = await supabase
    .from('orders')
    .select(
      'id, clinic_org_id, designer_user_id, ' +
        'order_items(type_code, material_code, is_pontic, has_gingival)',
    )
    .is('deleted_at', null)
    .eq('is_billable', true)
    .not('shipped_at', 'is', null)
    .not('designer_user_id', 'is', null)
    .gte('shipped_at', `${from}T00:00:00`)
    .lte('shipped_at', `${to}T23:59:59`);

  const rows = (shipped ?? []) as unknown as {
    id: string;
    clinic_org_id: string;
    designer_user_id: string;
    order_items:
      | { type_code: string; material_code: string; is_pontic: boolean; has_gingival: boolean }[]
      | null;
  }[];

  if (rows.length === 0) return;

  // ---------- 단가표 ----------
  const [baseRes, overrideRes] = await Promise.all([
    supabase
      .from('prosthesis_materials')
      .select('id, code, price, pontic_price, pink_price, prosthesis_types!inner(code)'),
    supabase
      .from('clinic_product_prices')
      .select('material_id, clinic_org_id, price, pontic_price, pink_price'),
  ]);

  type Base = {
    id: string;
    code: string;
    price: number | null;
    pontic_price: number | null;
    pink_price: number | null;
    prosthesis_types: { code: string } | null;
  };

  /** '종류/재료' → 기본가 */
  const baseOf = new Map<string, Base>();
  for (const row of (baseRes.data ?? []) as unknown as Base[]) {
    const typeCode = row.prosthesis_types?.code;
    if (typeCode) baseOf.set(`${typeCode}/${row.code}`, row);
  }

  /** '치과|재료id' → 치과별 단가 */
  type Over = {
    material_id: string;
    clinic_org_id: string;
    price: number | null;
    pontic_price: number | null;
    pink_price: number | null;
  };
  const overOf = new Map<string, Over>();
  for (const row of (overRes(overrideRes) ?? []) as Over[]) {
    overOf.set(`${row.clinic_org_id}|${row.material_id}`, row);
  }

  // ---------- 더하기 ----------
  for (const order of rows) {
    const who = order.designer_user_id ?? designerOf.get(order.id);
    if (!who) continue;

    const target = seat(who);

    for (const item of order.order_items ?? []) {
      const base = baseOf.get(`${item.type_code}/${item.material_code}`);
      const over = base ? overOf.get(`${order.clinic_org_id}|${base.id}`) : undefined;

      const money = itemAmount({
        isPontic: item.is_pontic,
        hasGingival: item.has_gingival,
        price: resolvePartyPrice(base?.price ?? null, over?.price ?? null, 'clinic'),
        ponticPrice: resolvePartyPrice(
          base?.pontic_price ?? null,
          over?.pontic_price ?? null,
          'clinic',
        ),
        pinkPrice: resolvePartyPrice(
          base?.pink_price ?? null,
          over?.pink_price ?? null,
          'clinic',
        ),
      });

      target.amount += money.amount;
      target.amountUnpriced = target.amountUnpriced || money.unpriced;
    }
  }
}

/** supabase 응답에서 data 만 꺼냅니다 (타입을 좁히려고 따로 뺐습니다) */
function overRes<T>(res: { data: T[] | null }): T[] | null {
  return res.data;
}
