// =========================================================
// 놓을 위치: src/app/clinic/users/page.tsx
//
// 직원 계정 — 우리 조직 사람.
//
// ★ 계정을 대신 만들지 않고 초대장을 놓습니다.
//   그 사람이 그 이메일로 가입하면 DB 트리거가 자리에 앉힙니다.
// =========================================================

import { notFound } from 'next/navigation';
import { requireSector } from '@/server/policies/session';
import { getMemberBoard } from '@/server/repositories/member';
import MemberBoard from '@/components/member/MemberBoard';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  await requireSector('clinic');

  const board = await getMemberBoard();
  if (!board) notFound();

  return (
    <div className="mx-auto max-w-[720px]">
      <MemberBoard board={board} />
      <div className="pb-10" />
    </div>
  );
}
