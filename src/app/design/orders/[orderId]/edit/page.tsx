// =========================================================
// 놓을 위치: src/app/design/orders/[orderId]/edit/page.tsx
//
// 주문 수정 (디자인센터). 치과 화면과 같은 폼을 값 채워 엽니다.
//
// ★ 디자인센터는 **단계를 안 가립니다** (사용자 결정 2026-08-12).
//   치과를 접수 상태로 묶어 둔 이유는 "이미 남이 그 사양으로 일을
//   시작했기 때문" 이었습니다. 그런데 그 일을 하는 쪽이 디자인센터입니다.
//   전화로 "이거 바꿔 주세요" 를 받아 처리하는 곳이기도 합니다.
//
//   그래도 여기서 막고 서버(updateOrder)에서 한 번 더 봅니다 —
//   화면만 막으면 주소를 직접 쳐서 들어옵니다 (설계서 §5.3 결정 2).
// =========================================================

import { notFound, redirect } from 'next/navigation';
import { requireSector } from '@/server/policies/session';
import { getOrderDetail } from '@/server/repositories/order';
import { getImplantCatalog, listImplantFavorites } from '@/server/repositories/implant';
import { getProductionOptions } from '@/server/repositories/production-option';
import { listOptionPresets } from '@/server/repositories/option-preset';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { getHolidayMap } from '@/server/repositories/holiday';
import { todayInKst } from '@/server/domain/week';
import { defaultDueDate } from '@/server/domain/due-date';
import { canEditSpec } from '@/server/domain/order-status';
import { toFormInitial } from '@/components/order/orderFormInitial';
import NewOrderForm from '@/components/order/NewOrderForm';

export const dynamic = 'force-dynamic';

interface EditOrderPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function DesignEditOrderPage({ params }: EditOrderPageProps) {
  const { orderId } = await params;
  await requireSector('design_center');

  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  if (!canEditSpec(order.status, 'design_center')) redirect(`/design/orders/${orderId}`);

  const [implantCatalog, implantFavorites, optionGroups, optionPresets, prosthesisCatalog, holidays] =
    await Promise.all([
      getImplantCatalog(),
      // ★ 그 치과의 즐겨찾기입니다. 디자인센터 자기 것이 아닙니다
      listImplantFavorites(order.clinic_org_id),
      getProductionOptions(),
      listOptionPresets(order.clinic_org_id),
      // 꺼진 제품도 함께 — 지난 주문이 그 조합을 가리킵니다
      getProsthesisCatalog({ includeInactive: true }),
      getHolidayMap(),
    ]);

  const today = todayInKst();

  return (
    <NewOrderForm
      /* ★ 주문의 주인은 그 치과입니다. 디자인센터 이름을 적으면 안 됩니다 */
      clinicName={order.clinic_name}
      today={today}
      defaultDue={defaultDueDate(today, holidays)}
      holidays={holidays}
      implantCatalog={implantCatalog}
      implantFavorites={implantFavorites}
      optionGroups={optionGroups}
      optionPresets={optionPresets}
      prosthesisCatalog={prosthesisCatalog}
      initial={toFormInitial(order, optionGroups)}
      basePath="/design/orders"
    />
  );
}
