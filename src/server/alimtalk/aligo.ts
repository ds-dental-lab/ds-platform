// =========================================================
// 놓을 위치: src/server/alimtalk/aligo.ts
//
// 알리고(aligo.in) 알림톡 API 로 한 통 보냅니다. (2026-09-08)
//
// ★ 열쇠 넷은 환경변수에만 있습니다 — .env.local 과 Vercel.
//     ALIGO_API_KEY       알리고 API 키
//     ALIGO_USER_ID       알리고 아이디
//     ALIGO_SENDER_KEY    카카오 발신프로필 키
//     ALIGO_SENDER_PHONE  대체 문자 발신번호 (알리고에 등록된 번호)
//   하나라도 없으면 보내지 않고 이유를 돌려줍니다 — 조용히 성공한 척 안 합니다.
//
// ★ 대체 문자(failover)를 켭니다. 카톡이 없는 번호면 같은 글이 문자로 갑니다.
//   장문(LMS)이라 제목이 필요합니다 — title 을 씁니다.
// ★ 던지지 않습니다. 결과만 돌려주고, 대기열이 상태를 적습니다.
// =========================================================

import 'server-only';

export type AligoResult = { ok: true; id: string } | { ok: false; reason: string; permanent: boolean };

const ENDPOINT = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';

export function aligoConfigured(): boolean {
  return Boolean(
    process.env.ALIGO_API_KEY && process.env.ALIGO_USER_ID && process.env.ALIGO_SENDER_KEY && process.env.ALIGO_SENDER_PHONE,
  );
}

export async function sendAligo(input: {
  phone: string;
  templateCode: string;
  /** 문자로 갈 때의 제목 */
  title: string;
  message: string;
  button: { name: string; linkMo: string; linkPc: string } | null;
}): Promise<AligoResult> {
  if (!aligoConfigured()) {
    return { ok: false, permanent: false, reason: '알리고 열쇠(ALIGO_*)가 서버에 없습니다' };
  }

  const form = new URLSearchParams({
    apikey: process.env.ALIGO_API_KEY!,
    userid: process.env.ALIGO_USER_ID!,
    senderkey: process.env.ALIGO_SENDER_KEY!,
    tpl_code: input.templateCode,
    sender: process.env.ALIGO_SENDER_PHONE!,
    receiver_1: input.phone,
    subject_1: input.title,
    message_1: input.message,
    failover: 'Y',
    fsubject_1: input.title,
    fmessage_1: input.message,
  });

  if (input.button) {
    form.set(
      'button_1',
      JSON.stringify({
        button: [
          {
            name: input.button.name,
            linkType: 'WL',
            linkTypeName: '웹링크',
            linkMo: input.button.linkMo,
            linkPc: input.button.linkPc,
          },
        ],
      }),
    );
  }

  try {
    const res = await fetch(ENDPOINT, { method: 'POST', body: form });
    const json = (await res.json().catch(() => null)) as { code?: number; message?: string; info?: unknown } | null;

    if (!json) return { ok: false, permanent: false, reason: `알리고 응답을 못 읽었습니다 (${res.status})` };
    if (json.code !== 0) {
      /*
        ★ 영구 실패와 잠깐 실패를 나눕니다. 템플릿 불일치·검수 중·번호 이상은
          다시 보내도 같은 답이라 한 번으로 끝냅니다. 잔액·서버 오류는 다음에 또.
      */
      const msg = json.message ?? `code ${json.code}`;
      const permanent = /템플릿|검수|형식|수신번호|receiver|template/i.test(msg);
      return { ok: false, permanent, reason: `알리고 거절: ${msg}` };
    }

    return { ok: true, id: String((json.info as { mid?: string } | undefined)?.mid ?? '') };
  } catch (e) {
    return { ok: false, permanent: false, reason: `알리고에 닿지 못했습니다: ${(e as Error).message}` };
  }
}
