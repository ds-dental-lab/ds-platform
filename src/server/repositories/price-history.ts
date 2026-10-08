// =========================================================
// 놓을 위치: src/server/repositories/price-history.ts
//
// 배송일에 유효했던 거래처 단가를 읽습니다.
// 기준: 사용자 결정 2026-10-08 — "앞으로는 수가가 바뀐 이후에 적용이 되는게 맞다"
//
// ★★ 전에는 돈을 세는 네 곳(정산·주문상세·HOME·통계)이 모두 **지금**
//   단가표(clinic_product_prices · lab_product_costs)를 읽었습니다.
//   그래서 단가를 올리면 **이미 배송된 건까지** 올라갔습니다.
//   이제 네 곳이 모두 이 파일을 지나갑니다 — 한 곳만 옛 표를 읽으면
//   화면마다 금액이 다릅니다.
//
// ★ 지금 단가표는 그대로 씁니다. 거기가 '지금 값' 입니다 —
//   단가 화면(getPartnerPrices)과 저장(savePartnerPrices)은 안 건드립니다.
//   여기 쓰이는 표는 바뀐 날을 같이 적어 둔 product_price_history 입니다.
//
// ★ 가격 격리는 DB 가 지킵니다 (price_history_select).
//   치과는 자기 판매가만, 기공소는 자기 기공원가만 읽힙니다.
//   그래서 여기서는 party_type 만 제대로 넘깁니다.
// =========================================================

import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { priceOn, type DatedPrice, type PriceSet, EMPTY_PRICES } from '@/server/domain/pricing';
import { todayInKst } from '@/server/domain/week';

export type PartyType = 'clinic' | 'lab';

/** (거래처, 제품, 배송일) → 그 날의 덮어쓰기. 없으면 비어 있는 값 */
export type DatedOverrides = (partyOrgId: string, materialId: string, day: string) => PriceSet;

interface RawRow {
  party_org_id: string;
  material_id: string;
  effective_from: string;
  price: number | null;
  pontic_price: number | null;
  pink_price: number | null;
}

/**
 * 거래처 단가의 **시점별** 줄을 읽어, 물어보면 답하는 함수를 돌려줍니다.
 *
 * ★ 미리 펴 두지 않습니다 (home-money 의 loadPricing 과 같은 이유).
 *   거래처 × 제품을 전부 펴 두면 단가를 안 정한 거래처의 자리를 따로
 *   챙겨야 하고, 빠뜨리면 그 치과 주문이 통째로 0원이 됩니다.
 *
 * @param partyOrgIds 비우면 내가 볼 수 있는 거래처 전부 (HOME·통계가 그렇게 씁니다)
 */
export async function loadDatedOverrides(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partyType: PartyType,
  partyOrgIds?: string[],
): Promise<DatedOverrides> {
  let query = supabase
    .from('product_price_history')
    .select('party_org_id, material_id, effective_from, price, pontic_price, pink_price')
    .eq('party_type', partyType);

  if (partyOrgIds && partyOrgIds.length > 0) {
    query = query.in('party_org_id', partyOrgIds);
  }

  const { data, error } = await query;

  /*
    ★★ 표가 아직 없을 때를 대비합니다 (2026-10-08).
      미그레이션보다 배포가 먼저 올라가면 이 조회가 실패합니다. 그때
      빈 값을 돌려주면 **거래처 단가가 통째로 사라져** 제품 기본가로
      청구됩니다 — 1원짜리 시험 치과가 50,000원이 되는 식입니다.
      조용히 틀린 금액보다, 옛 방식(지금 단가를 늘 적용)으로 버티는
      쪽이 낫습니다. 미그레이션이 들어가면 저절로 안 쓰이게 됩니다.
  */
  if (error) return await livePricesAsAlways(supabase, partyType, partyOrgIds);

  // '거래처|제품' → 시점별 줄
  const rows = new Map<string, DatedPrice[]>();

  for (const raw of (data ?? []) as unknown as RawRow[]) {
    const key = `${raw.party_org_id}|${raw.material_id}`;
    const list = rows.get(key) ?? [];

    list.push({
      effectiveFrom: raw.effective_from,
      price: raw.price,
      ponticPrice: raw.pontic_price,
      pinkPrice: raw.pink_price,
    });

    rows.set(key, list);
  }

  return (partyOrgId, materialId, day) => {
    const list = rows.get(`${partyOrgId}|${materialId}`);
    return list ? priceOn(list, day) : { ...EMPTY_PRICES };
  };
}

/**
 * 지난 기록이 없을 때의 버팀목 — **지금 단가를 늘 적용**합니다.
 *
 * ★ 2026-10-08 전의 방식 그대로입니다. 날짜를 안 가립니다.
 */
async function livePricesAsAlways(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partyType: PartyType,
  partyOrgIds?: string[],
): Promise<DatedOverrides> {
  const isLab = partyType === 'lab';
  const orgColumn = isLab ? 'lab_org_id' : 'clinic_org_id';

  let query = isLab
    ? supabase
        .from('lab_product_costs')
        .select('lab_org_id, material_id, lab_cost, pontic_cost, pink_cost')
    : supabase
        .from('clinic_product_prices')
        .select('clinic_org_id, material_id, price, pontic_price, pink_price');

  if (partyOrgIds && partyOrgIds.length > 0) {
    query = query.in(orgColumn, partyOrgIds);
  }

  const { data } = await query;

  const flat = new Map<string, PriceSet>();

  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    flat.set(`${row[orgColumn] as string}|${row.material_id as string}`, {
      price: (isLab ? row.lab_cost : row.price) as number | null,
      ponticPrice: (isLab ? row.pontic_cost : row.pontic_price) as number | null,
      pinkPrice: (isLab ? row.pink_cost : row.pink_price) as number | null,
    });
  }

  return (partyOrgId, materialId) =>
    flat.get(`${partyOrgId}|${materialId}`) ?? { ...EMPTY_PRICES };
}

/**
 * 어느 날의 단가로 셀 것인가.
 *
 * ★ **배송일**입니다. 정산이 배송된 건만 세기 때문입니다 —
 *   접수일로 고르면 접수와 배송 사이에 단가가 바뀐 건이 청구서와
 *   어긋납니다.
 *
 * ★ 아직 안 나간 건은 **오늘** 값으로 미리 보여 줍니다.
 *   주문상세·HOME 의 '예상 금액' 이 그렇습니다. 나가는 날 값이 다시
 *   정해지므로 그때 바뀔 수 있습니다.
 */
export function priceDay(shippedAt: string | null | undefined): string {
  return shippedAt ? todayInKst(new Date(shippedAt)) : todayInKst();
}
