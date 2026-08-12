// =========================================================
// 놓을 위치: src/app/lab/account/retention/page.tsx
//
// 보관기간과 파기. 관리자만 들어옵니다.
//
// ★ 저절로 안 돕니다. 사람이 눌러야 지워집니다.
//   밤사이 배치가 돌아 환자 파일이 사라졌는데 그날 무엇이 지워졌는지
//   아무도 모르는 상태가 제일 나쁩니다.
// =========================================================

import { notFound } from 'next/navigation';
import { requireManagerSector } from '@/server/policies/session';
import { getRetentionBoard } from '@/server/repositories/retention';
import RetentionBoard from '@/components/account/RetentionBoard';

export const dynamic = 'force-dynamic';

export default async function RetentionPage() {
  await requireManagerSector('lab');

  const board = await getRetentionBoard();
  if (!board) notFound();

  return (
    <div className="mx-auto max-w-[760px]">
      <RetentionBoard board={board} />
      <div className="pb-10" />
    </div>
  );
}
