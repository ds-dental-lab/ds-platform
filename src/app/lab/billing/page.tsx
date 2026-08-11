// =========================================================
// 놓을 위치: src/app/lab/billing/page.tsx
//
// 정산 (기공소). 자기가 받을 값의 세부내역을 봅니다.
//
// ★ 기공소가 직접 확인합니다 (사용자 결정 2026-08-12).
//   디자인센터가 셈해 준 값을 말로만 듣고 받을 수는 없습니다.
//   어느 주문의 어느 치아가 얼마인지 스스로 봐야 맞는지 압니다.
//   디자인센터는 그 내역을 검수·기록용으로 함께 봅니다.
//
// ★ 여기서는 아무것도 바꾸지 못합니다.
//   기공원가를 정하는 쪽은 디자인센터입니다. 숫자가 다르면 대화로 알립니다.
//   마감·조정 버튼이 없는 것이 그 뜻입니다.
//
// ★ 치과 판매가는 안 보입니다 (설계서 §8.5).
//   제품 표가 기공소에 닫혀 있고, 금액은 기공원가에서만 나옵니다.
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

export default async function LabBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const session = await requireSector('lab');
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
        basePath="/lab/billing"
      />
      <div className="pb-10" />
    </div>
  );
}
