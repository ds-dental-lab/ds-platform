// =========================================================
// 놓을 위치: src/app/design/products/page.tsx
//
// 제품 — 디자인센터가 다루는 보철 종류·재료와 추가 과금 항목.
//
// 지금은 추가 과금 항목(치은포셀린)만 고칠 수 있습니다.
// 보철 종류별 단가표는 Sprint 8 에서 붙습니다 (설계서 §4.7 price_lists).
// =========================================================

import { listSurcharges } from '@/server/repositories/surcharge';
import { listPartnerClinics } from '@/server/repositories/order';
import SurchargeEditor from '@/components/implant/SurchargeEditor';

export const dynamic = 'force-dynamic';

export default async function DesignProductsPage() {
  const [rows, clinics] = await Promise.all([listSurcharges(), listPartnerClinics()]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold">제품</h1>
      <p className="mt-1 text-sm text-gray-500">
        치아에 붙는 추가 항목의 금액을 정합니다. 치과별로 다르게 받을 수 있습니다.
      </p>

      <div className="mt-5">
        <SurchargeEditor rows={rows} clinics={clinics} />
      </div>

      <div className="pb-10" />
    </div>
  );
}
