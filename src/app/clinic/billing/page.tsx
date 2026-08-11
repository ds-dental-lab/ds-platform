// =========================================================
// 놓을 위치: src/app/clinic/billing/page.tsx
//
// 정산 (치과). 이번 달 얼마가 청구되는지 세부내역을 봅니다.
//
// ★ 치과가 직접 확인합니다.
//   청구서를 받고 나서야 금액을 아는 것보다, 달이 가는 동안 얼마가
//   쌓이는지 보이는 편이 낫습니다. 다르면 마감 전에 말할 수 있습니다.
//
// ★ 여기서는 아무것도 바꾸지 못합니다.
//   단가를 정하는 쪽은 디자인센터입니다. 숫자가 다르면 대화로 알립니다.
//
// ★ 기공원가는 절대 안 보입니다 (설계서 §8.5).
//   lab_product_costs 는 치과에 0행으로 막혀 있고, 이 화면이 읽는 금액은
//   치과 자기 판매가뿐입니다.
// =========================================================

import { requireSector } from '@/server/policies/session';
import { getPartner } from '@/server/repositories/partner';
import {
  getSettlement,
  getClosedSettlement,
  getPeriod,
} from '@/server/repositories/billing';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { periodRange, isValidYearMonth } from '@/server/domain/billing';
import { todayInKst } from '@/server/domain/week';
import PartySettlement from '@/components/billing/PartySettlement';

export const dynamic = 'force-dynamic';

export default async function ClinicBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await requireSector('clinic');
  const query = await searchParams;
  const today = todayInKst();

  const yearMonth = isValidYearMonth(query.ym ?? '') ? query.ym! : today.slice(0, 7);

  // 자기 자신을 거래처로 읽습니다 — RLS 가 자기 줄만 내줍니다
  const me = await getPartner(session.orgId!);
  if (!me) {
    return (
      <p className="rounded-lg border border-[#E8EBF0] bg-white px-5 py-16 text-center text-[13px] text-[#98A2B3]">
        정산 정보를 읽지 못했습니다.
      </p>
    );
  }

  const { from, to } = periodRange(yearMonth, me.closingDay);

  const [catalog, period] = await Promise.all([
    getProsthesisCatalog({ includeInactive: true }),
    getPeriod(me.id, yearMonth),
  ]);

  const closed = Boolean(period?.closedAt);

  const settlement = closed
    ? await getClosedSettlement(period!.id, from, to, catalog)
    : await getSettlement(me, from, to, catalog);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PartySettlement
        me={me}
        yearMonth={yearMonth}
        settlement={settlement}
        closed={closed}
        issued={Boolean(period?.issuedAt)}
        paid={Boolean(period?.paidAt)}
        basePath="/clinic/billing"
      />
      <div className="pb-10" />
    </div>
  );
}
