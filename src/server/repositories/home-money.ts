// =========================================================
// 놓을 위치: src/server/repositories/home-money.ts
//
// HOME 왼쪽 위 금액 카드. (사용자 결정 2026-08-12)
//
//   치과        접수일 · 자기 정산기간   '이번 달에 얼마나 쓰고 있나'
//   디자인센터  배송일 · 달력 월         실제로 받을 돈
//   기공소      배송일 · 자기 정산기간   실제로 받을 돈
//
// 무엇을 언제로 세는지는 domain/billing 의 moneyRange 가 정합니다.
//
// ★ 가격 격리를 여기서도 지킵니다 (§8.5).
//     기공소     lab_product_costs 만. 제품 기본가(=치과 판매가)는
//                값이 빠진 보기에서 코드만 읽습니다
//     치과       자기 clinic_product_prices 만. 기공원가 표는 안 건드립니다
//     디자인센터 거래처 치과들의 판매가. 기공원가는 여기 안 섞습니다
//   금액이 있는 표를 새로 붙일 때마다 이 갈래를 다시 봐야 합니다.
//
// ★ 정산 화면(getSettlement)을 다시 부르지 않습니다.
//   그쪽은 거래처 **하나**를 깊게 봅니다. HOME 은 거래처 전부를 얕게
//   봅니다 — 디자인센터에서 거래처마다 부르면 조회가 거래처 수만큼
//   늘어납니다. 대신 **셈하는 규칙은 같은 것을 씁니다**
//   (resolvePartyPrice · itemAmount). 규칙이 갈라지면 두 화면의 금액이
//   서로 다른 말을 합니다.
//
// ★ 조정(billing_adjustments)은 안 더합니다.
//   HOME 은 어림이고 청구서가 확정입니다. 화면이 그렇다고 말해 줍니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { todayInKst } from '@/server/domain/week';
import { resolvePartyPrice } from '@/server/domain/pricing';
import {
  itemAmount,
  moneyRanges,
  type MoneyBasis,
  type MoneyCountBy,
} from '@/server/domain/billing';

/** 구간 하나 — 금액 카드의 이번 구간이자, 추이 그래프의 막대 하나 */
export interface MoneyBucket {
  amount: number;
  /** 구간 (양끝 포함) */
  from: string;
  to: string;
  /** 이 구간에 든 주문 수 */
  orderCount: number;
  /** 단가를 안 정해 금액에 못 잡힌 줄 수. 0 이 아니면 화면이 알립니다 */
  unpricedCount: number;
}

export interface HomeMoney {
  /** 이번 구간. 왼쪽 위 금액 카드가 씁니다 */
  current: MoneyBucket;
  /**
   * 최근 여섯 구간. **오래된 것부터**, 마지막이 current 와 같습니다.
   *
   * ★ 마지막 막대는 아직 안 끝난 구간입니다. 화면이 달리 그려야 합니다 —
   *   다 지난 달과 나란히 두면 "이번 달은 왜 이렇게 적나" 로 읽힙니다.
   */
  trend: MoneyBucket[];
  basis: MoneyBasis;
  countBy: MoneyCountBy;
}

/** 몇 구간을 그리는가 */
const TREND_COUNT = 6;

interface PriceRow {
  price: number | null;
  ponticPrice: number | null;
  pinkPrice: number | null;
}

interface RawItem {
  type_code: string;
  material_code: string;
  is_pontic: boolean;
  has_gingival: boolean;
}

interface RawOrder {
  clinic_org_id: string;
  lab_org_id: string | null;
  is_billable: boolean;
  received_at: string | null;
  shipped_at: string | null;
  order_items: RawItem[] | null;
}

