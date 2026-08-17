// =========================================================
// 놓을 위치: src/app/design/fit-values/page.tsx
//
// 내면값 관리 — 치과 전부를 한 표로. (사용자 요청 2026-08-17)
//
// ★ 관리자만입니다 (requireManagerSector).
//   값을 **정하는** 자리라서요. 디자이너는 주문상세에서 치과명을
//   눌러 봅니다 — 일하다 값이 궁금한 곳이 거기입니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { listFitBoard } from '@/server/repositories/fit-value';
import FitValueBoard from '@/components/fit-value/FitValueBoard';

export const dynamic = 'force-dynamic';

export default async function FitValuesPage() {
  await requireManagerSector('design_center');

  const rows = await listFitBoard();

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[17px] font-bold tracking-tight text-[#1A2130]">내면값 관리</h2>
        <p className="text-[13px] text-[#98A2B3]">
          치과마다 다른 설계 수치입니다 — 디자이너가 주문상세에서 치과명을 누르면 보입니다
        </p>
      </div>

      <FitValueBoard rows={rows} />
      <div className="pb-10" />
    </div>
  );
}
