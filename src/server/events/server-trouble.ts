// =========================================================
// 놓을 위치: src/server/events/server-trouble.ts
//
// 로그인한 사람이 **서버 때문에** 막혔을 때 센터에 알립니다.
// 기준: 2026-10-10 사건 — Supabase 쪽 시계가 틀어져 DB 가 로그인 토큰을
//       "미래에 발급됐다"(PGRST303)며 거절했습니다.
//
// ★★ **41시간 동안 아무도 몰랐습니다.** 화면은 200 으로 멀쩡히 떴고,
//   Supabase 대시보드는 끝까지 Healthy 였고, 바깥에서 지켜보는 감시로는
//   잡히지 않는 고장이었습니다 — **로그인한 사람에게만** 보였습니다.
//   그래서 안에서, 첫 사람이 막히는 순간에 알립니다.
//
// ★ service role 로 보냅니다. 이 고장은 **사람의 토큰만** 막습니다 —
//   service role 열쇠는 오래전에 발급돼 "과거" 라서 그대로 통과합니다.
//   그 성질 덕분에 막힌 와중에도 알림은 나갑니다.
//
// ★ 한 번만 보냅니다(30분). 고장이 이어지는 동안 들어오는 모든 사람이
//   각자 알림을 쏘면, 받는 쪽은 그걸 끄게 됩니다.
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToOrgs } from '@/server/events/push';

/** 같은 알림을 다시 보내기까지 */
const QUIET_MINUTES = 30;

/** 사람이 눌러야 하는 곳 — Supabase 재시작 화면 */
const RESTART_URL = 'https://supabase.com/dashboard/project/dzliwedyqkondvcwnvbh/settings/general';

export async function reportServerTrouble(code: string, message: string): Promise<void> {
  try {
    const admin = createAdminClient();

    // 디자인센터는 하나뿐입니다
    const { data: center } = await admin
      .from('organizations')
      .select('id')
      .eq('org_type', 'design_center')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    const orgId = (center as { id: string } | null)?.id;
    if (!orgId) return;

    const since = new Date(Date.now() - QUIET_MINUTES * 60_000).toISOString();

    const { count } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('event_type', 'server.trouble')
      .gte('created_at', since);

    if (count && count > 0) return;

    /*
      ★ 제목에 **무엇이 막혔는지**를 적습니다. "오류 발생" 으로는
        지금 당장 봐야 하는 일인지 알 수 없습니다.
      ★ 본문에 **눌러야 할 곳**까지 적습니다. 새벽에 폰으로 보는 글입니다 —
        그때 "어디서 뭘 누르더라" 를 떠올리게 하면 안 됩니다.
    */
    const title = '로그인한 사람이 들어가지 못하고 있습니다';
    const body =
      `서버가 소속 조회를 거절했습니다 (${code}). 지금 로그인하는 모두가 막힙니다. ` +
      `Supabase 에서 Restart project 를 눌러 주세요 — ${RESTART_URL}`;

    await admin.from('notifications').insert({
      org_id: orgId,
      event_type: 'server.trouble',
      title,
      body,
      payload: { code, message },
    });

    await sendPushToOrgs(
      new Map([
        [
          orgId,
          {
            title,
            body: `${code} · Supabase 를 재시작해 주세요`,
            link: '/design',
            // ★ 같은 tag 라 알림이 쌓이지 않고 갈아끼워집니다
            tag: 'server-trouble',
          },
        ],
      ]),
    );
  } catch {
    // ★ 알리다 실패해도 화면은 계속 그려야 합니다. 여기서 던지면
    //   고장 위에 고장을 얹는 셈입니다.
  }
}
