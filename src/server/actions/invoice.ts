// =========================================================
// 놓을 위치: src/server/actions/invoice.ts
//
// 청구 내역의 네 가지 기능 — 내려받기 · 재발송 · 취소 · 정산(입금).
// 내려받기는 화면이 하므로 여기 없습니다.
//
// ★ 입금은 '줄' 로 쌓습니다.
//   반만 들어오는 일이 흔하고, 잘못 적은 것을 지우지 않고 음수로
//   되돌려야 "왜 금액이 달라졌지" 가 남습니다.
//
// ★ paid_at 은 '다 받은 날' 입니다.
//   마지막 입금이 미납을 0 으로 만든 순간에 찍고, 되돌려서 미납이
//   다시 생기면 지웁니다. 상태는 늘 미납이 정합니다 (domain/invoice).
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { checkPayment, summarize, checkCreditReason } from '@/server/domain/invoice';
import { canManageMembers, type MemberRole } from '@/server/domain/member';
import { sendInvoiceNotice } from '@/server/mail/invoice-notice';

export type InvoiceActionResult = { ok: true } | { ok: false; error: string };

async function requireDesign() {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return null;

  return session;
}

function refresh() {
  revalidatePath('/design/billing', 'layout');
  revalidatePath('/clinic/billing', 'layout');
  revalidatePath('/lab/billing', 'layout');
}

// ---------- 정산 (입금) ----------

export interface PaymentInput {
  periodId: string;
  amount: number;
  memo?: string;
}

/**
 * 입금을 적습니다. 미납이 0이 되면 상태가 '완료' 로 바뀝니다.
 *
 * ★ 남은 것보다 많이 넣어도 막지 않습니다.
 *   합쳐 보낸 입금·수수료 때문에 실제로 넘게 들어옵니다. 막으면 사람은
 *   숫자를 고쳐 적고, 그러면 통장과 장부가 영영 안 맞습니다.
 */
export async function submitPayment(input: PaymentInput): Promise<InvoiceActionResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 적을 수 있습니다' };

  const supabase = await createClient();

  const money = await loadMoney(supabase, input.periodId);
  if (!money) return { ok: false, error: '청구서를 찾을 수 없습니다' };

  const verdict = checkPayment(input.amount, money.unpaid);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const { error } = await supabase.from('billing_payments').insert({
    period_id: input.periodId,
    amount: input.amount,
    memo: input.memo?.trim() || null,
    created_by: session.user.id,
  });

  if (error) return { ok: false, error: `적지 못했습니다: ${error.message}` };

  await syncPaidAt(supabase, input.periodId);
  refresh();

  return { ok: true };
}

/** 잘못 적은 입금을 되돌립니다 (지우지 않고 음수 줄을 넣습니다) */
export async function submitUndoPayment(paymentId: string): Promise<InvoiceActionResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 되돌릴 수 있습니다' };

  const supabase = await createClient();

  const { data } = await supabase
    .from('billing_payments')
    .select('period_id, amount, reverses_payment_id')
    .eq('id', paymentId)
    .maybeSingle();

  const row = data as {
    period_id: string;
    amount: number;
    reverses_payment_id: string | null;
  } | null;

  if (!row) return { ok: false, error: '입금 기록을 찾을 수 없습니다' };

  /*
    ★★ **되돌린 줄을 또 되돌리지 않습니다** (사용자 신고 2026-08-21).
      전에는 누를 때마다 음수 줄이 하나씩 더 생겼습니다. 같은 입금
      하나에 되돌림이 셋 붙어 합계가 10만원 어긋났습니다.
  */
  if (row.reverses_payment_id) {
    return { ok: false, error: '되돌림 줄은 되돌릴 수 없습니다' };
  }

  const { data: already } = await supabase
    .from('billing_payments')
    .select('id')
    .eq('reverses_payment_id', paymentId)
    .limit(1);

  if (already && already.length > 0) {
    return { ok: false, error: '이미 되돌린 입금입니다' };
  }

  const { error } = await supabase.from('billing_payments').insert({
    period_id: row.period_id,
    amount: -row.amount,
    memo: '되돌림',
    created_by: session.user.id,
    // ★ 어느 입금을 되돌린 것인지 적습니다. DB 가 둘째 줄을 막습니다
    reverses_payment_id: paymentId,
  });

  if (error) {
    // 두 사람이 동시에 눌렀을 때 — 고유 색인이 막아 줍니다
    const dup = error.message.includes('billing_payments_reversal_once');
    return { ok: false, error: dup ? '이미 되돌린 입금입니다' : `되돌리지 못했습니다: ${error.message}` };
  }

  await syncPaidAt(supabase, row.period_id);
  refresh();

  return { ok: true };
}

