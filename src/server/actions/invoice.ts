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
import { checkPayment, summarize } from '@/server/domain/invoice';

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
    .select('period_id, amount')
    .eq('id', paymentId)
    .maybeSingle();

  const row = data as { period_id: string; amount: number } | null;
  if (!row) return { ok: false, error: '입금 기록을 찾을 수 없습니다' };

  const { error } = await supabase.from('billing_payments').insert({
    period_id: row.period_id,
    amount: -row.amount,
    memo: '되돌림',
    created_by: session.user.id,
  });

  if (error) return { ok: false, error: `되돌리지 못했습니다: ${error.message}` };

  await syncPaidAt(supabase, row.period_id);
  refresh();

  return { ok: true };
}

// ---------- 재발송 ----------

/**
 * 다시 보냈다고 적습니다.
 *
 * ★ 지금은 **기록만** 합니다. 실제로 메일이 나가지 않습니다.
 *   발송 서비스(도메인·API 키)가 아직 없습니다. 그때까지는 사람이
 *   보내고 여기에 눌러 둡니다 — "언제 다시 보냈나" 가 남아야 "안 왔다"
 *   는 말에 답할 수 있습니다. 발송이 붙으면 이 함수 안에서 보냅니다.
 */
export async function submitResend(periodId: string): Promise<InvoiceActionResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 보낼 수 있습니다' };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from('billing_periods')
    .select('sent_count')
    .eq('id', periodId)
    .maybeSingle();

  const count = (before as { sent_count: number } | null)?.sent_count ?? 0;

  const { data, error } = await supabase
    .from('billing_periods')
    .update({ sent_count: count + 1, last_sent_at: new Date().toISOString() })
    .eq('id', periodId)
    .not('issued_at', 'is', null)
    .select('id');

  if (error) return { ok: false, error: `적지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '발행된 청구서가 아닙니다' };

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

  const { data: payments } = await supabase
    .from('billing_payments')
    .select('id')
    .eq('period_id', periodId)
    .limit(1);

  if (payments && payments.length > 0) {
    return { ok: false, error: '입금이 적힌 청구서입니다. 입금을 먼저 되돌려 주세요' };
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
