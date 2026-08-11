// =========================================================
// 놓을 위치: src/app/design/billing/invoices/page.tsx
//
// 청구 내역 — 이미 나간 청구서의 목록.
//
// ★ 발행 전(마감만 한) 기간은 안 나옵니다.
//   여기는 '나간 문서' 의 자리입니다. 마감만 한 것을 섞으면 "보냈다" 는
//   사실이 흐려집니다 — 그건 정산 탭이 봅니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { listInvoices } from '@/server/repositories/invoice';
import { todayInKst } from '@/server/domain/week';
import { prevYearMonth, yearMonthOf } from '@/server/domain/billing';
import BillingTabs from '@/components/billing/BillingTabs';
import BillingFilter from '@/components/billing/BillingFilter';
import InvoiceTable from '@/components/billing/InvoiceTable';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; name?: string }>;
}) {
  await requireManagerSector('design_center');

  const q = await searchParams;
  const thisMonth = yearMonthOf(todayInKst());

  const from = q.from ?? prevYearMonth(thisMonth);
  const to = q.to ?? thisMonth;

  const rows = await listInvoices({ fromMonth: from, toMonth: to, name: q.name });

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <BillingTabs active="/design/billing/invoices" />
      <BillingFilter basePath="/design/billing/invoices" from={from} to={to} name={q.name} />
      <InvoiceTable rows={rows} />
      <div className="pb-10" />
    </div>
  );
}