// ---------- 재발송 ----------

/**
 * 청구서를 다시 보냅니다.
 *
 * ★ 전에는 **기록만** 했습니다 — 발송 서비스가 없어서, 사람이 직접
 *   보내고 여기 눌러 두는 용도였습니다. 2026-08-21 에 진짜로 나갑니다.
 *
 * ★ 발행과 **같은 함수**를 씁니다. 두 군데에 따로 적으면 언젠가
 *   한쪽만 고칩니다.
 *
 * ★ 세는 것은 보낸 뒤입니다. 먼저 세면 안 나갔는데 '보냄' 으로 남아
 *   "안 왔다" 는 말에 답할 수 없습니다 (sendInvoiceNotice 안에서 합니다).
 */
export async function submitResend(periodId: string): Promise<InvoiceActionResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 보낼 수 있습니다' };

  const supabase = await createClient();

  const { data } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('id', periodId)
    .not('issued_at', 'is', null)
    .maybeSingle();

  if (!data) return { ok: false, error: '발행된 청구서가 아닙니다' };

  const sent = await sendInvoiceNotice(periodId);
  if (!sent.ok) return { ok: false, error: `보내지 못했습니다: ${sent.reason}` };

  refresh();

  return { ok: true };
}

// ---------- 취소 ----------

/**
 * 발행을 취소합니다 — 마감 상태로 되돌립니다.
 *
 * ★ 입금이 있으면 못 취소합니다.
 *   돈이 들어온 청구서를 없던 일로 만들면 그 입금이 어디에도 안 붙습니다.
 *   되돌리려면 입금부터 되돌려야 합니다.
 *
 * ★ 번호는 안 지웁니다.
 *   INV-26000489 를 지우고 다음 발행이 같은 번호를 받으면, 이미 나간
 *   문서와 새 문서가 같은 번호가 됩니다. 번호는 한 번 나가면 끝입니다.
 *   대신 issued_at 을 비워 목록에서 내립니다.
 */
