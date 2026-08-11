// =========================================================
// 놓을 위치: src/app/design/account/page.tsx
//
// 계정 정보. 우리 조직의 사업자 정보를 넣습니다.
//
// ★ 청구서에 그대로 실립니다.
//   비어 있으면 문서에 '-' 로 찍힙니다. 아직 개설 전이면 비워 둬도 됩니다.
// =========================================================

import { notFound } from 'next/navigation';
import { requireSession } from '@/server/policies/session';
import { getMyOrg } from '@/server/repositories/account';
import AccountForm from '@/components/account/AccountForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  await requireSession();

  const org = await getMyOrg();
  if (!org) notFound();

  return <AccountForm org={org} editable={org.editable} />;
}
