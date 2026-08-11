// =========================================================
// 놓을 위치: src/app/design/implants/page.tsx
//
// 임플란트 마스터 관리. 디자인센터 **관리자만** 들어옵니다.
//
// ★ 사용자(디자이너)에게는 메뉴가 안 보입니다 (사용자 결정 2026-08-12).
//   메뉴를 숨기는 것만으로는 부족합니다 — 주소를 바로 치면 열립니다.
// =========================================================

import Link from 'next/link';
import { requireManagerSector } from '@/server/policies/session';
import { getImplantCatalog } from '@/server/repositories/implant';
import ImplantMasterEditor from '@/components/implant/ImplantMasterEditor';

export const dynamic = 'force-dynamic';

export default async function ImplantMasterPage() {
  await requireManagerSector('design_center');

  const catalog = await getImplantCatalog();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">임플란트 마스터</h1>
          <p className="mt-1 text-sm text-gray-500">
            여기서 고친 내용이 치과의 주문등록 화면에 그대로 나타납니다.
            사이즈와 스크류는 제조사가 아니라 <b>타입</b>에 딸립니다.
          </p>
        </div>

        <Link
          href="/design/implants/distribution"
          className="shrink-0 rounded border border-purple-500 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
        >
          치과 배포
        </Link>
      </div>

      <div className="mt-5">
        <ImplantMasterEditor catalog={catalog} />
      </div>
    </div>
  );
}
