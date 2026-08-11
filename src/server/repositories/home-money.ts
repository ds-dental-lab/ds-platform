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
  moneyRange,
  type MoneyBasis,
  type MoneyCountBy,
} from '@/server/domain/billing';

export interface HomeMoney {
  amount: number;
  /** 구간 (양끝 포함) */
  from: string;
  to: string;
  /** 이 구간에 든 주문 수 */
  orderCount: number;
  /** 단가를 안 정해 금액에 못 잡힌 줄 수. 0 이 아니면 화면이 알립니다 */
  unpricedCount: number;
  basis: MoneyBasis;
  countBy: MoneyCountBy;
}

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
  const range = moneyRange(todayInKst(), orgType, closingDay);

  /*
    ★ 어느 조직의 주문인지 여기서 안 따집니다 — RLS 가 가릅니다.
      치과는 자기 것, 디자인센터는 거래 치과 것, 기공소는 배정받은 것만
      돌아옵니다. 여기서 조건을 한 번 더 걸면 두 곳이 어긋날 때 구멍이 납니다.

    ★ 접수 기준은 아직 안 나간 건도 셉니다 — 그게 치과가 보고 싶은 것입니다.
      배송 기준은 나간 것만 셉니다.
  */
  const dateColumn = range.countBy === 'received' ? 'received_at' : 'shipped_at';

  const orders = await supabase
    .from('orders')
    .select(
      'clinic_org_id, lab_org_id, is_billable, ' +
        'order_items(type_code, material_code, is_pontic, has_gingival)',
    )
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .not(dateColumn, 'is', null)
    .gte(dateColumn, `${range.from}T00:00:00`)
    .lte(dateColumn, `${range.to}T23:59:59`);

  if (orders.error || !orders.data) return empty(range);

  const rows = orders.data as unknown as RawOrder[];
  if (rows.length === 0) return empty(range);

  const priceFor = await loadPricing(supabase, orgType);

  let amount = 0;
  let unpricedCount = 0;

  for (const order of rows) {
    // ★ 리메이크·리페어는 0원입니다. 건수에는 넣습니다 —
    //   "이번 달 스무 건" 에서 빼 버리면 화면이 실제와 어긋납니다
    if (!order.is_billable) continue;

    // 어느 거래처의 단가인가. 기공소는 자기 것, 나머지는 그 치과 것
    const party = (orgType === 'lab' ? order.lab_org_id : order.clinic_org_id) ?? '';

    for (const item of order.order_items ?? []) {
      const money = itemAmount({
        isPontic: item.is_pontic,
        hasGingival: item.has_gingival,
        ...priceFor(party, item.type_code, item.material_code),
      });

      amount += money.amount;
      if (money.unpriced) unpricedCount += 1;
    }
  }

  return {
    amount,
    from: range.from,
    to: range.to,
    orderCount: rows.length,
    unpricedCount,
    basis: range.basis,
    countBy: range.countBy,
  };
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

function empty(range?: {
  from: string;
  to: string;
  basis: MoneyBasis;
  countBy: MoneyCountBy;
}): HomeMoney {
  return {
    amount: 0,
    from: range?.from ?? '',
    to: range?.to ?? '',
    orderCount: 0,
    unpricedCount: 0,
    basis: range?.basis ?? 'calendar',
    countBy: range?.countBy ?? 'shipped',
  };
}
