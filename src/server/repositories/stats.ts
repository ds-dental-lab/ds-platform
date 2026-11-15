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
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { itemAmount } from '@/server/domain/billing';
import { resolvePartyPrice } from '@/server/domain/pricing';
import { loadDatedOverrides, priceDay } from '@/server/repositories/price-history';
import {
  ratePercent,
  countUnits,
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
  /** 그 주문들의 **치아 개수** 합 (2026-10-12) */
  teeth: number;
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
  /** 개수를 세려고 같이 읽습니다. 제품마다 1개인지 2개인지 다릅니다 (2026-10-12) */
  order_items: { type_code: string; material_code: string }[] | null;
}

interface RawHistory {
  order_id: string;
  to_status: string;
  actor_user_id: string | null;
  created_at: string;
}

/** 한 번에 받는 줄 수 — Supabase 는 1000줄에서 **말없이** 자릅니다 */
const PAGE = 1000;
/** `.in()` 에 한 번에 넣는 id 수 — 주소가 너무 길어지면 요청이 통째로 실패합니다 */
const ID_CHUNK = 150;

type Paged<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * 끝까지 읽습니다.
 *
 * ★ 못 읽으면 **던집니다** (2026-11-15 자기 점검). 전에는 오류가 나도 빈 목록으로
 *   넘어가 "0건" 이 찍혔습니다 — 틀린 통계는 안 뜨는 통계보다 나쁩니다.
 */
