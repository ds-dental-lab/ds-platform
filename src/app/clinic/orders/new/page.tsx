// =========================================================
// 놓을 위치: src/app/clinic/orders/new/page.tsx
//
// 주문등록. 폼은 브라우저에서 돌아가야 하므로 클라이언트 컴포넌트지만,
// 마스터 데이터와 오늘 날짜는 여기(서버)에서 읽어 넘깁니다.
//
// ★ '오늘'을 서버에서 정합니다. 브라우저 시계는 사용자가 바꿀 수 있어
//   최소 납기 계산의 기준으로 삼을 수 없습니다.
// =========================================================

import { requireSector } from '@/server/policies/session';
import { getImplantCatalog, listImplantFavorites } from '@/server/repositories/implant';
import { getProductionOptions } from '@/server/repositories/production-option';
import { listOptionPresets } from '@/server/repositories/option-preset';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { getHolidayMap } from '@/server/repositories/holiday';
import { todayInKst } from '@/server/domain/week';
import { defaultDueDate } from '@/server/domain/due-date';
import NewOrderForm from '@/components/order/NewOrderForm';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const session = await requireSector('clinic');

  /*
    ★ 휴일도 **함께** 부릅니다.
      전에는 Promise.all 뒤에 따로 await 로 붙어 있었습니다. 다른 것을
      하나도 안 쓰는데 줄 맨 뒤에서 혼자 기다린 셈이라, 왕복 하나가
      고스란히 화면 뜨는 시간에 더해졌습니다.
  */
  const [implantCatalog, implantFavorites, optionGroups, optionPresets, prosthesisCatalog, holidays] =
    await Promise.all([
      getImplantCatalog(),
      listImplantFavorites(),
      getProductionOptions(),
      listOptionPresets(),
      getProsthesisCatalog(),
      // 쉬는 날은 요청시한 달력에서 빠집니다 (디자인센터 휴일 화면이 쥡니다)
      getHolidayMap(),
    ]);

  const today = todayInKst();

  return (
    <NewOrderForm
      clinicName={session.orgName ?? ''}
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
