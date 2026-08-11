// =========================================================
// 놓을 위치: src/server/repositories/billing.ts
//
// 정산 조회. 디자인센터가 거래처 하나의 한 기간을 들여다봅니다.
//
// ★ 열린 기간은 표에 줄이 없습니다. 주문에서 그때그때 셈합니다.
//   미리 만들어 두면 주문이 바뀔 때마다 따라 고쳐야 하고,
//   한 번 어긋나면 어디가 맞는지 알 수 없습니다.
//   마감을 누르는 순간에만 그 결과가 billing_lines 로 굳습니다.
//
// ★ 기간은 거래처의 기준일이 가릅니다 (2026-08-11 결정).
//   1일 치과는 08-01~08-31, 26일 치과는 07-26~08-25 가 똑같이 '2026-08' 입니다.
//
// ★ 단가는 거래처 값이 기본가를 덮어씁니다 (domain/pricing).
//   치과에는 판매가를, 기공소에는 기공원가를 씁니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { resolvePartyPrice } from '@/server/domain/pricing';
import { itemAmount, type ItemAmount } from '@/server/domain/billing';
import { buildAbbr, type ProsthesisCatalog } from '@/server/domain/prosthesis';
import type { PartnerRow } from '@/server/repositories/partner';

/** 세부내역 한 줄 — 보철 하나 */
export interface SettlementItem {
  orderId: string;
  itemId: string;

  orderNo: string;
  receivedAt: string | null;
  shippedAt: string;
  patientLabel: string;

  /** 리메이크면 'N차' 를 이름 뒤에 붙여 보여 줍니다 */
  remakeSeq: number;
  isRemake: boolean;
  /**
   * 돈을 받는 줄인가.
   *
   * ★ 리메이크·리페어는 false 이고 금액이 0 입니다.
   *   그래도 목록에는 넣습니다 — 청구서에서 빼 버리면 치과는 그 달에
   *   무엇을 다시 만들었는지 알 수 없습니다. 0원으로 적혀 있어야
   *   "이건 안 받았다" 가 문서로 남습니다.
   */
  billable: boolean;

  typeCode: string;
  materialCode: string;
  /** 화면에 찍는 이름. 폰틱이면 (Pontic) 이 붙습니다 */
  label: string;
  toothNumber: number;
  isPontic: boolean;
  hasGingival: boolean;

  amount: number;
  /** 단가를 안 정한 제품. 0원이 아니라 '미정' 입니다 */
  unpriced: boolean;
  /** 손으로 깎거나 더한 값 */
  adjustment: number;
  /** 왜 조정했는지. 청구서에 그대로 실립니다 */
  adjustmentReason: string;

  /**
   * 이 거래처에 적용된 단가 그대로.
   *
   * ★ 마감할 때 합계에서 거꾸로 쪼개지 않으려고 들고 다닙니다.
   *   금액에서 핑크 값을 빼는 식으로 되돌리면, 규칙이 하나 바뀔 때마다
   *   그 뺄셈도 같이 고쳐야 하고 어긋나도 눈에 안 띕니다.
   */
  price: number | null;
  ponticPrice: number | null;
  pinkPrice: number | null;
}

/** 청구 내역 한 줄 — 제품별로 묶은 것 */
export interface SettlementProduct {
  key: string;
  label: string;
  count: number;
  amount: number;
  unpriced: boolean;
}

export interface Settlement {
  from: string;
  to: string;
  items: SettlementItem[];
  products: SettlementProduct[];

  /** 보철 합계 */
  subtotal: number;
  /** 조정 합계 */
  adjustment: number;
  total: number;

  /** 단가가 비어 청구액에 안 잡힌 줄 수. 0 이 아니면 화면에 띄웁니다 */
  unpricedCount: number;

  /**
   * 어느 보철이 어느 브릿지에 속하는가. { order_item_id: bridge_id }
   *
   * ★ 청구서에서 브릿지를 한 줄로 묶는 데 씁니다.
   *   다시 계산하지 않고 저장된 것을 씁니다 — 사용자가 손으로 끊어 둔
   *   연결을 도로 이어 버리면 안 됩니다.
   */
  bridgeOf: Record<string, string>;
}

