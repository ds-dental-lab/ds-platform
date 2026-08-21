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
        'party:organizations!billing_periods_party_org_id_fkey' +
        '(name, org_type, invoice_method, invoice_email), ' +
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
    party: {
      name: string;
      org_type: string;
      invoice_method: InvoiceMethod | null;
      invoice_email: string | null;
    } | null;
    billing_lines: { amount: number }[] | null;
  } | null;

  if (!row) return { ok: false, reason: '청구 기간을 찾을 수 없습니다' };

  /*
    ★★ **지금 주소로 보냅니다** (2026-08-21).
      billing_periods.invoice_to 는 **발행 당시** 주소입니다. 그것만
      보고 보내면, 치과가 메일 주소를 바꿔도 재발송이 옛 주소로 계속
      갑니다 — 영영 못 고칩니다. 실제로 시험하다 걸렸습니다.

      '재발송' 은 "지금 다시 보내 달라" 는 뜻이므로, **지금 그 거래처가
      청구서를 받는 곳**으로 갑니다. 비어 있으면 발행 당시 주소로
      되돌아갑니다 — 없는 것보다는 낫습니다.

      보낸 뒤에는 invoice_to 를 **실제로 보낸 곳**으로 고쳐 둡니다.
      그래야 "어디로 갔나" 가 사실과 맞습니다.
  */
  const method = row.party?.invoice_method ?? row.invoice_method ?? 'all';
  const to = row.party?.invoice_email?.trim() || row.invoice_to;

  /*
    ★ 팩스로만 받는 곳에는 안 보냅니다. 그건 사람이 보내는 길입니다.
      여기서 조용히 넘어가면 "보냈다" 로 세어져 기록이 거짓이 됩니다.
  */
  if (!wantsEmail(method)) {
    return { ok: false, reason: '이메일로 받는 곳이 아닙니다 (팩스)' };
  }

  if (!to) return { ok: false, reason: '청구서 받을 이메일이 비어 있습니다' };
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
    to,
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
      // ★ 실제로 보낸 곳으로 고쳐 둡니다 — 기록이 사실과 맞아야 합니다
      invoice_to: to,
    })
    .eq('id', periodId);

  return { ok: true, to };
}
