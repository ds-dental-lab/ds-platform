// =========================================================
// 놓을 위치: src/server/mail/invoice-notice.ts
//
// 발행된 청구서를 실제로 메일로 보냅니다. (사용자 결정 2026-08-21)
//
// ★ 발행 액션과 재발송 액션이 **같은 함수**를 부릅니다.
//   두 군데에 따로 적으면 언젠가 한쪽만 고칩니다 — 주문수정 파일
//   업로드에서 이미 한 번 겪었습니다.
//
// ★★ **던지지 않습니다.** 청구서 '발행' 은 돈 문서를 확정하는
//   일이고 메일은 곁다리입니다. 메일이 안 나갔다고 발행을 되돌리면,
//   번호만 태우고 아무것도 안 남습니다.
//   결과만 돌려주고, 부르는 쪽이 사람에게 알립니다.
// =========================================================

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { sendMail } from '@/server/mail/send';
import { invoiceHtml, invoiceSubject } from '@/server/mail/invoice-mail';
import { wantsEmail, type InvoiceMethod } from '@/server/domain/invoice-method';

export type NoticeResult = { ok: true; to: string } | { ok: false; reason: string };

/** 화면이 있는 곳. 메일 속 링크가 여기로 갑니다 */
function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://denflow.kr');

  return raw.replace(/\/+$/, '');
}

export async function sendInvoiceNotice(periodId: string): Promise<NoticeResult> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('billing_periods')
    .select(
      'id, year_month, invoice_no, invoice_method, invoice_to, due_date, ' +
        'party:organizations!billing_periods_party_org_id_fkey(name, org_type), ' +
        'billing_lines(amount)',
    )
    .eq('id', periodId)
    .maybeSingle();

  const row = data as unknown as {
    year_month: string;
    invoice_no: string | null;
    invoice_method: InvoiceMethod | null;
    invoice_to: string | null;
    due_date: string | null;
    party: { name: string; org_type: string } | null;
    billing_lines: { amount: number }[] | null;
  } | null;

  if (!row) return { ok: false, reason: '청구 기간을 찾을 수 없습니다' };

  /*
    ★ 팩스로만 받는 곳에는 안 보냅니다. 그건 사람이 보내는 길입니다.
      여기서 조용히 넘어가면 "보냈다" 로 세어져 기록이 거짓이 됩니다.
  */
  if (!wantsEmail(row.invoice_method ?? 'all')) {
    return { ok: false, reason: '이메일로 받는 곳이 아닙니다 (팩스)' };
  }

  if (!row.invoice_to) return { ok: false, reason: '청구서 받을 이메일이 비어 있습니다' };
  if (!row.invoice_no || !row.due_date) return { ok: false, reason: '아직 발행되지 않은 기간입니다' };

  const amount = (row.billing_lines ?? []).reduce((sum, l) => sum + (l.amount ?? 0), 0);

  const input = {
    // ★ 치과가 아니면 기공소입니다. 문서 이름과 링크가 갈립니다
    partyType: row.party?.org_type === 'lab' ? ('lab' as const) : ('clinic' as const),
    partyName: row.party?.name ?? '',
    yearMonth: row.year_month,
    invoiceNo: row.invoice_no,
    amount,
    dueDate: row.due_date,
    siteUrl: siteUrl(),
  };

  const sent = await sendMail({
    to: row.invoice_to,
    subject: invoiceSubject(input),
    html: invoiceHtml(input),
  });

  if (!sent.ok) return { ok: false, reason: sent.reason };

  /*
    ★ 보낸 뒤에 셉니다. 먼저 세고 보내면, 안 나갔는데 '보냄' 으로
      남아 "안 왔다" 는 말에 답할 수 없게 됩니다.
  */
  const { data: before } = await supabase
    .from('billing_periods')
    .select('sent_count')
    .eq('id', periodId)
    .maybeSingle();

  await supabase
    .from('billing_periods')
    .update({
      sent_count: ((before as { sent_count: number } | null)?.sent_count ?? 0) + 1,
      last_sent_at: new Date().toISOString(),
    })
    .eq('id', periodId);

  return { ok: true, to: row.invoice_to };
}
