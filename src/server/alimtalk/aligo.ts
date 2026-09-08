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
//   보내는 주소(알리고 API)는 DB 의 alimtalk_relay() 안에 있습니다.
//
// ★ 대체 문자(failover)를 켭니다. 카톡이 없는 번호면 같은 글이 문자로 갑니다.
//   장문(LMS)이라 제목이 필요합니다 — title 을 씁니다.
// ★ 던지지 않습니다. 결과만 돌려주고, 대기열이 상태를 적습니다.
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type AligoResult = { ok: true; id: string } | { ok: false; reason: string; permanent: boolean };


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
    /*
      ★ 직접 부르지 않고 **DB 를 거칩니다** (2026-09-08). 알리고는 부르는
        서버의 IP 를 등록하라고 하는데 Vercel 은 IP 가 고정이 아닙니다.
        Supabase DB 는 나가는 IP 가 하나(15.165.4.219)라 그것을 등록해 두고,
        DB 의 alimtalk_relay() 가 이 폼을 알리고에 그대로 전달합니다.
        열쇠는 여기서 폼에 넣어 보내므로 DB 에는 남지 않습니다.
      ★ 그 IP 가 바뀌면(Supabase 가 프로젝트를 옮길 때) 같은 오류가 다시
        납니다 — 그때는 egress_ip() 로 새 IP 를 알아내 알리고에 등록합니다.
    */
    const { data, error } = await createAdminClient().rpc('alimtalk_relay', { form: form.toString() });
    if (error) return { ok: false, permanent: false, reason: `DB 중계 실패: ${error.message}` };

    const relayed = data as { status: number; content: string } | null;
    let json: { code?: number; message?: string; info?: unknown } | null = null;
    try {
      json = relayed?.content ? JSON.parse(relayed.content) : null;
    } catch {
      json = null;
    }

    if (!json) return { ok: false, permanent: false, reason: `알리고 응답을 못 읽었습니다 (${relayed?.status ?? '?'})` };
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
