// =========================================================
// 놓을 위치: src/app/lab/page.tsx
//
// HOME. 화면은 HomeScreen 하나로 세 섹터가 나눠 씁니다.
// 무엇을 세는지는 RLS 가 정합니다 — 이 조직이 볼 수 있는 주문만 돌아옵니다.
// =========================================================

import { getHomeSummary } from '@/server/repositories/home';
import HomeScreen from '@/components/home/HomeScreen';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const summary = await getHomeSummary();

  return (
    <HomeScreen
      sector="lab"
      summary={summary}
    />
  );
}
