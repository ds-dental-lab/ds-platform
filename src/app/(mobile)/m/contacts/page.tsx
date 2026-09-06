// =========================================================
// 놓을 위치: src/app/(mobile)/m/contacts/page.tsx
//
// 센터 관리자 폰 — 수가표 문의. (사용자 요청 2026-09-06)
// ★ 관리자만. 디자이너가 주소를 쳐도 404 (requireManagerSector).
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { listContacts } from '@/server/repositories/contact';
import MobileContacts from '@/components/center/MobileContacts';

export const dynamic = 'force-dynamic';
export const metadata = { title: '수가표 문의' };

export default async function MobileContactsPage() {
  await requireManagerSector('design_center');

  const { fresh } = await listContacts();

  return <MobileContacts rows={fresh} />;
}
