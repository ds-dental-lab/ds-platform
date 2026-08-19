// =========================================================
// 놓을 위치: src/server/events/push.ts
//
// 웹푸시 발송. (사용자 요청 2026-08-19)
//
// ★ service_role 로 읽습니다.
//   보내는 사람(글쓴이)과 받는 사람(상대 조직)은 다른 조직입니다.
//   글쓴이의 권한으로는 상대의 구독이 안 보입니다 — RLS 가 맞게 막는
//   것입니다. 그래서 발송만 만능 열쇠를 씁니다. 이 파일은 서버 전용이고
//   화면 코드에서 import 하면 안 됩니다.
//
// ★ 실패해도 업무는 되돌리지 않습니다 (events 공통 원칙).
//   푸시는 '지금 봐주세요' 일 뿐, 진짜 기록은 notifications 에 있습니다.
//
// ★ 죽은 구독은 그 자리에서 지웁니다.
//   브라우저를 지웠거나 알림을 끈 자리는 404/410 으로 돌아옵니다.
//   두면 보낼 때마다 같은 데서 또 실패합니다.
// =========================================================

import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PushPayload } from '@/server/domain/push';

/** VAPID 열쇠가 없으면 조용히 건너뜁니다 — 시험 서버에는 없을 수 있습니다 */
function configure(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:hep789@naver.com',
    publicKey,
    privateKey,
  );
  return true;
}

interface SubscriptionRow {
  id: string;
  org_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * 조직별로 다른 내용을 보냅니다 — 받는 섹터마다 눌렀을 때 갈 곳이 다릅니다.
 */
export async function sendPushToOrgs(
  payloadByOrg: Map<string, PushPayload>,
): Promise<void> {
  try {
    if (payloadByOrg.size === 0 || !configure()) return;

    const admin = createAdminClient();

    const { data } = await admin
      .from('push_subscriptions')
      .select('id, org_id, endpoint, p256dh, auth')
      .in('org_id', [...payloadByOrg.keys()]);

    const subs = (data ?? []) as SubscriptionRow[];
    if (subs.length === 0) return;

    const dead: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        const payload = payloadByOrg.get(sub.org_id);
        if (!payload) return;

        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
            // 대화는 몇 시간 지나면 이미 봤거나 의미가 없습니다
            { TTL: 60 * 60 * 6 },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410 — 그 브라우저가 구독을 버렸습니다
          if (status === 404 || status === 410) dead.push(sub.id);
          else console.error('[push] 발송 실패', status ?? error);
        }
      }),
    );

    if (dead.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', dead);
    }
  } catch (error) {
    console.error('[push] 발송 처리 실패', error);
  }
}
