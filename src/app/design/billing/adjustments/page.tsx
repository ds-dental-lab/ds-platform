// =========================================================
// 놓을 위치: src/app/design/billing/adjustments/page.tsx
//
// 조정 내역 — 깎거나 더한 금액과 그 사유.
//
// ★ 기간은 **조정을 적은 때** 로 자릅니다.
//   조정은 여러 달의 주문에 걸릴 수 있어, 정산 달로 자르면 "어제 깎은
//   것" 이 목록에서 안 보이는 일이 생깁니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { listAdjustments } from '@/server/repositories/invoice';
import { todayInKst } from '@/server/domain/week';
import { prevYearMonth, yearMonthOf } from '@/server/domain/billing';
import BillingTabs from '@/components/billing/BillingTabs';
import BillingFilter from '@/components/billing/BillingFilter';
import AdjustmentTable from '@/components/billing/AdjustmentTable';

export const dynamic = 'force-dynamic';

export default async function AdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; name?: string }>;
}) {
  await requireManagerSector('design_center');

  const q = await searchParams;
  const thisMonth = yearMonthOf(todayInKst());

  const from = q.from ?? prevYearMonth(prevYearMonth(prevYearMonth(thisMonth)));
  const to = q.to ?? thisMonth;

  const all = await listAdjustments(from, to);
  const rows = q.name ? all.filter((r) => r.partyName.includes(q.name!.trim())) : all;

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <BillingTabs active="/design/billing/adjustments" />
      <BillingFilter basePath="/design/billing/adjustments" from={from} to={to} name={q.name} />
      <AdjustmentTable rows={rows} />
      <div className="pb-10" />
    </div>
  );
}
