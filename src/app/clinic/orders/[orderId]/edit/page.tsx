// =========================================================
// 놓을 위치: src/app/clinic/orders/[orderId]/edit/page.tsx
//
// 주문 수정. 등록 화면(NewOrderForm)을 그대로 쓰되 값을 채워 엽니다.
//
// ★ 접수 상태에서만 들어옵니다. (설계서 §2.1 C-4 — 2026-08-11 확정 A안)
//   재스캔에서는 파일만 바꿉니다. 사양까지 열어 두면 디자인센터가
//   "내가 요청한 것(파일)만 바뀌었겠지" 하고 잘못 만듭니다.
//
//   여기서 막고, 서버(updateOrder)에서 한 번 더 막습니다.
//   화면만 막으면 주소를 직접 쳐서 들어올 수 있습니다. (설계서 §5.3 결정 2)
// =========================================================

import { notFound, redirect } from 'next/navigation';
import { requireSector } from '@/server/policies/session';
import { getOrderDetail } from '@/server/repositories/order';
import { getImplantCatalog, listImplantFavorites } from '@/server/repositories/implant';
import { getProductionOptions } from '@/server/repositories/production-option';
import { listOptionPresets } from '@/server/repositories/option-preset';
import { todayInKst } from '@/server/domain/week';
import { defaultDueDate } from '@/server/domain/due-date';
import { canEditSpec } from '@/server/domain/order-status';
import { toFormInitial } from '@/components/order/orderFormInitial';
import NewOrderForm from '@/components/order/NewOrderForm';

export const dynamic = 'force-dynamic';

interface EditOrderPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const { orderId } = await params;
  const session = await requireSector('clinic');

  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  // 사양을 못 고치는 상태면 상세로 돌려보냅니다
  if (!canEditSpec(order.status)) redirect(`/clinic/orders/${orderId}`);

  const [implantCatalog, implantFavorites, optionGroups, optionPresets] = await Promise.all([
    getImplantCatalog(),
    listImplantFavorites(),
    getProductionOptions(),
    listOptionPresets(),
  ]);

  const today = todayInKst();

  return (
    <NewOrderForm
      clinicName={session.orgName ?? ''}
      today={today}
      defaultDue={defaultDueDate(today)}
      implantCatalog={implantCatalog}
      implantFavorites={implantFavorites}
      optionGroups={optionGroups}
      optionPresets={optionPresets}
      initial={toFormInitial(order, optionGroups)}
    />
  );
}
