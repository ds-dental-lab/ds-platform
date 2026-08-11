// =========================================================
// 놓을 위치: src/app/design/billing/page.tsx
//
// 정산관리 — 거래처 하나의 한 기간을 봅니다.
//
// ★ 기간은 거래처의 정산 기준일이 가릅니다 (2026-08-11 결정).
//   1일 치과의 2026-08 은 08-01~08-31, 26일 치과는 07-26~08-25 입니다.
//   같은 날 배송한 같은 물건이 치과에 따라 다른 달로 갑니다.
//
// ★ 열린 기간은 표에 줄이 없습니다. 주문에서 그때그때 셈합니다.
//   마감을 눌러야 그 결과가 billing_lines 로 굳습니다.
//   (마감 버튼은 아직 없습니다 — 조회부터 맞추고 붙입니다)
// =========================================================

import { requireSector } from '@/server/policies/session';
import { listPartners } from '@/server/repositories/partner';
import { getSettlement, listPeriods } from '@/server/repositories/billing';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { periodRange, isValidYearMonth } from '@/server/domain/billing';
import { todayInKst } from '@/server/domain/week';
import SettlementScreen from '@/components/billing/SettlementScreen';

export const dynamic = 'force-dynamic';

export default async function DesignBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; party?: string; ym?: string }>;
}) {
  await requireSector('design_center');

  const query = await searchParams;
  const parties = await listPartners();

  const type = query.type === 'lab' ? 'lab' : 'clinic';
  const partner =
    parties.find((p) => p.id === query.party && p.orgType === type) ?? null;

  // 아무것도 안 골랐으면 이번 달을 봅니다
  const yearMonth = isValidYearMonth(query.ym ?? '')
    ? query.ym!
    : todayInKst().slice(0, 7);

  if (!partner) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <SettlementScreen
          parties={parties}
          partner={null}
          yearMonth={yearMonth}
          settlement={null}
          closed={false}
          paid={false}
        />
        <div className="pb-10" />
      </div>
    );
  }

  const { from, to } = periodRange(yearMonth, partner.closingDay);

  const [catalog, periods] = await Promise.all([
    // 판 지난 제품도 이름을 잃지 않게 꺼진 것까지 가져옵니다
    getProsthesisCatalog({ includeInactive: true }),
    listPeriods(partner.id),
  ]);

  const settlement = await getSettlement(partner, from, to, catalog);
  const period = periods.find((p) => p.yearMonth === yearMonth) ?? null;

  return (
    <div className="mx-auto max-w-[1400px]">
      <SettlementScreen
        parties={parties}
        partner={partner}
        yearMonth={yearMonth}
        settlement={settlement}
        closed={Boolean(period?.closedAt)}
        paid={Boolean(period?.paidAt)}
      />
      <div className="pb-10" />
    </div>
  );
}
