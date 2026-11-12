// =========================================================
// 놓을 위치: src/app/api/jobs/api-watch/route.ts
//
// DB 의 지켜보기(pg_cron · api_watch_tick)가 "API 서버가 죽었다 / 돌아왔다" 를
// 알리러 부르는 곳. (2026-11-12)
//
// ★★ **여기서는 Supabase 를 절대 부르지 않습니다.** 이 알림이 나가는 때는
//   바로 그 Supabase API 가 죽어 있는 때입니다. 받을 사람·문구는 전부
//   코드와 환경변수에서 옵니다. 메일만 보냅니다.
// ★ 열쇠 JOB_SECRET 필수 — 남이 불러 헛경보를 보내면 안 됩니다.
// =========================================================

import { apiAlertMail, apiAlertSubject, readApiAlert } from '@/server/domain/api-watch';
import { sendMail } from '@/server/mail/send';

export const dynamic = 'force-dynamic';

const ALERT_TO = process.env.ALERT_EMAIL || 'hep789@naver.com';

export async function POST(request: Request) {
  const secret = process.env.JOB_SECRET;
  if (!secret || request.headers.get('x-denflow-job') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const alert = readApiAlert(await request.json().catch(() => null));
  if (!alert) return new Response('bad request', { status: 400 });

  const sent = await sendMail({
    to: ALERT_TO,
    subject: apiAlertSubject(alert),
    html: apiAlertMail(alert),
  });

  // ★ 못 보냈으면 못 보냈다고 답합니다 — DB 쪽 기록(net._http_response)에 남습니다
  if (!sent.ok) {
    console.error('[api-watch] 알림 메일을 못 보냈습니다:', sent.reason);
    return Response.json({ ok: false, reason: sent.reason }, { status: 502 });
  }
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
