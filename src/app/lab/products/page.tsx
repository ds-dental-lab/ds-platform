// =========================================================
// 놓을 위치: src/app/lab/products/page.tsx
//
// 제품 단가 — 기공소가 자기 기공원가를 확인합니다. 읽기 전용입니다.
//
// ★ 정하는 쪽은 디자인센터입니다 (사용자탭).
//   받는 쪽이 스스로 올리면 그건 단가가 아니라 청구입니다.
//
// ★ 치과 판매가는 어디에도 안 나옵니다 (설계서 §8.5).
//   제품 이름은 값이 빠진 보기에서 읽고, 금액은 자기
//   lab_product_costs 에서만 옵니다.
// =========================================================

import { notFound } from 'next/navigation';
import { requireManagerSector } from '@/server/policies/session';
import { getLabPrices } from '@/server/repositories/lab-price';
import LabPriceTable from '@/components/product/LabPriceTable';

export const dynamic = 'force-dynamic';

export default async function LabProductsPage() {
  await requireManagerSector('lab');

  const board = await getLabPrices();
  if (!board) notFound();

  return (
    <div className="mx-auto max-w-[900px]">
      <LabPriceTable board={board} />
      <div className="pb-10" />
    </div>
  );
}
