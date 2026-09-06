// =========================================================
// 놓을 위치: src/app/(mobile)/m/signups/page.tsx
//
// 센터 관리자 폰 — 가입 승인. (사용자 요청 2026-09-06)
// ★ 관리자만. PC 승인 화면(/design/signups)과 같은 저장소·액션을 씁니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { getSignupBoard } from '@/server/repositories/signup';
import MobileSignups from '@/components/center/MobileSignups';

export const dynamic = 'force-dynamic';
export const metadata = { title: '가입 승인' };

export default async function MobileSignupsPage() {
  await requireManagerSector('design_center');

  const { pending } = await getSignupBoard();

  return <MobileSignups rows={pending} />;
}
