// =========================================================
// 놓을 위치: src/app/lab/account/page.tsx
//
// 계정 정보. 우리 조직의 사업자 정보를 넣습니다.
//
// ★ 청구서에 그대로 실립니다.
//   비어 있으면 문서에 '-' 로 찍힙니다. 아직 개설 전이면 비워 둬도 됩니다.
// =========================================================

import { notFound } from 'next/navigation';
import { requireSession } from '@/server/policies/session';
import { getMyOrg, getMyAlimtalk } from '@/server/repositories/account';
import AccountForm from '@/components/account/AccountForm';
import AlimtalkCard from '@/components/account/AlimtalkCard';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  await requireSession();

  const [org, alimtalk] = await Promise.all([getMyOrg(), getMyAlimtalk()]);
  if (!org) notFound();

  return (
    <>
      <AccountForm org={org} editable={org.editable} basePath="/lab" />

      {/* ★ 자기 것만 고칩니다 — 관리자든 사용자든 모두에게 보입니다 */}
      {alimtalk && (
        <AlimtalkCard
          phone={alimtalk.phone}
          on={alimtalk.on}
          events={alimtalk.events}
          recent={alimtalk.recent}
        />
      )}
    </>
  );
}
