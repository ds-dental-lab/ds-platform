// =========================================================
// 놓을 위치: src/server/actions/price-sheet.ts
//
// 문의한 치과에 수가표를 메일로 보냅니다. 디자인센터 관리자만.
// (사용자 요청 2026-09-07)
//
// ★ 화면이 보낸 표를 그대로 믿지 않습니다 — 여기서 다시 검사합니다
//   (checkPriceSheet). 0원·소수·빈 이름은 여기서 걸립니다.
// ★ 보낸 값은 그 문의 줄에 박아 둡니다. 단가는 바뀌어도 "그때 얼마로
//   보냈나" 는 안 바뀌어야 합니다.
// ★ 메일이 안 나갔으면 기록도 안 남깁니다 — '보냄' 인데 안 간 것이
//   제일 나쁩니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { canManageMembers, type MemberRole } from '@/server/domain/member';
import { checkPriceSheet, type PriceRow } from '@/server/domain/price-sheet';
import { SITE_LEGAL, SITE_TEL } from '@/server/domain/site';
import { sendMail } from '@/server/mail/send';
import { priceSheetHtml, priceSheetSubject } from '@/server/mail/price-sheet-mail';

export type SendPriceSheetResult = { ok: true; sentAt: string } | { ok: false; error: string };

export async function submitSendPriceSheet(
  contactId: string,
  rows: PriceRow[],
  saveAsDefault: boolean,
): Promise<SendPriceSheetResult> {
  const session = await getSession();

  if (session?.orgType !== 'design_center' || !canManageMembers(session.role as MemberRole | null)) {
    return { ok: false, error: '디자인센터 관리자만 보낼 수 있습니다' };
  }

  const verdict = checkPriceSheet(rows);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createClient();

  const { data: contact } = await supabase
    .from('contact_requests')
    .select('id, clinic_name, email')
    .eq('id', contactId)
    .maybeSingle();

  const target = contact as { id: string; clinic_name: string; email: string | null } | null;
  if (!target) return { ok: false, error: '문의를 찾지 못했습니다' };
  if (!target.email || !target.email.includes('@')) {
    return { ok: false, error: '이 문의에는 메일 주소가 없습니다. 전화로 안내해 주세요' };
  }

  // 보내는 곳 — 계정정보의 값이 있으면 그것, 없으면 사이트 상수
  const { data: org } = await supabase
    .from('organizations')
    .select('name, tel, invoice_email')
    .eq('id', session.orgId!)
    .maybeSingle();
  const me = org as { name: string; tel: string | null; invoice_email: string | null } | null;

  const sent = await sendMail({
    to: target.email,
    subject: priceSheetSubject({ clinicName: target.clinic_name, senderName: SITE_LEGAL.name }),
    html: priceSheetHtml({
      clinicName: target.clinic_name,
      rows,
      senderName: SITE_LEGAL.name,
      senderTel: me?.tel || SITE_TEL,
      senderEmail: me?.invoice_email || session.email,
      year: new Date().getFullYear().toString(),
    }),
  });

  if (!sent.ok) return { ok: false, error: `메일을 못 보냈습니다: ${sent.reason}` };

  const sentAt = new Date().toISOString();

  await supabase
    .from('contact_requests')
    .update({ price_sheet_sent: rows, price_sheet_sent_at: sentAt })
    .eq('id', contactId);

  if (saveAsDefault) {
    await supabase.from('organizations').update({ price_sheet: rows }).eq('id', session.orgId!);
  }

  revalidatePath('/design/contacts');
  revalidatePath('/m/contacts');

  return { ok: true, sentAt };
}
