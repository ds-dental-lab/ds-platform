// =========================================================
// 놓을 위치: src/app/clinic/page.tsx
//
// HOME. 화면은 HomeScreen 하나로 세 섹터가 나눠 씁니다.
// 무엇을 세는지는 RLS 가 정합니다 — 이 조직이 볼 수 있는 주문만 돌아옵니다.
// =========================================================

import { getHomeSummary } from '@/server/repositories/home';
import { getSession } from '@/server/policies/session';
import { canSeeMoney, type MemberRole } from '@/server/domain/member';
import HomeScreen from '@/components/home/HomeScreen';
import AutoRefresh from '@/components/layout/AutoRefresh';
import UnreadChatStrip from '@/components/home/UnreadChatStrip';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const summary = await getHomeSummary();
  const session = await getSession();

  return (
    <>
      {/* ★ 치과에도 붙입니다 — 대화 알림이 종에 뜨려면 여기가 있어야 합니다 */}
      <AutoRefresh />
      {/* 안 읽은 대화가 있으면 맨 위에 띠가 섭니다 (2026-08-19) */}
      <UnreadChatStrip orderPath="/clinic/orders" />
      <HomeScreen
        sector="clinic"
        summary={summary}
        canSeeMoney={canSeeMoney(session?.role as MemberRole | null)}
      />
    </>
  );
}
