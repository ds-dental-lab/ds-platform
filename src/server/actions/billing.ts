// =========================================================
// 놓을 위치: src/server/actions/billing.ts
//
// 정산 마감 · 마감 되돌리기. 디자인센터만 합니다.
// 실제 규칙은 domain/billing 과 services/billing 이 정합니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import {
  closeBillingPeriod,
  reopenBillingPeriod,
  closeManyPeriods,
  type BulkCloseRow,
} from '@/server/services/billing';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { checkAdjustment } from '@/server/domain/billing';

export type BillingResult =
  | { ok: true; lines: number; amount: number }
  | { ok: false; error: string };

function refresh() {
  revalidatePath('/design/billing');
  revalidatePath('/design', 'layout');
}

export async function submitCloseBilling(
  partyOrgId: string,
  yearMonth: string,
): Promise<BillingResult> {
  const result = await closeBillingPeriod(partyOrgId, yearMonth);
  if (result.ok) refresh();
  return result;
}

export async function submitReopenBilling(
  partyOrgId: string,
  yearMonth: string,
): Promise<BillingResult> {
  const result = await reopenBillingPeriod(partyOrgId, yearMonth);
  if (result.ok) refresh();
  return result;
}

export type BulkResult = { rows: BulkCloseRow[] };

/**
 * 기준일이 같은 거래처를 한 번에 마감합니다.
 *
 * ★ 하나가 실패해도 나머지는 갑니다.
 *   무엇이 안 됐는지 줄마다 돌려주니, 그것만 따로 손보면 됩니다.
 */
export async function submitCloseMany(
  yearMonth: string,
  closingDay: number,
): Promise<BulkResult> {
  const result = await closeManyPeriods(yearMonth, closingDay);
  refresh();
  return { rows: result.rows };
}

// ---------- 금액 조정 (몽키스패너) ----------

export type AdjustResult = { ok: true } | { ok: false; error: string };

/**
 * 보철 한 줄의 금액을 손으로 고칩니다.
 *
 * ★ 원금액은 그대로 두고 차액을 덧댑니다.
 *   덮어쓰면 "얼마였는데 왜 깎았나" 가 사라집니다.
 *
 * ★ 마감된 기간에는 못 넣습니다.
 *   이미 나간 청구서의 숫자가 달라지면 안 됩니다. 그 뒤에 생긴 조정은
 *   다음 열린 기간에 붙습니다 — 그 길은 정산줄이 맡습니다.
 */
export async function submitAdjustItem(input: {
  orderItemId: string;
  partyOrgId: string;
  amount: number;
  reason: string;
}): Promise<AdjustResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, error: '디자인센터만 금액을 조정할 수 있습니다' };
  }

  const verdict = checkAdjustment(input.amount, input.reason);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createClient();

  // 그 보철이 어느 주문의 것인지 — RLS 가 남의 주문을 0행으로 막습니다
  const { data: item } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('id', input.orderItemId)
    .maybeSingle();

  if (!item) return { ok: false, error: '보철을 찾을 수 없습니다' };

  const { error } = await supabase.from('billing_adjustments').insert({
    owner_org_id: session.orgId,
    order_id: (item as { order_id: string }).order_id,
    order_item_id: input.orderItemId,
    party_org_id: input.partyOrgId,
    amount: input.amount,
    reason: input.reason.trim(),
    created_by: session.user.id,
  });

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };

  refresh();
  return { ok: true };
}

/** 아직 안 굳은 조정을 지웁니다 */
export async function submitRemoveAdjustments(orderItemId: string): Promise<AdjustResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center') {
    return { ok: false, error: '디자인센터만 지울 수 있습니다' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('billing_adjustments')
    .delete()
    .eq('order_item_id', orderItemId)
    .is('posted_line_id', null);

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };

  refresh();
  return { ok: true };
}

// ---------- 청구서 발행 ----------

/**
 * 청구서를 뽑았다고 표시합니다.
 *
 * ★ 발행하면 마감을 되돌릴 수 없습니다.
 *   한 번 나간 문서의 숫자가 나중에 달라지면 신뢰가 무너집니다.
 */
export async function submitIssueInvoice(
  partyOrgId: string,
  yearMonth: string,
): Promise<BillingResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, error: '디자인센터만 발행할 수 있습니다' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('billing_periods')
    .update({ issued_at: new Date().toISOString() })
    .eq('party_org_id', partyOrgId)
    .eq('year_month', yearMonth)
    .not('closed_at', 'is', null) // 마감한 것만 뽑습니다
    .is('issued_at', null)
    .select('id');

  if (error) return { ok: false, error: `발행하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '마감된 기간만 발행할 수 있습니다' };
  }

  refresh();
  return { ok: true, lines: 0, amount: 0 };
}

/** 입금 확인 */
export async function submitMarkPaid(
  partyOrgId: string,
  yearMonth: string,
  paid: boolean,
): Promise<BillingResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, error: '디자인센터만 표시할 수 있습니다' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('billing_periods')
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('party_org_id', partyOrgId)
    .eq('year_month', yearMonth)
    .select('id');

  if (error) return { ok: false, error: `바꾸지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '기간을 찾을 수 없습니다' };

  refresh();
  return { ok: true, lines: 0, amount: 0 };
}
