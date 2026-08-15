// =========================================================
// 놓을 위치: src/app/lab/orders/[orderId]/work-order/page.tsx
//
// 기공의뢰서 인쇄 화면 (기공소). (사용자 요청 2026-08-15)
//
// ★ 디자인센터 쪽과 **같은 `WorkOrderSheet`** 를 씁니다.
//   종이가 자리마다 다르면 그건 다른 문서입니다. 화면 껍데기(돌아가는
//   링크)만 다릅니다.
//
// ★ 열리자마자 인쇄창이 뜹니다 (`?print=1`). 주소로 직접 들어왔을
//   때는 안 뜹니다 — 미리 보고 싶을 때가 있습니다.
//
// ★ 자리로 막습니다. 화면에서 버튼을 감추는 것과 주소를 막는 것은
//   다릅니다 — 주소는 복사해서 돌아다닙니다.
// =========================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireSector } from '@/server/policies/session';
import { getOrderDetail } from '@/server/repositories/order';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { getImplantCatalog } from '@/server/repositories/implant';
import { canPrintWorkOrder } from '@/server/domain/order-status';
import WorkOrderSheet from '@/components/order/WorkOrderSheet';
import AutoPrint from '@/components/billing/AutoPrint';
import PrintButton from '@/components/billing/PrintButton';

export const dynamic = 'force-dynamic';

export default async function LabWorkOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ print?: string; bare?: string }>;
}) {
  await requireSector('lab');

  const { orderId } = await params;
  const { print, bare } = await searchParams;

  const [order, prosthesisCatalog, implantCatalog] = await Promise.all([
    getOrderDetail(orderId),
    // 꺼진 제품도 함께 — 지난 주문이 그 조합을 가리킵니다
    getProsthesisCatalog({ includeInactive: true }),
    getImplantCatalog(),
  ]);

  if (!order || !canPrintWorkOrder(order.roles)) notFound();

  /*
    ★ `?bare=1` 은 안 보이는 틀 안에서 부를 때입니다 (WorkOrderButton).
      그때는 단추가 필요 없습니다 — 남아 있으면 종이 첫 줄에 찍힙니다.
  */
  const embedded = bare === '1';

  return (
    <div className="mx-auto max-w-[760px]">
      {!embedded && (
        <div className="mb-3 flex items-center gap-2 print:hidden">
          <Link
            href={`/lab/orders/${orderId}`}
            className="grid h-9 place-items-center rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            주문으로
          </Link>
          {/* 인쇄창을 닫았다가 다시 열 때 */}
          <PrintButton />
        </div>
      )}

      <div className="rounded-lg border border-[#E8EBF0] print:border-0">
        <WorkOrderSheet
          order={order}
          prosthesisCatalog={prosthesisCatalog}
          implantCatalog={implantCatalog}
        />
      </div>

      <div className="pb-10 print:hidden" />
      <AutoPrint on={print === '1'} />
    </div>
  );
}