export async function getHomeMoney(): Promise<HomeMoney> {
  const session = await getSession();

  if (!session?.orgId || !session.orgType) return empty();

  const orgType = session.orgType;
  const supabase = await createClient();

  // 기준일은 자기 조직 설정입니다. 비어 있으면 1일(달력 월)로 봅니다
  const { data: org } = await supabase
    .from('organizations')
    .select('closing_day')
    .eq('id', session.orgId)
    .maybeSingle();

  const closingDay = (org as { closing_day: number | null } | null)?.closing_day ?? 1;
  const ranges = moneyRanges(todayInKst(), orgType, closingDay, TREND_COUNT);
  const { basis, countBy } = ranges[ranges.length - 1];

  const buckets: MoneyBucket[] = ranges.map((r) => ({
    amount: 0,
    from: r.from,
    to: r.to,
    orderCount: 0,
    unpricedCount: 0,
  }));

  /*
    ★ 여섯 구간을 한 번에 읽고 나눠 담습니다.
      구간마다 물으면 조회가 여섯 번입니다. 구간끼리 겹치지도 비지도
      않는 것은 domain 이 보장하므로(테스트가 잠급니다), 날짜 하나가
      어느 칸에 드는지는 한 번만 찾으면 됩니다.

    ★ 어느 조직의 주문인지 여기서 안 따집니다 — RLS 가 가릅니다.
      치과는 자기 것, 디자인센터는 거래 치과 것, 기공소는 배정받은 것만
      돌아옵니다. 여기서 조건을 한 번 더 걸면 두 곳이 어긋날 때 구멍이 납니다.

    ★ 접수 기준은 아직 안 나간 건도 셉니다 — 그게 치과가 보고 싶은 것입니다.
      배송 기준은 나간 것만 셉니다.
  */
  const dateColumn = countBy === 'received' ? 'received_at' : 'shipped_at';
  const span = { from: ranges[0].from, to: ranges[ranges.length - 1].to };

  const orders = await supabase
    .from('orders')
    .select(
      'clinic_org_id, lab_org_id, is_billable, received_at, shipped_at, ' +
        'order_items(type_code, material_code, is_pontic, has_gingival)',
    )
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .not(dateColumn, 'is', null)
    .gte(dateColumn, `${span.from}T00:00:00`)
    .lte(dateColumn, `${span.to}T23:59:59`);

  if (orders.error || !orders.data) return { current: buckets[buckets.length - 1], trend: buckets, basis, countBy };

  const rows = orders.data as unknown as RawOrder[];
  const priceFor = rows.length > 0 ? await loadPricing(supabase, orgType) : null;

  for (const order of rows) {
    const when = (countBy === 'received' ? order.received_at : order.shipped_at) ?? '';
    const day = when.slice(0, 10);

    // ISO 날짜는 글자 순서가 곧 날짜 순서입니다
    const bucket = buckets.find((b) => day >= b.from && day <= b.to);
    if (!bucket) continue;

    bucket.orderCount += 1;

    // ★ 리메이크·리페어는 0원입니다. 건수에는 넣습니다 —
    //   "이번 달 스무 건" 에서 빼 버리면 화면이 실제와 어긋납니다
    if (!order.is_billable || !priceFor) continue;

    // 어느 거래처의 단가인가. 기공소는 자기 것, 나머지는 그 치과 것
    const party = (orgType === 'lab' ? order.lab_org_id : order.clinic_org_id) ?? '';

    for (const item of order.order_items ?? []) {
      const money = itemAmount({
        isPontic: item.is_pontic,
        hasGingival: item.has_gingival,
        ...priceFor(party, item.type_code, item.material_code),
      });

      bucket.amount += money.amount;
      if (money.unpriced) bucket.unpricedCount += 1;
    }
  }

  return { current: buckets[buckets.length - 1], trend: buckets, basis, countBy };
}

// ---------- 단가 ----------

type PriceLookup = (party: string, typeCode: string, materialCode: string) => PriceRow;

const NO_PRICE: PriceRow = { price: null, ponticPrice: null, pinkPrice: null };

/**
 * 제품 기본가와 거래처 단가를 읽어, 물어보면 답해 주는 함수를 돌려줍니다.
 *
 * ★ 미리 펴 두지 않고 물을 때 섞습니다.
 *   거래처 × 제품을 전부 펴 두면, 단가를 하나도 안 정한 거래처의 자리를
 *   따로 챙겨야 하고 그 자리를 빠뜨리면 그 치과 주문이 통째로 0원이 됩니다.
 *   물을 때 섞으면 '덮어쓴 값이 없으면 기본가' 가 저절로 됩니다.
 */
