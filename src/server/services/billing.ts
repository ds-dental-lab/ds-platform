// =========================================================
// 놓을 위치: src/server/services/billing.ts
//
// 정산 마감. 지금까지의 셈을 줄로 굳힙니다.
//
// ★ 열린 기간은 표에 줄이 없습니다.
//   주문에서 그때그때 셉니다 — 주문이 바뀌면 금액도 따라 바뀝니다.
//   마감을 누르는 순간의 결과를 billing_lines 로 박아 두면,
//   그 뒤에 단가를 고치든 주문을 손대든 지난 청구서는 그대로입니다.
//
// ★ 마감된 기간은 DB 가 막습니다.
//   billing_lines 에 트리거가 걸려 있어, 서버 코드가 실수해도
//   닫힌 기간에는 줄이 안 들어갑니다 (설계서 §5.3 결정 2).
//   그래서 줄을 **먼저 넣고 마지막에 닫습니다**.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { getPartner, type PartnerRow } from '@/server/repositories/partner';
import { getSettlement } from '@/server/repositories/billing';
import {
  periodRange,
  canClosePeriod,
  canReopenPeriod,
  splitItemLines,
  isValidYearMonth,
  type YearMonth,
} from '@/server/domain/billing';
import { todayInKst } from '@/server/domain/week';

export type CloseResult =
  | { ok: true; lines: number; amount: number }
  | { ok: false; error: string };

/**
 * 거래처 하나의 한 기간을 마감합니다.
 *
 * 순서가 중요합니다 —
 *   ① 기간 줄을 엽니다 (아직 안 닫힌 채로)
 *   ② 금액 줄을 넣습니다
 *   ③ 마지막에 닫습니다
 *
 * ★ 거꾸로 하면 트리거에 막힙니다.
 *   닫힌 기간에는 줄을 못 넣게 해 둔 것이 여기서도 그대로 걸립니다.
 */
