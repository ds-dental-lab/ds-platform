// =========================================================
// 놓을 위치: src/app/lab/page.tsx
//
// HOME. 화면은 HomeScreen 하나로 세 섹터가 나눠 씁니다.
// 무엇을 세는지는 RLS 가 정합니다 — 이 조직이 볼 수 있는 주문만 돌아옵니다.
// =========================================================

import { getHomeSummary } from '@/server/repositories/home';
import { getRetentionNudge } from '@/server/repositories/retention';
import { getSession } from '@/server/policies/session';
import { canSeeMoney, type MemberRole } from '@/server/domain/member';
import HomeScreen from '@/components/home/HomeScreen';
import AutoRefresh from '@/components/layout/AutoRefresh';
import UnreadChatStrip from '@/components/home/UnreadChatStrip';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  /*
    ★ 셋을 함께 보냅니다 — 서로를 안 쓰는데 줄줄이 기다릴 이유가 없습니다.
    ★ 파기 알림은 관리자가 아니면 null 입니다 (repositories/retention).
  */
  const [summary, session, retention] = await Promise.all([
    getHomeSummary(),
    getSession(),
    getRetentionNudge(),
  ]);

  return (
    <>
      {/* ★ 제작대기가 들어오면 새로고침 없이 올라옵니다 (사용자 요청 2026-08-13) */}
      <AutoRefresh />
      {/* 안 읽은 대화가 있으면 맨 위에 띠가 섭니다 (2026-08-19) */}
      <UnreadChatStrip orderPath="/lab/orders" />
      <HomeScreen
        sector="lab"
        summary={summary}
        canSeeMoney={canSeeMoney(session?.role as MemberRole | null)}
        retention={retention}
      />
    </>
  );
}
