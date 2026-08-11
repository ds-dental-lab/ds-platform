// =========================================================
// 놓을 위치: src/app/design/billing/payments/page.tsx
//
// 정산 내역 — 들어온 돈.
// =========================================================

import { requireSector } from '@/server/policies/session';
import { listPayments } from '@/server/repositories/invoice';
import { todayInKst } from '@/server/domain/week';
import { prevYearMonth, yearMonthOf } from '@/server/domain/billing';
import BillingTabs from '@/components/billing/BillingTabs';
import BillingFilter from '@/components/billing/BillingFilter';
import PaymentTable from '@/components/billing/PaymentTable';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireSector('design_center');

  const q = await searchParams;
  const thisMonth = yearMonthOf(todayInKst());

  const from = q.from ?? prevYearMonth(thisMonth);
  const to = q.to ?? thisMonth;

  const rows = await listPayments(from, to);

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <BillingTabs active="/design/billing/payments" />
      <BillingFilter basePath="/design/billing/payments" from={from} to={to} />
      <PaymentTable rows={rows} />
      <div className="pb-10" />
    </div>
  );
}