export async function submitCancelInvoice(periodId: string): Promise<InvoiceActionResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 취소할 수 있습니다' };

  const supabase = await createClient();

  /*
    ★★ **줄 수가 아니라 남은 금액으로 봅니다** (사용자 신고 2026-08-21).

      전에는 '입금 줄이 하나라도 있으면' 막고 "입금을 먼저 되돌려
      주세요" 라고 말했습니다. 그런데 되돌리기는 줄을 지우지 않고
      음수 줄을 **더 만듭니다**. 시키는 대로 할수록 줄이 늘어 더
      못 하게 되는 안내였습니다.

      다 되돌렸으면 남은 금액이 0 입니다 — 그때는 취소해도 됩니다.
      기록은 그대로 남습니다(지우지 않는 것이 이 표의 규칙입니다).
  */
  const { data: payRows } = await supabase
    .from('billing_payments')
    .select('amount')
    .eq('period_id', periodId);

  const paid = ((payRows ?? []) as { amount: number }[]).reduce((sum, r) => sum + r.amount, 0);

  if (paid !== 0) {
    return {
      ok: false,
      error:
        `입금 ${paid.toLocaleString('ko-KR')}원이 남아 있는 청구서입니다. ` +
        '정산내역에서 입금을 되돌린 뒤에 취소해 주세요',
    };
  }

  const { data, error } = await supabase
    .from('billing_periods')
    .update({ issued_at: null, invoice_to: null, due_date: null, paid_at: null })
    .eq('id', periodId)
    .not('issued_at', 'is', null)
    .select('id');

  if (error) return { ok: false, error: `취소하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '발행된 청구서가 아닙니다' };

  refresh();

  return { ok: true };
}

// ---------- 조각들 ----------

async function loadMoney(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periodId: string,
): Promise<{ total: number; unpaid: number } | null> {
  const [lineRes, payRes] = await Promise.all([
    supabase.from('billing_lines').select('amount').eq('period_id', periodId),
    supabase.from('billing_payments').select('amount').eq('period_id', periodId),
  ]);

  if (!lineRes.data) return null;

  const total = (lineRes.data as { amount: number }[]).reduce((sum, r) => sum + r.amount, 0);
  const paid = ((payRes.data ?? []) as { amount: number }[]).map((r) => r.amount);

  return { total, unpaid: summarize(total, paid).unpaid };
}

/** '다 받은 날' 을 미납에 맞춰 켜고 끕니다 */
async function syncPaidAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periodId: string,
): Promise<void> {
  const money = await loadMoney(supabase, periodId);
  if (!money) return;

  await supabase
    .from('billing_periods')
    .update({ paid_at: money.unpaid === 0 ? new Date().toISOString() : null })
    .eq('id', periodId);
}

// ---------- 마이너스 청구서 (CRD-) ----------

/**
 * 이미 나간 청구서를 깎습니다.
 *
 * ★ 원본을 고치지 않습니다. 번호가 붙은 문서를 한 장 더 냅니다.
 *   둘이 나란히 남아야 몇 달 뒤에도 설명이 됩니다.
 *
 * ★ 셈과 번호는 DB 함수가 합니다.
 *   한도(청구액보다 많이 못 깎음)를 여기서 세면, 두 사람이 동시에
 *   누를 때 둘 다 통과합니다. 같은 트랜잭션 안에서 세야 합니다.
 */
export async function submitIssueCredit(
  periodId: string,
  amount: number,
  reason: string,
): Promise<InvoiceActionResult> {
  const denied = await onlyOwnerManager();
  if (denied) return { ok: false, error: denied };

  const reasonVerdict = checkCreditReason(reason);
  if (!reasonVerdict.ok) return { ok: false, error: reasonVerdict.reason };

  const supabase = await createClient();
  const { error } = await supabase.rpc('issue_credit_note', {
    p_period_id: periodId,
    p_amount: Math.trunc(amount),
    p_reason: reason.trim(),
  });

  if (error) return { ok: false, error: tidy(error.message) };

  revalidatePath('/design/billing/invoices');
  revalidatePath('/design/billing', 'layout');
  revalidatePath('/clinic/billing', 'layout');
  revalidatePath('/lab/billing', 'layout');

  return { ok: true };
}

export async function submitCancelCredit(
  creditId: string,
  reason: string,
): Promise<InvoiceActionResult> {
  const denied = await onlyOwnerManager();
  if (denied) return { ok: false, error: denied };

  if (!reason.trim()) return { ok: false, error: '취소 사유를 적어 주세요' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_credit_note', {
    p_id: creditId,
    p_reason: reason.trim(),
  });

  if (error) return { ok: false, error: tidy(error.message) };

  revalidatePath('/design/billing/invoices');
  revalidatePath('/design/billing', 'layout');

  return { ok: true };
}

/** 금액을 만지는 일은 관리자만입니다 */
async function onlyOwnerManager(): Promise<string | null> {
  const session = await getSession();

  if (!canManageMembers(session?.role as MemberRole | null)) {
    return '관리자만 할 수 있습니다';
  }

  return null;
}

/** DB 가 붙이는 'P0001: ' 같은 앞머리를 뗍니다 */
function tidy(message: string): string {
  return message.replace(/^[A-Z0-9]{5}:\s*/, '') || '처리하지 못했습니다';
}
