// =========================================================
// 놓을 위치: src/app/design/users/[orgId]/page.tsx
//
// 거래처별 단가. 치과는 판매가, 기공소는 기공원가입니다.
//
// ★ 남의 거래처는 RLS 가 0행으로 막습니다.
//   오류가 아니라 '없음' 으로 오므로 여기서 404 로 바꿉니다 (§8.6).
// =========================================================

import { notFound } from 'next/navigation';
import { requireSector } from '@/server/policies/session';
import { getPartner, getPartnerPrices } from '@/server/repositories/partner';
import PartnerPriceTable from '@/components/partner/PartnerPriceTable';

export const dynamic = 'force-dynamic';

export default async function PartnerPricePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requireSector('design_center');

  const { orgId } = await params;

  const partner = await getPartner(orgId);
  if (!partner || (partner.orgType !== 'clinic' && partner.orgType !== 'lab')) notFound();

  const rows = await getPartnerPrices(partner);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PartnerPriceTable partner={partner} rows={rows} />
      <div className="pb-10" />
    </div>
  );
}
