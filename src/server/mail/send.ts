// =========================================================
// 놓을 위치: src/server/mail/send.ts
//
// 우리가 직접 보내는 메일. (사용자 결정 2026-08-21 — 청구서 발송)
//
// ★★ **Supabase 에 붙인 SMTP 와 다른 길입니다.**
//   그건 로그인·비밀번호 찾기 같은 **인증 메일** 전용입니다.
//   청구서는 우리가 만든 문서라 우리 서버가 직접 보내야 하고,
//   그러려면 열쇠가 **우리 env** 에도 있어야 합니다.
//
// ★ 열쇠가 없으면 조용히 성공한 척하지 않습니다.
//   "왜 안 왔지" 를 나중에 찾는 것보다, 지금 이유를 말하는 편이 낫습니다.
//
// ★ 보내는 일이 본래 일을 넘어뜨리면 안 됩니다.
//   청구서 '발행' 은 돈 문서를 확정하는 일이고 메일은 곁다리입니다.
//   여기서 던지지 않고 결과만 돌려줍니다 — 부르는 쪽이 판단합니다.
// =========================================================

import 'server-only';

export type MailResult = { ok: true; id: string } | { ok: false; reason: string };

const ENDPOINT = 'https://api.resend.com/emails';

/** 보내는 사람. 도메인은 Resend 에 확인시켜 둔 것이어야 합니다 */
const FROM = '덴플로우 <noreply@denflow.kr>';

export interface MailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: MailInput): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    return {
      ok: false,
      reason:
        '메일 열쇠(RESEND_API_KEY)가 서버에 없습니다. ' +
        'Resend → API Keys 에서 만든 값을 .env.local 과 Vercel 환경변수에 넣어 주세요',
    };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });

    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!res.ok) {
      /*
        ★ 서버가 뭐라고 했는지 그대로 남깁니다. 흔한 것 둘 —
          403 도메인 미확인 · 422 보내는 주소가 그 도메인이 아님.
          "못 보냈습니다" 만 있으면 어느 쪽인지 알 수 없습니다.
      */
      return { ok: false, reason: `메일 서버가 거절했습니다 (${res.status}) ${body?.message ?? ''}`.trim() };
    }

    return { ok: true, id: body?.id ?? '' };
  } catch (e) {
    return { ok: false, reason: `메일 서버에 닿지 못했습니다: ${(e as Error).message}` };
  }
}
