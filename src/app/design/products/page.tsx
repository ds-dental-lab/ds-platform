// =========================================================
// 놓을 위치: src/app/design/products/page.tsx
//
// 제품 — 디자인센터가 파는 보철을 관리합니다.
//
// ★ 여기서 켠 것만 치과 주문등록에 나옵니다.
//   새 재료를 넣으면 배포 없이 다음 새로고침에 나타나고,
//   판매중지로 내리면 치과 목록에서만 빠집니다 — 지난 주문은 그대로입니다.
//
// ★ 치은포셀린 금액 편집기(SurchargeEditor)를 걷어냈습니다.
//   그 값이 제품의 '가격(핑크 포셀린)' 으로 옮겨 갔습니다.
//   같은 값을 두 곳에서 고치면 어느 쪽이 맞는지 알 수 없습니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { listProducts } from '@/server/repositories/prosthesis';
import ProductTable from '@/components/product/ProductTable';

export const dynamic = 'force-dynamic';

export default async function DesignProductsPage() {
  await requireManagerSector('design_center');

  const { rows, types } = await listProducts();

  return (
    <div className="mx-auto max-w-[1400px]">
      <ProductTable rows={rows} types={types} />
      <div className="pb-10" />
    </div>
  );
}
