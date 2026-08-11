// =========================================================
// 놓을 위치: src/app/design/billing/page.tsx
//
// 정산관리 — 거래처 하나의 한 기간을 봅니다.
//
// ★ 기간은 거래처의 정산 기준일이 가릅니다 (2026-08-11 결정).
//   1일 치과의 2026-08 은 08-01~08-31, 26일 치과는 07-26~08-25 입니다.
//   같은 날 배송한 같은 물건이 치과에 따라 다른 달로 갑니다.
//
// ★ 열린 기간은 주문에서 그때그때 셈하고, 마감된 기간은 굳은 줄을 읽습니다.
//   마감한 뒤에 단가를 고치거나 주문을 손대도 지난 청구서는 그대로여야
//   합니다. 읽는 곳을 갈라 두면 그 약속이 저절로 지켜집니다.
// =========================================================

import { requireSector } from '@/server/policies/session';
import { listPartners } from '@/server/repositories/partner';
import {
  getSettlement,
  getClosedSettlement,
  getPeriod,
} from '@/server/repositories/billing';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { periodRange, isValidYearMonth, canClosePeriod } from '@/server/domain/billing';
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
  const today = todayInKst();

  const type = query.type === 'lab' ? 'lab' : 'clinic';
  const partner =
    parties.find((p) => p.id === query.party && p.orgType === type) ?? null;

  // 아무것도 안 골랐으면 이번 달을 봅니다
  const yearMonth = isValidYearMonth(query.ym ?? '') ? query.ym! : today.slice(0, 7);

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
          issued={false}
        />
        <div className="pb-10" />
      </div>
    );
  }

  const { from, to } = periodRange(yearMonth, partner.closingDay);

  const [catalog, period] = await Promise.all([
    // 판 지난 제품도 이름을 잃지 않게 꺼진 것까지 가져옵니다
    getProsthesisCatalog({ includeInactive: true }),
    getPeriod(partner.id, yearMonth),
  ]);

  const closed = Boolean(period?.closedAt);

  // ★ 마감된 기간은 굳은 줄에서, 열린 기간은 주문에서
  const settlement = closed
    ? await getClosedSettlement(period!.id, from, to, catalog)
    : await getSettlement(partner, from, to, catalog);

  const verdict = canClosePeriod({ from, to }, today, closed);

  return (
    <div className="mx-auto max-w-[1400px]">
      <SettlementScreen
        parties={parties}
        partner={partner}
        yearMonth={yearMonth}
        settlement={settlement}
        closed={closed}
        paid={Boolean(period?.paidAt)}
        issued={Boolean(period?.issuedAt)}
        closeBlockedReason={verdict.ok ? undefined : verdict.reason}
      />
      <div className="pb-10" />
    </div>
  );
}