async function loadPricing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgType: 'clinic' | 'design_center' | 'lab',
): Promise<PriceLookup> {
  const isLab = orgType === 'lab';

  const [base, overrides] = await Promise.all([
    /*
      ★ 기공소에는 prosthesis_materials 가 닫혀 있습니다 —
        그 표의 price 가 **치과 판매가**입니다. 값이 빠진 보기에서 코드만
        읽습니다. 기공소의 금액은 어차피 lab_product_costs 에서만 나옵니다.
    */
    isLab
      ? supabase.from('prosthesis_products_public').select('id, code, type_code')
      : supabase
          .from('prosthesis_materials')
          .select('id, code, price, pontic_price, pink_price, prosthesis_types!inner(code)'),

    isLab
      ? supabase
          .from('lab_product_costs')
          .select('lab_org_id, material_id, lab_cost, pontic_cost, pink_cost')
      : supabase
          .from('clinic_product_prices')
          .select('clinic_org_id, material_id, price, pontic_price, pink_price'),
  ]);

  // 제품 코드 → { id, 기본가 }
  const byProduct = new Map<string, { id: string } & PriceRow>();

  for (const raw of (base.data ?? []) as unknown as {
    id: string;
    code: string;
    price?: number | null;
    pontic_price?: number | null;
    pink_price?: number | null;
    prosthesis_types?: { code: string };
    type_code?: string;
  }[]) {
    const typeCode = raw.prosthesis_types?.code ?? raw.type_code ?? '';

    byProduct.set(`${typeCode}/${raw.code}`, {
      id: raw.id,
      price: raw.price ?? null,
      ponticPrice: raw.pontic_price ?? null,
      pinkPrice: raw.pink_price ?? null,
    });
  }

  // 거래처 단가 — 거래처와 제품 둘 다 열쇠입니다 (치과마다 값이 다름)
  const byParty = new Map<string, PriceRow>();

  for (const row of (overrides.data ?? []) as Record<string, unknown>[]) {
    const party = (isLab ? row.lab_org_id : row.clinic_org_id) as string;

    byParty.set(`${party}|${row.material_id as string}`, {
      price: (isLab ? row.lab_cost : row.price) as number | null,
      ponticPrice: (isLab ? row.pontic_cost : row.pontic_price) as number | null,
      pinkPrice: (isLab ? row.pink_cost : row.pink_price) as number | null,
    });
  }

  const partyType = isLab ? 'lab' : 'clinic';

  return (party, typeCode, materialCode) => {
    const product = byProduct.get(`${typeCode}/${materialCode}`);
    if (!product) return NO_PRICE;

    const over = byParty.get(`${party}|${product.id}`);

    /*
      ★ 기공소는 제품 기본가로 안 떨어집니다 (resolvePartyPrice).
        prosthesis_materials.price 는 치과에 파는 값입니다 — 그걸 기공원가로
        쓰면 5만원에 팔고 5만원을 지급하는 셈입니다.
        안 정했으면 0원이 아니라 '미정' 입니다.
    */
    return {
      price: resolvePartyPrice(product.price, over?.price ?? null, partyType),
      ponticPrice: resolvePartyPrice(product.ponticPrice, over?.ponticPrice ?? null, partyType),
      pinkPrice: resolvePartyPrice(product.pinkPrice, over?.pinkPrice ?? null, partyType),
    };
  };
}

/** 로그인이 안 됐거나 소속이 없을 때. 화면은 '아직 셀 것이 없습니다' 를 그립니다 */
function empty(): HomeMoney {
  const bucket: MoneyBucket = {
    amount: 0,
    from: '',
    to: '',
    orderCount: 0,
    unpricedCount: 0,
  };

  return { current: bucket, trend: [], basis: 'calendar', countBy: 'shipped' };
}
