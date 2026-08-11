// =========================================================
// 놓을 위치: src/app/design/users/page.tsx
//
// 사용자 — 디자인센터가 거래하는 치과와 기공소를 관리합니다.
//
// ★ 여기서 '거래중' 인 치과만 새 주문을 넣습니다.
//   거래를 끊어도 목록과 지난 주문은 그대로 남습니다.
//
// ★ 단가는 줄이 길어 거래처마다 따로 화면을 둡니다 ([orgId]).
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { listPartners } from '@/server/repositories/partner';
import PartnerTable from '@/components/partner/PartnerTable';

export const dynamic = 'force-dynamic';

export default async function DesignUsersPage() {
  await requireManagerSector('design_center');

  const rows = await listPartners();

  return (
    <div className="mx-auto max-w-[1400px]">
      <PartnerTable rows={rows} />
      <div className="pb-10" />
    </div>
  );
}
