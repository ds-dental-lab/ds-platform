// =========================================================
// 놓을 위치: src/server/repositories/order-money.ts
//
// 주문 한 건의 금액 — 치과에 청구할 값과 기공소에 지급할 값.
// 주문상세의 몽키스패너가 씁니다. **디자인센터만** 부릅니다.
//
// ★ 한 주문에 청구서가 둘 붙습니다.
//   같은 16번 Zir-Cr 이라도 치과에 5만원을 받고 기공소에 3만원을 줍니다.
//   그래서 조정도 **어느 쪽인지**를 골라야 합니다 — 치과에 깎아 주는
//   것과 기공소에 더 주는 것은 서로 다른 청구서에 갑니다.
//   한쪽만 고칠 수 있게 두면 반드시 엉뚱한 곳이 깎입니다.
//
// ★ 셈은 정산과 같은 함수를 씁니다 (resolvePartyPrice · itemAmount).
//   여기서 따로 셈하면 주문상세와 정산이 다른 금액을 말합니다.
//
// ★ 기공소는 제품 기본가로 안 떨어집니다.
//   prosthesis_materials.price 는 치과에 파는 값입니다. 안 정했으면
//   0원이 아니라 '미정' 입니다 (설계서 §8.5, domain/pricing).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { resolvePartyPrice } from '@/server/domain/pricing';
import { itemAmount } from '@/server/domain/billing';

export interface OrderMoneyItem {
  itemId: string;
  toothNumber: number;
  label: string;
  isPontic: boolean;

  /** 치과에 청구할 값 */
  clinicAmount: number;
  clinicUnpriced: boolean;
  clinicAdjust: number;
  /** 이미 청구서에 실려 굳은 조정이 있는가 — 그건 못 지웁니다 */
  clinicPosted: boolean;

  /** 기공소에 지급할 값 */
  labAmount: number;
  labUnpriced: boolean;
  labAdjust: number;
  labPosted: boolean;
}

export interface OrderMoney {
  clinicOrgId: string;
  clinicName: string;
  labOrgId: string | null;
  labName: string;
  /**
   * 자사 제작인가 (기공소가 우리 자신).
   *
   * ★ 자사면 **지급이 없습니다** (설계서 Q-6).
   *   자기가 자기에게 주는 돈이라 정산에서 아예 빠집니다.
   *   그 칸을 열어 두면 자기 청구서에 조정을 거는 일이 생기고,
   *   그 조정은 어느 청구서에도 안 실린 채 표에만 남습니다.
   */
  inHouse: boolean;
  /** 리메이크·리페어는 0원입니다 */
  billable: boolean;
  items: OrderMoneyItem[];
}

interface PriceRow {
  price: number | null;
  ponticPrice: number | null;
  pinkPrice: number | null;
}

const NONE: PriceRow = { price: null, ponticPrice: null, pinkPrice: null };

