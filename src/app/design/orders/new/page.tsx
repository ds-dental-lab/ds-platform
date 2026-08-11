// =========================================================
// 놓을 위치: src/app/design/orders/new/page.tsx
//
// 주문등록 (디자인센터). 전화·팩스로 들어오는 주문을 여기서 넣습니다.
//
// ★ 치과 화면과 같은 폼입니다.
//   다른 것은 두 가지뿐입니다 —
//     ① '치과' 칸이 글자가 아니라 고르는 칸입니다
//     ② 요청시한을 오늘부터 고를 수 있습니다
//
// ★ 화면 어디에도 '대신 넣는다' 는 말을 쓰지 않습니다 (사용자 요청 2026-08-12).
//   주문서에 그런 딱지가 붙으면 나중에 "누가 시킨 주문이냐" 는 다툼의
//   빌미가 됩니다. 주문은 그 치과의 주문입니다.
//   누가 입력했는지는 orders.created_by 에 남아 있어 확인할 수 있습니다.
//
// ★ 치과를 고르면 주소(?clinic=)가 바뀌고 폼이 새로 태어납니다.
//   임플란트·제작옵션 즐겨찾기가 치과마다 달라 서버에서 다시 읽어야 합니다.
// =========================================================

import { requireSector } from '@/server/policies/session';
import { listPartners } from '@/server/repositories/partner';
import { getImplantCatalog, listImplantFavorites } from '@/server/repositories/implant';
import { getProductionOptions } from '@/server/repositories/production-option';
import { listOptionPresets } from '@/server/repositories/option-preset';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { getHolidayMap } from '@/server/repositories/holiday';
import { todayInKst } from '@/server/domain/week';
import { defaultDueDate } from '@/server/domain/due-date';
import NewOrderForm from '@/components/order/NewOrderForm';

export const dynamic = 'force-dynamic';

export default async function DesignNewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ clinic?: string }>;
}) {
  await requireSector('design_center');

  const { clinic: clinicId } = await searchParams;
  const partners = await listPartners();

  // ★ 거래중인 치과만입니다. 끊은 곳에 새 주문이 들어가면 청구할 데가 없습니다
  const clinics = partners.filter((p) => p.orgType === 'clinic' && p.isActive);

  /**
   * ★ 거래처가 하나뿐이면 미리 골라 둡니다.
   *   고를 것이 없는데 고르라고 하면 손이 한 번 더 갑니다.
   *   여럿이면 비워 둡니다 — 첫 번째를 넣어 두면 엉뚱한 치과로 나갑니다.
   */
  const selected =
    clinics.find((c) => c.id === clinicId) ?? (clinics.length === 1 ? clinics[0] : null);

  const [implantCatalog, implantFavorites, optionGroups, optionPresets, prosthesisCatalog] =
    await Promise.all([
      getImplantCatalog(),
      // ★ 그 치과의 즐겨찾기입니다. 디자인센터 자기 것이 아닙니다
      selected ? listImplantFavorites(selected.id) : Promise.resolve([]),
      getProductionOptions(),
      selected ? listOptionPresets(selected.id) : Promise.resolve([]),
      getProsthesisCatalog(),
    ]);

  const today = todayInKst();
  // 쉬는 날은 요청시한 달력에서 빠집니다 (디자인센터 휴일 화면이 쥡니다)
  const holidays = await getHolidayMap();

  return (
    <NewOrderForm
      /*
        ★ 치과를 바꾸면 폼이 통째로 새로 태어납니다.
          앞 치과에서 적던 환자·치식이 남아 다른 치과 주문으로 넘어가면 안 됩니다.
      */
      key={selected?.id ?? 'none'}
      clinicName={selected?.name ?? ''}
      clinicOrgId={selected?.id}
      clinics={clinics.map((c) => ({ id: c.id, name: c.name }))}
      basePath="/design/orders"
      /*
        ★ 요청시한을 오늘부터 고를 수 있습니다.
          전화로 들어오는 건에는 이미 약속된 날짜가 있습니다.
          4영업일을 강요하면 실제와 다른 날을 적게 되고, 그 날짜로
          돌아가는 D-day·배송조회·정산 예상이 전부 어긋납니다.
      */
      dueDatePolicy="free"
      today={today}
      defaultDue={defaultDueDate(today, holidays)}
            holidays={holidays}
      implantCatalog={implantCatalog}
      implantFavorites={implantFavorites}
      optionGroups={optionGroups}
      optionPresets={optionPresets}
      prosthesisCatalog={prosthesisCatalog}
    />
  );
}
