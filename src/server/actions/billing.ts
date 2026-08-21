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
import { todayInKst } from '@/server/domain/week';
import { paymentDueDate } from '@/server/domain/invoice';
import { missingContact, wantsEmail, type InvoiceMethod } from '@/server/domain/invoice-method';
import { checkAdjustment } from '@/server/domain/billing';
import { sendInvoiceNotice } from '@/server/mail/invoice-notice';

export type BillingResult =
  | {
      ok: true;
      lines: number;
      amount: number;
      /**
       * 청구서 메일이 나간 주소. 발행에서만 채워집니다.
       *
       * ★ 발행은 됐다고 끝이 아닙니다. 화면이 "어디로 보냈는지" 를
       *   말해 줘야 사람이 "그 주소 아닌데" 를 알아챕니다.
       */
      mailSentTo?: string;
      /**
       * 발행은 됐지만 메일이 못 나간 이유.
       *
       * ★★ 이것이 있어도 **발행은 성공**입니다. 돈 문서는 확정됐고
       *   메일만 못 갔습니다. 되돌리면 번호만 태웁니다 — 대신 왜
       *   못 갔는지를 그대로 보여 주고 다시 보내게 합니다.
       */
      mailFailed?: string;
    }
  | { ok: false; error: string };

function refresh() {
  revalidatePath('/design/billing');
  revalidatePath('/design', 'layout');
}

/**
 * 마감만 하기.
 *
 * ★ **화면에서 부르는 곳이 없습니다** (2026-08-13). 정산 화면의 마감
 *   단추를 없애고 발행이 마감까지 하도록 바꿨습니다. 일괄 마감은
 *   서비스(closeManyPeriods)를 직접 씁니다.
 *   그래도 지우지 않고 둡니다 — 마감과 발행을 다시 갈라야 할 때
 *   돌아올 자리이고, 규칙은 전부 서비스 쪽에 있어 이 함수 자체는
 *   껍데기 세 줄입니다.
 */
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
 *
 * ★ 이때 청구서가 '문서' 가 됩니다 — 번호 · 납부기한 · 받는 곳이 붙습니다.
 *   받는 곳(이메일/팩스)을 **여기서 베껴 둡니다.** 치과가 나중에 이메일을
 *   바꿔도, 지난 청구서가 "새 주소로 보냈다" 고 말하면 안 됩니다.
 *   금액을 billing_lines 로 굳히는 것과 같은 이유입니다.
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

  // 발행 시점의 받는 곳
  const { data: org } = await supabase
    .from('organizations')
    .select('invoice_method, invoice_email, fax')
    .eq('id', partyOrgId)
    .maybeSingle();

  const contact = org as {
    invoice_method: InvoiceMethod;
    invoice_email: string | null;
    fax: string | null;
  } | null;

  const method = contact?.invoice_method ?? 'all';

  /*
    ★ 갈 데가 없으면 발행을 막습니다.
      번호까지 붙여 놓고 아무 데도 안 가면, 목록에는 '보냄' 으로 남고
      치과는 못 받은 채 납부기한이 지납니다.
  */
  const missing = missingContact({
    method,
    email: contact?.invoice_email ?? null,
    fax: contact?.fax ?? null,
  });

  if (missing.length > 0) {
    return {
      ok: false,
      error:
        `정산서 받을 곳이 비어 있습니다 (${missing.includes('email') ? '이메일' : ''}` +
        `${missing.length === 2 ? '·' : ''}${missing.includes('fax') ? '팩스' : ''}). ` +
        '위에서 넣고 다시 눌러 주세요',
    };
  }

  // 이메일이 먼저입니다 — 둘 다면 이메일로 갑니다
  const sentTo = wantsEmail(method) ? contact?.invoice_email : contact?.fax;

  /*
    ★ 아직 안 닫혔으면 **여기서 닫습니다** (사용자 요청 2026-08-13 —
      "마감 > 청구서보기 > 발행, 너무 길다").
      마감은 없어진 것이 아니라 발행 안으로 들어왔습니다. 금액을
      billing_lines 로 굳히는 일은 그대로 일어납니다 — 그게 없으면
      나중에 단가를 고쳤을 때 이미 나간 청구서의 숫자가 달라집니다.

    ★ **받는 곳 검사 뒤에** 닫습니다.
      먼저 닫고 나서 이메일이 없어 실패하면, 닫히기만 하고 안 나간
      기간이 남습니다 — 바로 그 어정쩡한 상태를 없애려는 변경입니다.

    ★ 닫는 데 실패하면 발행도 안 합니다.
      기간이 안 끝났거나 · 청구할 건이 없거나 · 단가가 빈 줄이 있으면
      closeBillingPeriod 가 막습니다. 그 판단을 여기서 다시 쓰지 않고
      그대로 돌려줍니다 — 규칙이 두 곳에 생기면 언젠가 어긋납니다.
  */
  const { data: before } = await supabase
    .from('billing_periods')
    .select('closed_at')
    .eq('party_org_id', partyOrgId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  if (!(before as { closed_at: string | null } | null)?.closed_at) {
    const closed = await closeBillingPeriod(partyOrgId, yearMonth);
    if (!closed.ok) return { ok: false, error: closed.error };
  }

  const { data: no, error: noError } = await supabase.rpc('next_invoice_no');
  if (noError || !no) return { ok: false, error: '청구서 번호를 만들지 못했습니다' };

  const today = todayInKst();

  const { data, error } = await supabase
    .from('billing_periods')
    .update({
      issued_at: new Date().toISOString(),
      invoice_no: no as string,
      invoice_method: method,
      invoice_to: sentTo ?? null,
      due_date: paymentDueDate(today),
    })
    .eq('party_org_id', partyOrgId)
    .eq('year_month', yearMonth)
    .not('closed_at', 'is', null) // 마감한 것만 뽑습니다
    .is('issued_at', null)
    .select('id');

  if (error) return { ok: false, error: `발행하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    /* 여기까지 왔는데 안 걸리는 경우는 '이미 발행됨' 뿐입니다 —
       마감은 바로 위에서 해 놓았습니다 */
    return { ok: false, error: '이미 발행한 기간입니다' };
  }

  /*
    ★ 발행과 동시에 메일이 나갑니다 (사용자 결정 2026-08-21).
      버튼을 따로 두면 누르는 것을 잊고, 치과는 청구서를 영영 못 받습니다.

    ★★ **메일이 안 나가도 발행은 그대로 둡니다.**
      발행은 돈 문서를 확정하는 일이고 메일은 곁다리입니다. 되돌리면
      번호만 태우고 아무것도 안 남습니다. 대신 **왜 안 나갔는지를
      그대로 알립니다** — 사람이 그 자리에서 다시 보낼 수 있게요.
  */
  const notice = await sendInvoiceNotice(data[0].id);

  refresh();

  if (!notice.ok) {
    return { ok: true, lines: 0, amount: 0, mailFailed: notice.reason };
  }

  return { ok: true, lines: 0, amount: 0, mailSentTo: notice.to };
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