interface RawItem {
  id: string;
  tooth_number: number;
  type_code: string;
  material_code: string;
  is_pontic: boolean;
  has_gingival: boolean;
}

interface RawOrder {
  id: string;
  order_no: string;
  received_at: string | null;
  shipped_at: string;
  patient_label: string;
  is_remake: boolean;
  remake_seq: number;
  is_billable: boolean;
  order_items: RawItem[] | null;
}

/**
 * 거래처 하나의 한 기간.
 *
 * ★ 배송일로 자릅니다. 접수일이 아닙니다 —
 *   물건이 나간 시점이 청구의 근거입니다.
 *
 * ★ 리메이크·리페어도 가져오되 0원입니다 (사용자 요청 2026-08-12).
 *   전에는 아예 뺐습니다. 그런데 청구서에서 빠지면 치과는 그 달에
 *   무엇을 다시 만들었는지 알 수 없습니다 — 0원으로 적혀 있어야
 *   "이건 안 받았다" 가 문서로 남고, 물어볼 일도 줄어듭니다.
 */
export async function getSettlement(
  partner: PartnerRow,
  from: string,
  to: string,
  catalog: ProsthesisCatalog,
): Promise<Settlement> {
  /*
    ★ 자기 정산은 당사자도 봅니다 (사용자 결정 2026-08-12).
      기공소는 자기가 받을 값의 세부내역을 확인해야 하고,
      디자인센터는 그것을 검수·기록용으로 봅니다.

      값은 어차피 RLS 가 가릅니다 —
        기공소  자기 lab_product_costs 만, 자기에게 배정된 주문만
        치과    자기 clinic_product_prices 만, 자기 주문만
      그래서 여기서는 '남의 거래처를 열지 않는' 것만 봅니다.
  */
  const session = await getSession();
  const isOwner = session?.orgType === 'design_center';
  const isSelf = session?.orgId === partner.id;

  if (!session?.orgId || (!isOwner && !isSelf)) return empty(from, to);

  const supabase = await createClient();
  const isClinic = partner.orgType === 'clinic';

  const [orders, prices, overrides, adjustments] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, order_no, received_at, shipped_at, patient_label, is_remake, remake_seq, ' +
          'is_billable, ' +
          'order_items(id, tooth_number, type_code, material_code, is_pontic, has_gingival)',
      )
      .eq(isClinic ? 'clinic_org_id' : 'lab_org_id', partner.id)
      .is('deleted_at', null)
      .not('shipped_at', 'is', null)
      .gte('shipped_at', `${from}T00:00:00`)
      .lte('shipped_at', `${to}T23:59:59`)
      .order('shipped_at', { ascending: false }),

    /*
      제품 기본가 — 코드로 찾을 수 있게 종류·재료를 함께 가져옵니다.

      ★ 기공소에는 원본 표가 닫혀 있습니다 (판매가가 들어 있어서).
        값이 빠진 보기에서 id 와 코드만 읽습니다 — 기공소의 금액은
        어차피 lab_product_costs 에서만 나옵니다.
    */
    session.orgType === 'lab'
      ? supabase.from('prosthesis_products_public').select('id, code, type_code')
      : supabase
          .from('prosthesis_materials')
          .select('id, code, price, pontic_price, pink_price, prosthesis_types!inner(code)'),

    isClinic
      ? supabase
          .from('clinic_product_prices')
          .select('material_id, price, pontic_price, pink_price')
          .eq('clinic_org_id', partner.id)
      : supabase
          .from('lab_product_costs')
          .select('material_id, lab_cost, pontic_cost, pink_cost')
          .eq('lab_org_id', partner.id),

    supabase
      .from('billing_adjustments')
      .select('order_item_id, amount, reason')
      .eq('party_org_id', partner.id),
  ]);

  if (orders.error || !orders.data) return empty(from, to);

  // ---------- 단가표를 (종류/재료) 로 펼칩니다 ----------
  interface PriceRow {
    price: number | null;
    ponticPrice: number | null;
    pinkPrice: number | null;
  }

  const byId = new Map<string, PriceRow>();

  for (const row of (overrides.data ?? []) as Record<string, unknown>[]) {
    byId.set(row.material_id as string, {
      price: (isClinic ? row.price : row.lab_cost) as number | null,
      ponticPrice: (isClinic ? row.pontic_price : row.pontic_cost) as number | null,
      pinkPrice: (isClinic ? row.pink_price : row.pink_cost) as number | null,
    });
  }

  const byCode = new Map<string, PriceRow>();

  for (const raw of (prices.data ?? []) as unknown as {
    id: string;
    code: string;
    price?: number | null;
    pontic_price?: number | null;
    pink_price?: number | null;
    prosthesis_types?: { code: string };
    type_code?: string;
  }[]) {
    const typeCode = raw.prosthesis_types?.code ?? raw.type_code ?? '';
    const over = byId.get(raw.id);

    /*
      ★ 기공소에는 제품 기본가를 쓰지 않습니다.
        prosthesis_materials.price 는 **치과에 파는 값**입니다 (제품탭 '판매 가격').
        기공원가는 사용자탭에서 기공소마다 따로 넣습니다.

        전에는 두 쪽 모두 기본가로 떨어지게 두었더니, 기공원가를 안 정한
        칸이 **치과 판매가 그대로** 잡혔습니다 — 5만원에 팔고 5만원을
        지급하는 셈입니다. 안 정했으면 0원이 아니라 '미정' 이어야 합니다.

      ★ `??` 여야 합니다. `||` 로 이으면 0원 거래처 단가가 기본가로 새어 나갑니다.
    */
    byCode.set(`${typeCode}/${raw.code}`, {
      price: resolvePartyPrice(raw.price ?? null, over?.price ?? null, partner.orgType),
      ponticPrice: resolvePartyPrice(
        raw.pontic_price ?? null,
        over?.ponticPrice ?? null,
        partner.orgType,
      ),
      pinkPrice: resolvePartyPrice(
        raw.pink_price ?? null,
        over?.pinkPrice ?? null,
        partner.orgType,
      ),
    });
  }

  const adjByItem = new Map<string, { amount: number; reasons: string[] }>();

  for (const row of ((adjustments.data ?? []) as {
    order_item_id: string | null;
    amount: number;
    reason: string | null;
  }[])) {
    if (!row.order_item_id) continue;

    const found = adjByItem.get(row.order_item_id) ?? { amount: 0, reasons: [] };
    found.amount += row.amount;
    if (row.reason) found.reasons.push(row.reason);

    adjByItem.set(row.order_item_id, found);
  }

  // ---------- 줄을 폅니다 ----------
  const items: SettlementItem[] = [];

  for (const order of orders.data as unknown as RawOrder[]) {
    for (const raw of order.order_items ?? []) {
      const price = byCode.get(`${raw.type_code}/${raw.material_code}`) ?? {
        price: null,
        ponticPrice: null,
        pinkPrice: null,
      };

      // ★ 리메이크·리페어는 셈하지 않습니다. 0원으로 목록에만 남습니다
      const money: ItemAmount = order.is_billable
        ? itemAmount({ isPontic: raw.is_pontic, hasGingival: raw.has_gingival, ...price })
        : { amount: 0, unpriced: false };

      const abbr = buildAbbr(catalog, raw.type_code, raw.material_code);

      items.push({
        orderId: order.id,
        itemId: raw.id,
        orderNo: order.order_no,
        receivedAt: order.received_at,
        shippedAt: order.shipped_at,
        patientLabel: order.patient_label,
        remakeSeq: order.remake_seq,
        isRemake: order.is_remake,
        billable: order.is_billable,
        typeCode: raw.type_code,
        materialCode: raw.material_code,
        label: raw.is_pontic ? `${abbr} (Pontic)` : abbr,
        toothNumber: raw.tooth_number,
        isPontic: raw.is_pontic,
        hasGingival: raw.has_gingival,
        amount: money.amount,
        unpriced: money.unpriced,
        adjustment: adjByItem.get(raw.id)?.amount ?? 0,
        adjustmentReason: (adjByItem.get(raw.id)?.reasons ?? []).join(' · '),
        ...price,
      });
    }
  }

  // ---------- 제품별로 묶습니다 (청구 내역) ----------
  const grouped = new Map<string, SettlementProduct>();

  for (const item of items) {
    // 리메이크는 제품별 집계에서 따로 세지 않습니다 — 세부내역에만 나옵니다
    if (!item.billable) continue;

    const key = item.label;
    const found = grouped.get(key);

    if (found) {
      found.count += 1;
      found.amount += item.amount + item.adjustment;
      found.unpriced = found.unpriced || item.unpriced;
    } else {
      grouped.set(key, {
        key,
        label: key,
        count: 1,
        amount: item.amount + item.adjustment,
        unpriced: item.unpriced,
      });
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const adjustment = items.reduce((sum, i) => sum + i.adjustment, 0);

  return {
    from,
    to,
    items,
    products: [...grouped.values()].sort((a, b) => b.amount - a.amount),
    subtotal,
    adjustment,
    total: subtotal + adjustment,
    unpricedCount: items.filter((i) => i.unpriced).length,
    bridgeOf: await loadBridgeMap(items.map((i) => i.orderId)),
  };
}

function empty(from: string, to: string): Settlement {
  return {
    from,
    to,
    items: [],
    products: [],
    subtotal: 0,
    adjustment: 0,
    total: 0,
    unpricedCount: 0,
    bridgeOf: {},
  };
}

/**
 * 이 주문들의 브릿지 묶음. { order_item_id: bridge_id }
 *
 * ★ 저장된 것을 그대로 읽습니다.
 *   computeBridges 로 다시 계산하면, 사용자가 화면에서 손으로 끊어 둔
 *   연결(severedKeys)이 무시돼 도로 이어집니다.
 */
async function loadBridgeMap(orderIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(orderIds)];
  if (ids.length === 0) return {};

  const supabase = await createClient();

  const { data } = await supabase
    .from('order_bridges')
    .select('id, order_bridge_members(order_item_id)')
    .in('order_id', ids);

  const map: Record<string, string> = {};

  for (const bridge of (data ?? []) as unknown as {
    id: string;
    order_bridge_members: { order_item_id: string }[] | null;
  }[]) {
    for (const member of bridge.order_bridge_members ?? []) {
      map[member.order_item_id] = bridge.id;
    }
  }

  return map;
}