async function readAll<T>(what: string, page: (from: number, to: number) => Paged<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`통계를 읽지 못했습니다 (${what}): ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function getDesignStats(from: string, to: string): Promise<DesignStats> {
  const supabase = await createClient();

  /*
    ★★ 달의 경계는 **한국 시각**입니다 (2026-11-15 자기 점검).
      전에는 시간대를 안 붙여 UTC 로 읽혔습니다 — 1일 00:00~09:00 에 접수된 주문이
      지난달로 가고, 다음 달 1일 아침 것이 이번 달로 왔습니다.
  */
  const start = `${from}T00:00:00+09:00`;
  const end = `${to}T23:59:59.999+09:00`;

  const [orders, history] = await Promise.all([
    readAll<RawOrder>('주문', (a, b) =>
      supabase
        .from('orders')
        .select(
          'id, clinic_org_id, is_remake, is_repair, parent_order_id, received_at, ' +
            // ★ 종류·재료만 받아 옵니다 — 'Abut+크라운' 한 줄은 2개로
            //   세기 때문에 무엇인지 알아야 합니다 (unitCount)
            'order_items(type_code, material_code), ' +
            'clinic:organizations!orders_clinic_org_id_fkey(name)',
        )
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('received_at', start)
        .lte('received_at', end)
        .order('id')
        .range(a, b) as unknown as Paged<RawOrder>,
    ),

    // 그 기간에 **디자인을 잡았거나 넘긴** 기록
    readAll<RawHistory>('이력', (a, b) =>
      supabase
        .from('order_status_history')
        .select('order_id, to_status, actor_user_id, created_at')
        .in('to_status', ['designing', 'production_wait'])
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at')
        .order('order_id')
        .range(a, b) as unknown as Paged<RawHistory>,
    ),
  ]);

  /*
    주문 → 개수. 디자이너 쪽에서도 씁니다.

    ★ 'Abut+Zir' 한 줄은 **2개**입니다 (2026-10-12). 몇 개인지는 제품이
      들고 있고(unitCount), 세는 규칙은 domain/stats 한 곳에 있습니다.
  */
  const catalog = await getProsthesisCatalog({ includeInactive: true });

  const teethOf = new Map<string, number>(
    orders.map((o) => [
      o.id,
      countUnits(
        (o.order_items ?? []).map((i) => ({
          typeCode: i.type_code,
          materialCode: i.material_code,
        })),
        catalog,
      ),
    ]),
  );

  // ---------- 치과별 ----------
  const byClinic = new Map<string, ClinicTally>();

  for (const order of orders) {
    const found = byClinic.get(order.clinic_org_id) ?? {
      orgId: order.clinic_org_id,
      name: order.clinic?.name ?? '',
      orders: 0,
      teeth: 0,
      remakes: 0,
      repairs: 0,
    };

    found.orders += 1;
    found.teeth += teethOf.get(order.id) ?? 0;
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

  /*
    ★★ **넘긴 건은 넘긴 달에 셉니다** (2026-11-15 자기 점검).
      전에는 "이번 달에 잡은 건 중 넘긴 것" 만 셌습니다. 10월 31일에 잡아 11월 1일에
      넘긴 건은 10월에도 11월에도 '넘김' 에 안 들어갔습니다 (11월에 실제로 2건).
      그런 건은 **잡은 때를 기간 밖에서** 찾아옵니다 — 걸린 날을 재려면 필요합니다.
  */
  const pickAt = new Map<string, string>();
  for (const [orderId, done] of handed) {
    const mine = picked.get(orderId);
    if (mine && mine.created_at <= done.created_at) pickAt.set(orderId, mine.created_at);
  }

  const lookBack = [...handed.keys()].filter((id) => !pickAt.has(id));
  for (const ids of chunks(lookBack, ID_CHUNK)) {
    const earlier = await readAll<RawHistory>('앞선 이력', (a, b) =>
      supabase
        .from('order_status_history')
        .select('order_id, to_status, actor_user_id, created_at')
        .eq('to_status', 'designing')
        .in('order_id', ids)
        .lte('created_at', end)
        .order('created_at')
        .order('order_id')
        .range(a, b) as unknown as Paged<RawHistory>,
    );

    // 오래된 것부터라, 넘긴 때보다 앞선 것 중 **마지막**이 남습니다
    for (const row of earlier) {
      const done = handed.get(row.order_id);
      if (done && row.created_at <= done.created_at) pickAt.set(row.order_id, row.created_at);
    }
  }

  const needDesigner = [...new Set([...picked.keys(), ...handed.keys(), ...parentIds])];
  const designerOf = new Map<string, string>();
  /** 디자인을 잡은 뒤 삭제(또는 취소)된 주문 — 일량에서 빼고 따로 셉니다 (2026-11-15) */
  const gone = new Set<string>();
  /**
   * ★★ 디자이너 쪽 치아 개수는 **여기서 읽은 것**으로 셉니다 (2026-11-15).
   *   전에는 위의 teethOf(그 기간에 **접수된** 주문)에서 꺼냈습니다. 10월에 접수돼
   *   11월에 디자인한 건은 건수에는 들어가고 치아는 0개로 들어갔습니다.
   *   건수와 같은 기준으로 맞춥니다.
   */
  const designTeethOf = new Map<string, number>();

  type DesignRow = {
    id: string;
    designer_user_id: string | null;
    deleted_at: string | null;
    status: string;
    order_items: { type_code: string; material_code: string }[] | null;
  };

  for (const ids of chunks(needDesigner, ID_CHUNK)) {
    const rows = await readAll<DesignRow>('담당 디자이너', (a, b) =>
      supabase
        .from('orders')
        .select('id, designer_user_id, deleted_at, status, order_items(type_code, material_code)')
        .in('id', ids)
        .order('id')
        .range(a, b) as unknown as Paged<DesignRow>,
    );

    for (const row of rows) {
      if (row.designer_user_id) designerOf.set(row.id, row.designer_user_id);
      if (row.deleted_at || row.status === 'cancelled') gone.add(row.id);
      designTeethOf.set(
        row.id,
        countUnits(
          (row.order_items ?? []).map((i) => ({ typeCode: i.type_code, materialCode: i.material_code })),
          catalog,
        ),
      );
    }
  }

  const tally = new Map<string, DesignerTally & { spans: number[] }>();

  const seat = (userId: string) => {
    const found = tally.get(userId) ?? {
      userId,
      name: '',
      picked: 0,
      pickedTeeth: 0,
      handed: 0,
      handedTeeth: 0,
      remade: 0,
      deleted: 0,
      deletedTeeth: 0,
      amount: 0,
      amountUnpriced: false,
      avgDays: null,
      spans: [] as number[],
    };
    tally.set(userId, found);

    return found;
  };

  // ★ 삭제된 건은 일량에 안 넣고 따로 적습니다 (사용자 결정 2026-11-15).
  //   잡기도 넘기기도 한 주문을 두 번 세지 않게 **주문 하나에 한 번**입니다.
  for (const orderId of new Set([...picked.keys(), ...handed.keys()])) {
    const who = designerOf.get(orderId);
    if (!who || !gone.has(orderId)) continue;

    const seatRow = seat(who);
    seatRow.deleted += 1;
    seatRow.deletedTeeth += designTeethOf.get(orderId) ?? 0;
  }

  // 잡음 — 이번 기간에 디자인을 잡은 건
  for (const orderId of picked.keys()) {
    const who = designerOf.get(orderId);
    if (!who || gone.has(orderId)) continue;

    const seatRow = seat(who);
    seatRow.picked += 1;
    seatRow.pickedTeeth += designTeethOf.get(orderId) ?? 0;
  }

  // 넘김 — 이번 기간에 제작주문으로 넘긴 건 (언제 잡았든)
  for (const [orderId, done] of handed) {
    const who = designerOf.get(orderId);
    if (!who || gone.has(orderId)) continue;

    const seatRow = seat(who);
    seatRow.handed += 1;
    seatRow.handedTeeth += designTeethOf.get(orderId) ?? 0;

    // 잡은 기록이 없는 건(디자인 단계를 안 거친 건)은 걸린 날을 못 잽니다 — 평균에서 뺍니다
    const began = pickAt.get(orderId);
    if (began) seatRow.spans.push(daysBetween(began, done.created_at));
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
  await addShippedAmounts(supabase, start, end, designerOf, seat);

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
    teeth: [...teethOf.values()].reduce((sum, n) => sum + n, 0),
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
  type ShippedRow = {
    id: string;
    clinic_org_id: string;
    designer_user_id: string;
    shipped_at: string | null;
    order_items:
      | { type_code: string; material_code: string; is_pontic: boolean; has_gingival: boolean }[]
      | null;
  };

  // ★ 끝까지 읽고, 못 읽으면 던집니다 — 1000줄에서 잘린 금액은 틀린 금액입니다
  const rows = await readAll<ShippedRow>('배송분', (a, b) =>
    supabase
      .from('orders')
      .select(
        // shipped_at — 그 날 유효했던 단가로 셉니다 (2026-10-08)
        'id, clinic_org_id, designer_user_id, shipped_at, ' +
          'order_items(type_code, material_code, is_pontic, has_gingival)',
      )
      .is('deleted_at', null)
      .eq('is_billable', true)
      .not('shipped_at', 'is', null)
      .not('designer_user_id', 'is', null)
      // ★ 한국 달력의 경계입니다 — getDesignStats 가 +09:00 을 붙여 넘깁니다
      .gte('shipped_at', from)
      .lte('shipped_at', to)
      .order('id')
      .range(a, b) as unknown as Paged<ShippedRow>,
  );

  if (rows.length === 0) return;

  // ---------- 단가표 ----------
  const [baseRes, priceAt] = await Promise.all([
    supabase
      .from('prosthesis_materials')
      .select('id, code, price, pontic_price, pink_price, prosthesis_types!inner(code)'),
    // ★ 치과 단가는 **배송일 기준**입니다 (2026-10-08) — 정산과 같은 셈
    loadDatedOverrides(supabase, 'clinic'),
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

  // ---------- 더하기 ----------
  for (const order of rows) {
    const who = order.designer_user_id ?? designerOf.get(order.id);
    if (!who) continue;

    const target = seat(who);
    const day = priceDay(order.shipped_at);

    for (const item of order.order_items ?? []) {
      const base = baseOf.get(`${item.type_code}/${item.material_code}`);
      const over = base ? priceAt(order.clinic_org_id, base.id, day) : null;

      const money = itemAmount({
        isPontic: item.is_pontic,
        hasGingival: item.has_gingival,
        price: resolvePartyPrice(base?.price ?? null, over?.price ?? null, 'clinic'),
        ponticPrice: resolvePartyPrice(
          base?.pontic_price ?? null,
          over?.ponticPrice ?? null,
          'clinic',
        ),
        pinkPrice: resolvePartyPrice(
          base?.pink_price ?? null,
          over?.pinkPrice ?? null,
          'clinic',
        ),
      });

      target.amount += money.amount;
      target.amountUnpriced = target.amountUnpriced || money.unpriced;
    }
  }
}

