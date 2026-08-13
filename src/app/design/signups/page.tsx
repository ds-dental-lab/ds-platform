// =========================================================
// 놓을 위치: src/app/design/signups/page.tsx
//
// 가입승인 (디자인센터 관리자 전용).
//
// ★ 메뉴에서 감춘 화면에는 반드시 문이 있어야 합니다.
//   주소를 바로 치면 열리니까요. requireManagerSector 가 404 를 냅니다
//   (tests/domain/nav.test.ts 가 이 파일에 그 호출이 있는지 봅니다).
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { getSignupBoard } from '@/server/repositories/signup';
import SignupBoard from '@/components/signup/SignupBoard';

export const dynamic = 'force-dynamic';

export default async function SignupApprovalPage() {
  await requireManagerSector('design_center');

  const { pending, handled } = await getSignupBoard();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-1">
      <header>
        <h1 className="text-[19px] font-extrabold tracking-[-0.03em] text-[#1A2130]">가입승인</h1>
        <p className="mt-1 text-[14px] text-[#7C8595]">
          치과·기공소가 스스로 가입하면 여기로 옵니다. 승인해야 이용할 수 있습니다.
        </p>
      </header>

      <SignupBoard pending={pending} handled={handled} />
    </div>
  );
}
