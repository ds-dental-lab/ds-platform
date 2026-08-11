// =========================================================
// 놓을 위치: src/app/design/notices/page.tsx
//
// 공지사항. 화면은 NoticeBoard 하나로 세 섹터가 나눠 씁니다.
// 무엇이 보이는지는 RLS 가 정합니다 — 게시됐고, 안 지워졌고,
// 내 조직 종류로 온 것만 돌아옵니다.
// =========================================================

import { requireSector } from '@/server/policies/session';
import { listNotices } from '@/server/repositories/notice';
import NoticeBoard from '@/components/notice/NoticeBoard';

export const dynamic = 'force-dynamic';

export default async function NoticesPage() {
  await requireSector('design_center');

  const rows = await listNotices();

  return (
    <div className="mx-auto max-w-[900px]">
      <NoticeBoard rows={rows} canWrite={true} />
      <div className="pb-10" />
    </div>
  );
}