export async function closeBillingPeriod(
  partyOrgId: string,
  yearMonth: YearMonth,
): Promise<CloseResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, error: '디자인센터만 마감할 수 있습니다' };
  }

  if (!isValidYearMonth(yearMonth)) return { ok: false, error: '정산 달이 올바르지 않습니다' };

  const partner = await getPartner(partyOrgId);
  if (!partner) return { ok: false, error: '거래처를 찾을 수 없습니다' };

  const supabase = await createClient();
  const range = periodRange(yearMonth, partner.closingDay);

  // 이미 닫혀 있는가
  const { data: existing } = await supabase
    .from('billing_periods')
    .select('id, closed_at')
    .eq('party_org_id', partyOrgId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  const found = existing as { id: string; closed_at: string | null } | null;

  const verdict = canClosePeriod(range, todayInKst(), Boolean(found?.closed_at));
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  // ---------- ① 기간 줄 ----------
  //
  // ★ 그때의 기준일과 날짜를 박아 둡니다.
  //   치과가 나중에 26일을 1일로 바꿔도 이미 나간 청구서의
  //   '이용기간' 이 소급해서 달라지면 안 됩니다.
  let periodId: string | undefined = found?.id;

  if (!periodId) {
    const { data, error } = await supabase
      .from('billing_periods')
      .insert({
        owner_org_id: session.orgId,
        party_org_id: partyOrgId,
        year_month: yearMonth,
        closing_day: partner.closingDay,
        period_from: range.from,
        period_to: range.to,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: `기간을 열지 못했습니다: ${error?.message}` };
    }
    periodId = data.id;
  }

  // 위에서 반드시 채워집니다 — 아래 줄들이 이 값을 가리킵니다
  const openPeriodId = periodId as string;

  // ---------- ② 금액 줄 ----------
  const catalog = await getProsthesisCatalog({ includeInactive: true });
  const settlement = await getSettlement(partner, range.from, range.to, catalog);

  // 다시 눌렀을 때 겹치지 않게 비우고 새로 넣습니다 (아직 열려 있어 지울 수 있습니다)
  await supabase.from('billing_lines').delete().eq('period_id', openPeriodId);

  const rows = settlement.items.flatMap((item) =>
    // 조회에 쓴 단가를 그대로 넘깁니다 — 합계에서 거꾸로 쪼개지 않습니다.
    // ★ 리메이크·리페어는 단가를 안 넘겨 0원 줄로 굳습니다.
    //   목록에는 남아야 하지만 돈은 받지 않습니다.
    splitItemLines({
      isPontic: item.isPontic,
      hasGingival: item.hasGingival,
      price: item.billable ? item.price : null,
      ponticPrice: item.billable ? item.ponticPrice : null,
      pinkPrice: item.billable ? item.pinkPrice : null,
    }).map((line) => ({
      period_id: openPeriodId,
      order_id: item.orderId,
      order_item_id: item.itemId,
      kind: line.kind,
      amount: line.amount,
      reason: line.reason ?? null,
      created_by: session.user.id,
    })),
  );

  // 손으로 넣은 조정도 함께 굳힙니다
  for (const item of settlement.items) {
    if (item.adjustment === 0) continue;

    rows.push({
      period_id: openPeriodId,
      order_id: item.orderId,
      order_item_id: item.itemId,
      kind: 'adjustment',
      amount: item.adjustment,
      // ★ 사람이 적은 사유를 그대로 굳힙니다. 청구서에 실릴 말입니다
      reason: item.adjustmentReason || '금액 조정',
      created_by: session.user.id,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('billing_lines').insert(rows);
    if (error) return { ok: false, error: `정산줄을 넣지 못했습니다: ${error.message}` };
  }

  // ---------- ③ 닫기 ----------
  const { data: closed, error: closeError } = await supabase
    .from('billing_periods')
    .update({ closed_at: new Date().toISOString(), closed_by: session.user.id })
    .eq('id', openPeriodId)
    .is('closed_at', null) // 그 사이 남이 먼저 닫았으면 아무것도 안 합니다
    .select('id');

  if (closeError) return { ok: false, error: `마감하지 못했습니다: ${closeError.message}` };
  if (!closed || closed.length === 0) return { ok: false, error: '이미 마감된 기간입니다' };

  return { ok: true, lines: rows.length, amount: settlement.total };
}

/**
 * 마감을 되돌립니다.
 *
 * ★ 청구서를 뽑기 전까지입니다.
 *   잘못 눌렀을 때 손쓸 길이 없으면 그게 더 위험합니다.
 *   한 번 나간 청구서라면 숫자가 달라지면 안 되므로 막습니다.
 */
export async function reopenBillingPeriod(
  partyOrgId: string,
  yearMonth: YearMonth,
): Promise<CloseResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, error: '디자인센터만 되돌릴 수 있습니다' };
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from('billing_periods')
    .select('id, closed_at, issued_at')
    .eq('party_org_id', partyOrgId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  const period = data as { id: string; closed_at: string | null; issued_at: string | null } | null;
  if (!period) return { ok: false, error: '마감 기록이 없습니다' };

  const verdict = canReopenPeriod({ closedAt: period.closed_at, issuedAt: period.issued_at });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  // ★ 먼저 열고 줄을 지웁니다. 닫힌 채로는 트리거가 막습니다
  const { error: openError } = await supabase
    .from('billing_periods')
    .update({ closed_at: null, closed_by: null })
    .eq('id', period.id);

  if (openError) return { ok: false, error: `되돌리지 못했습니다: ${openError.message}` };

  await supabase.from('billing_lines').delete().eq('period_id', period.id);

  return { ok: true, lines: 0, amount: 0 };
}

// ---------- 한꺼번에 마감 ----------

export interface BulkCloseRow {
  partyOrgId: string;
  name: string;
  ok: boolean;
  /** 못 했으면 이유 */
  error?: string;
  amount: number;
}

/**
 * 기준일이 같은 거래처를 한 번에 마감합니다.
 *
 * ★ 하나씩 누를 수 없습니다.
 *   거래 치과가 쉰 곳이면 매달 쉰 번을 눌러야 합니다.
 *   기준일이 같으면 마감일도 같으니 묶는 것이 자연스럽습니다.
 *
 * ★ 하나가 실패해도 나머지는 갑니다.
 *   한 곳의 단가가 비어 있다고 마흔아홉 곳이 멈추면 안 됩니다.
 *   무엇이 안 됐는지는 줄마다 돌려줍니다.
 */
export async function closeManyPeriods(
  yearMonth: YearMonth,
  closingDay: number,
): Promise<{ ok: boolean; rows: BulkCloseRow[] }> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, rows: [] };
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from('organizations')
    .select('id, name, org_type, closing_day, status')
    .in('org_type', ['clinic', 'lab'])
    .eq('closing_day', closingDay)
    .is('deleted_at', null)
    .neq('id', session.orgId);

  const parties = (data ?? []) as { id: string; name: string }[];
  const rows: BulkCloseRow[] = [];

  for (const party of parties) {
    const result = await closeBillingPeriod(party.id, yearMonth);

    rows.push({
      partyOrgId: party.id,
      name: party.name,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
      amount: result.ok ? result.amount : 0,
    });
  }

  return { ok: rows.some((r) => r.ok), rows };
}

export type { PartnerRow };