export async function getOrderMoney(orderId: string): Promise<OrderMoney | null> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return null;

  const supabase = await createClient();

  const { data: orderRow } = await supabase
    .from('orders')
    .select(
      'id, clinic_org_id, lab_org_id, design_org_id, is_billable, ' +
        'clinic:organizations!orders_clinic_org_id_fkey(name), ' +
        'lab:organizations!orders_lab_org_id_fkey(name), ' +
        'order_items(id, tooth_number, type_code, material_code, is_pontic, has_gingival)',
    )
    .eq('id', orderId)
    .maybeSingle();

  const order = orderRow as unknown as {
    clinic_org_id: string;
    lab_org_id: string | null;
    design_org_id: string | null;
    is_billable: boolean;
    clinic: { name: string } | null;
    lab: { name: string } | null;
    order_items:
      | {
          id: string;
          tooth_number: number;
          type_code: string;
          material_code: string;
          is_pontic: boolean;
          has_gingival: boolean;
        }[]
      | null;
  } | null;

  if (!order) return null;

  // 자사 제작이면 지급이 없습니다 — 기공원가도 안 읽습니다
  const inHouse = Boolean(order.lab_org_id) && order.lab_org_id === order.design_org_id;
  const payableLab = inHouse ? null : order.lab_org_id;

  const [baseRes, clinicRes, labRes, adjRes] = await Promise.all([
    supabase
      .from('prosthesis_materials')
      .select('id, code, price, pontic_price, pink_price, prosthesis_types!inner(code)'),

    supabase
      .from('clinic_product_prices')
      .select('material_id, price, pontic_price, pink_price')
      .eq('clinic_org_id', order.clinic_org_id),

    payableLab
      ? supabase
          .from('lab_product_costs')
          .select('material_id, lab_cost, pontic_cost, pink_cost')
          .eq('lab_org_id', payableLab)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),

    supabase
      .from('billing_adjustments')
      .select('order_item_id, party_org_id, amount, posted_line_id')
      .eq('order_id', orderId),
  ]);

  // ---------- 단가표를 (종류/재료) 로 폅니다 ----------
  const clinicOver = new Map<string, PriceRow>();
  for (const r of (clinicRes.data ?? []) as Record<string, unknown>[]) {
    clinicOver.set(r.material_id as string, {
      price: r.price as number | null,
      ponticPrice: r.pontic_price as number | null,
      pinkPrice: r.pink_price as number | null,
    });
  }

  const labOver = new Map<string, PriceRow>();
  for (const r of (labRes.data ?? []) as Record<string, unknown>[]) {
    labOver.set(r.material_id as string, {
      price: r.lab_cost as number | null,
      ponticPrice: r.pontic_cost as number | null,
      pinkPrice: r.pink_cost as number | null,
    });
  }

  const byCode = new Map<string, { clinic: PriceRow; lab: PriceRow; label: string }>();

  for (const raw of (baseRes.data ?? []) as unknown as {
    id: string;
    code: string;
    price: number | null;
    pontic_price: number | null;
    pink_price: number | null;
    prosthesis_types: { code: string };
  }[]) {
    const typeCode = raw.prosthesis_types?.code ?? '';
    const c = clinicOver.get(raw.id);
    const l = labOver.get(raw.id);

    byCode.set(`${typeCode}/${raw.code}`, {
      label: `${typeCode}/${raw.code}`,
      clinic: {
        price: resolvePartyPrice(raw.price, c?.price ?? null, 'clinic'),
        ponticPrice: resolvePartyPrice(raw.pontic_price, c?.ponticPrice ?? null, 'clinic'),
        pinkPrice: resolvePartyPrice(raw.pink_price, c?.pinkPrice ?? null, 'clinic'),
      },
      // ★ 기공소는 기본가로 안 떨어집니다 — 그건 치과 판매가입니다
      lab: {
        price: resolvePartyPrice(raw.price, l?.price ?? null, 'lab'),
        ponticPrice: resolvePartyPrice(raw.pontic_price, l?.ponticPrice ?? null, 'lab'),
        pinkPrice: resolvePartyPrice(raw.pink_price, l?.pinkPrice ?? null, 'lab'),
      },
    });
  }

  // ---------- 조정 ----------
  interface RawAdj {
    order_item_id: string | null;
    party_org_id: string;
    amount: number;
    posted_line_id: string | null;
  }

  const adjust = new Map<string, { amount: number; posted: boolean }>();

  for (const a of (adjRes.data ?? []) as RawAdj[]) {
    if (!a.order_item_id) continue;

    const key = `${a.order_item_id}|${a.party_org_id}`;
    const found = adjust.get(key) ?? { amount: 0, posted: false };

    found.amount += a.amount;
    found.posted = found.posted || a.posted_line_id !== null;
    adjust.set(key, found);
  }

  // ---------- 줄 ----------
  const items = (order.order_items ?? []).map((item) => {
    const price = byCode.get(`${item.type_code}/${item.material_code}`);

    // ★ 리메이크·리페어는 0원입니다 (정산과 같은 규칙)
    const clinic = order.is_billable
      ? itemAmount({
          isPontic: item.is_pontic,
          hasGingival: item.has_gingival,
          ...(price?.clinic ?? NONE),
        })
      : { amount: 0, unpriced: false };

    const lab = order.is_billable && payableLab
      ? itemAmount({
          isPontic: item.is_pontic,
          hasGingival: item.has_gingival,
          ...(price?.lab ?? NONE),
        })
      : { amount: 0, unpriced: false };

    const c = adjust.get(`${item.id}|${order.clinic_org_id}`);
    const l = payableLab ? adjust.get(`${item.id}|${payableLab}`) : undefined;

    return {
      itemId: item.id,
      toothNumber: item.tooth_number,
      label: `${item.type_code}/${item.material_code}`,
      isPontic: item.is_pontic,

      clinicAmount: clinic.amount,
      clinicUnpriced: clinic.unpriced,
      clinicAdjust: c?.amount ?? 0,
      clinicPosted: c?.posted ?? false,

      labAmount: lab.amount,
      labUnpriced: lab.unpriced,
      labAdjust: l?.amount ?? 0,
      labPosted: l?.posted ?? false,
    };
  });

  return {
    clinicOrgId: order.clinic_org_id,
    clinicName: order.clinic?.name ?? '',
    // ★ 자사면 조정할 상대가 없습니다 — 화면이 그 칸을 아예 안 그립니다
    labOrgId: payableLab,
    labName: order.lab?.name ?? '',
    inHouse,
    billable: order.is_billable,
    items: items.sort((a, b) => a.toothNumber - b.toothNumber),
  };
}
