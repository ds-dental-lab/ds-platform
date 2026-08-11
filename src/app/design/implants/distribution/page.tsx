// =========================================================
// 놓을 위치: src/app/design/implants/distribution/page.tsx
//
// 치과 배포. (설계서 §9.2)
//   고른 치과는 URL 쿼리로 들고 다닙니다 — 새로고침해도 유지되고,
//   서버에서 그 치과의 즐겨찾기를 바로 읽어 내려줄 수 있습니다.
// =========================================================

import Link from 'next/link';
import { getImplantCatalog, listImplantFavorites } from '@/server/repositories/implant';
import { listPartnerClinics } from '@/server/repositories/order';
import FavoriteDistribution from '@/components/implant/FavoriteDistribution';

export const dynamic = 'force-dynamic';

interface DistributionPageProps {
  searchParams: Promise<{ clinic?: string }>;
}

export default async function DistributionPage({ searchParams }: DistributionPageProps) {
  const { clinic } = await searchParams;

  const [catalog, clinics] = await Promise.all([getImplantCatalog(), listPartnerClinics()]);

  // 거래 치과가 맞는지 확인한 뒤에만 읽습니다.
  // (RLS 도 막지만, 화면에서 엉뚱한 id 를 들고 다니지 않게 합니다)
  const selectedClinicId = clinics.some((c) => c.id === clinic) ? clinic! : null;
  const favorites = selectedClinicId ? await listImplantFavorites(selectedClinicId) : [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/design/implants" className="text-sm text-gray-500 hover:text-gray-800">
        ← 임플란트 마스터
      </Link>

      <h1 className="mt-2 text-xl font-bold">치과 배포</h1>
      <p className="mt-1 text-sm text-gray-500">
        자주 쓰는 조합을 치과 주문등록 화면에 미리 꽂아 둡니다.
        배포한 항목은 <b>치과가 임의로 뺄 수 없고</b>, 회수는 여기서만 됩니다.
      </p>

      <div className="mt-5">
        <FavoriteDistribution
          catalog={catalog}
          clinics={clinics}
          favorites={favorites}
          selectedClinicId={selectedClinicId}
        />
      </div>
    </div>
  );
}