// ---------- 마감 상태 ----------

export interface PeriodState {
  yearMonth: string;
  closedAt: string | null;
  issuedAt: string | null;
  paidAt: string | null;
}

/** 이 거래처의 마감 기록. 줄이 없는 달은 아직 열려 있습니다 */
export async function listPeriods(partyOrgId: string): Promise<PeriodState[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('billing_periods')
    .select('year_month, closed_at, issued_at, paid_at')
    .eq('party_org_id', partyOrgId)
    .order('year_month', { ascending: false });

  if (error || !data) return [];

  return (data as { year_month: string; closed_at: string | null; issued_at: string | null; paid_at: string | null }[]).map(
    (row) => ({
      yearMonth: row.year_month,
      closedAt: row.closed_at,
      issuedAt: row.issued_at,
      paidAt: row.paid_at,
    }),
  );
}

// ---------- 마감된 기간은 굳은 줄에서 읽습니다 ----------

/**
 * 마감된 기간의 정산.
 *
 * ★ 주문에서 다시 세지 않습니다.
 *   마감한 뒤에 단가를 고치거나 주문을 손대도 지난 청구서는 그대로여야
 *   합니다. 굳은 줄만 읽으면 그 약속이 저절로 지켜집니다.
 *
 * ★ 환자·치식은 주문에서 함께 읽어 옵니다.
 *   금액은 굳었지만 '누구의 몇 번 이빨' 은 바뀌지 않는 사실입니다.
 *   굳은 줄에 복사해 두면 같은 것이 두 곳에 남습니다.
 */
