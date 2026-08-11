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
