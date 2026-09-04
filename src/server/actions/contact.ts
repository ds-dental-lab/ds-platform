// =========================================================
// 놓을 위치: src/server/actions/contact.ts
//
// 홈페이지 문의 접수.
//
// ★ 로그인하지 않은 사람이 부릅니다.
//   RLS 는 anon 에게 insert 만 열어 뒀습니다. 읽기는 디자인센터뿐입니다.
//
// ★ 실패해도 무엇이 잘못됐는지만 말합니다.
//   "이미 문의하셨습니다" 같은 것을 알려 주면 남의 문의 여부를
//   확인해 주는 창구가 됩니다.
// =========================================================

'use server';

import { createClient } from '@/lib/supabase/server';
import { checkContact, type ContactForm } from '@/server/domain/contact';

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function submitContact(form: ContactForm): Promise<ContactResult> {
  const verdict = checkContact(form);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createClient();

  const { error } = await supabase.from('contact_requests').insert({
    clinic_name: form.clinicName.trim(),
    tel: form.tel.trim(),
    email: form.email.trim(),
    // ★ kind 는 안 보냅니다 — 표의 default 'price_list' 가 채웁니다 (2026-09-04)
    // ★ message 도 안 보냅니다 — 칸을 뺐습니다 (2026-09-04). 옛 문의만 값이 있습니다
    scanner: form.scanner,
    // ★ 같은 값을 두 번 누르는 화면 버그가 있어도 표에는 한 번만
    pain_points: [...new Set(form.painPoints)],
  });

  if (error) return { ok: false, error: '보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요' };

  return { ok: true };
}
