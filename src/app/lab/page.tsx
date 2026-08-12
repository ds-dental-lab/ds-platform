// =========================================================
// 놓을 위치: src/app/lab/page.tsx
//
// HOME. 화면은 HomeScreen 하나로 세 섹터가 나눠 씁니다.
// 무엇을 세는지는 RLS 가 정합니다 — 이 조직이 볼 수 있는 주문만 돌아옵니다.
// =========================================================

import { getHomeSummary } from '@/server/repositories/home';
import { getSession } from '@/server/policies/session';
import { canSeeMoney, type MemberRole } from '@/server/domain/member';
import HomeScreen from '@/components/home/HomeScreen';
import AutoRefresh from '@/components/layout/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const summary = await getHomeSummary();
  const session = await getSession();

  return (
    <>
      {/* ★ 제작대기가 들어오면 새로고침 없이 올라옵니다 (사용자 요청 2026-08-13) */}
      <AutoRefresh />
      <HomeScreen
        sector="lab"
        summary={summary}
        canSeeMoney={canSeeMoney(session?.role as MemberRole | null)}
      />
    </>
  );
}