export async function getClosedSettlement(
  periodId: string,
  from: string,
  to: string,
  catalog: ProsthesisCatalog,
): Promise<Settlement> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('billing_lines')
    .select(
      'id, kind, amount, reason, order_id, order_item_id, ' +
        'order:orders!inner(order_no, received_at, shipped_at, patient_label, is_remake, remake_seq, is_billable), ' +
        'item:order_items(tooth_number, type_code, material_code, is_pontic, has_gingival)',
    )
    .eq('period_id', periodId);

  if (error || !data) return empty(from, to);

  interface RawLine {
    id: string;
    kind: string;
    amount: number;
    reason: string | null;
    order_id: string;
    order_item_id: string | null;
    order: {
      order_no: string;
      received_at: string | null;
      shipped_at: string;
      patient_label: string;
      is_remake: boolean;
      remake_seq: number;
      is_billable: boolean;
    };
    item: {
      tooth_number: number;
      type_code: string;
      material_code: string;
      is_pontic: boolean;
      has_gingival: boolean;
    } | null;
  }

  // 한 보철에 base·surcharge·adjustment 가 여러 줄일 수 있어 다시 묶습니다
  const byItem = new Map<string, SettlementItem>();
  let adjustment = 0;

  for (const line of data as unknown as RawLine[]) {
    if (line.kind === 'adjustment') adjustment += line.amount;

    const key = line.order_item_id ?? `${line.order_id}:${line.kind}`;
    const found = byItem.get(key);

    if (found) {
      if (line.kind === 'adjustment') {
        found.adjustment += line.amount;
        found.adjustmentReason = [found.adjustmentReason, line.reason]
          .filter(Boolean)
          .join(' · ');
      } else {
        found.amount += line.amount;
      }
      continue;
    }

    const abbr = line.item
      ? buildAbbr(catalog, line.item.type_code, line.item.material_code)
      : '기타';

    byItem.set(key, {
      orderId: line.order_id,
      itemId: line.order_item_id ?? line.id,
      orderNo: line.order.order_no,
      receivedAt: line.order.received_at,
      shippedAt: line.order.shipped_at,
      patientLabel: line.order.patient_label,
      remakeSeq: line.order.remake_seq,
      isRemake: line.order.is_remake,
      billable: line.order.is_billable,
      typeCode: line.item?.type_code ?? '',
      materialCode: line.item?.material_code ?? '',
      label: line.item?.is_pontic ? `${abbr} (Pontic)` : abbr,
      toothNumber: line.item?.tooth_number ?? 0,
      isPontic: line.item?.is_pontic ?? false,
      hasGingival: line.item?.has_gingival ?? false,
      amount: line.kind === 'adjustment' ? 0 : line.amount,
      unpriced: false, // 굳은 값입니다. 지금 단가와 견주지 않습니다
      adjustment: line.kind === 'adjustment' ? line.amount : 0,
      adjustmentReason: line.kind === 'adjustment' ? (line.reason ?? '') : '',
      price: null,
      ponticPrice: null,
      pinkPrice: null,
    });
  }

  const items = [...byItem.values()].sort((a, b) => (a.shippedAt < b.shippedAt ? 1 : -1));
  const grouped = new Map<string, SettlementProduct>();

  for (const item of items) {
    // 열린 기간과 같은 규칙입니다 — 리메이크는 세부내역에만 나옵니다
    if (!item.billable) continue;

    const found = grouped.get(item.label);

    if (found) {
      found.count += 1;
      found.amount += item.amount + item.adjustment;
    } else {
      grouped.set(item.label, {
        key: item.label,
        label: item.label,
        count: 1,
        amount: item.amount + item.adjustment,
        unpriced: false,
      });
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

  return {
    from,
    to,
    items,
    products: [...grouped.values()].sort((a, b) => b.amount - a.amount),
    subtotal,
    adjustment,
    total: subtotal + adjustment,
    unpricedCount: 0,
    bridgeOf: await loadBridgeMap(items.map((i) => i.orderId)),
  };
}

/** 이 기간의 마감 기록 하나 */
export async function getPeriod(
  partyOrgId: string,
  yearMonth: string,
): Promise<{ id: string; closedAt: string | null; issuedAt: string | null; paidAt: string | null } | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('billing_periods')
    .select('id, closed_at, issued_at, paid_at')
    .eq('party_org_id', partyOrgId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  const row = data as {
    id: string;
    closed_at: string | null;
    issued_at: string | null;
    paid_at: string | null;
  } | null;

  if (!row) return null;

  return { id: row.id, closedAt: row.closed_at, issuedAt: row.issued_at, paidAt: row.paid_at };
}

/** 이 달에 이미 마감한 거래처 id 들 */
export async function listClosedParties(yearMonth: string): Promise<Set<string>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('billing_periods')
    .select('party_org_id')
    .eq('year_month', yearMonth)
    .not('closed_at', 'is', null);

  return new Set(((data ?? []) as { party_org_id: string }[]).map((r) => r.party_org_id));
}
