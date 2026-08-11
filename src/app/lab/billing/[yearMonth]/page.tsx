// =========================================================
// 놓을 위치: src/app/lab/billing/[yearMonth]/page.tsx
//
// 기공소가 보는 자기 청구서. 인쇄해서 보내면 됩니다.
//
// ★ 이 문서는 기공소가 디자인센터에 보내는 것입니다 (사용자 확정).
//   공급자가 기공소, 공급받는 자가 디자인센터입니다.
//
// ★ 마감된 기간만 뽑습니다.
//   집계 중인 금액으로 뽑은 종이는 내일이면 틀린 문서가 됩니다.
// =========================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireSector } from '@/server/policies/session';
import { getPartner } from '@/server/repositories/partner';
import { getClosedSettlement, getPeriod } from '@/server/repositories/billing';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { periodRange, invoicePartiesFor, isValidYearMonth } from '@/server/domain/billing';
import InvoiceSheet from '@/components/billing/InvoiceSheet';
import PrintButton from '@/components/billing/PrintButton';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LabInvoicePage({
  params,
}: {
  params: Promise<{ yearMonth: string }>;
}) {
  const session = await requireSector('lab');
  const { yearMonth } = await params;

  if (!isValidYearMonth(yearMonth)) notFound();

  const me = await getPartner(session.orgId!);
  if (!me) notFound();

  const period = await getPeriod(me.id, yearMonth);
  if (!period?.closedAt) notFound();

  const { from, to } = periodRange(yearMonth, me.closingDay);
  const catalog = await getProsthesisCatalog({ includeInactive: true });
  const settlement = await getClosedSettlement(period.id, from, to, catalog);

  // 받는 쪽 — 이 주문들을 맡긴 디자인센터
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('name, biz_no, ceo_name, address')
    .eq('org_type', 'design_center')
    .limit(1)
    .maybeSingle();

  const design = (data ?? { name: '디자인센터', biz_no: null, ceo_name: null, address: null }) as {
    name: string;
    biz_no: string | null;
    ceo_name: string | null;
    address: string | null;
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href={`/lab/billing?ym=${yearMonth}`}
          className="h-9 rounded-md border border-[#DDE2EA] bg-white px-3.5 text-[12.5px] font-semibold leading-9 text-[#4A5567] hover:bg-[#F4F6F9]"
        >
          ← 정산으로
        </Link>

        <PrintButton />

        <span className="text-[12px] text-[#98A2B3]">
          발행은 디자인센터가 표시합니다. 이 종이는 언제든 뽑을 수 있습니다.
        </span>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] print:border-0">
        <InvoiceSheet
          parties={invoicePartiesFor('lab')}
          issuer={{
            name: me.name,
            bizNo: me.bizNo,
            ceoName: me.ceoName,
            address: me.address,
          }}
          receiver={{
            name: design.name,
            bizNo: design.biz_no,
            ceoName: design.ceo_name,
            address: design.address,
          }}
          yearMonth={yearMonth}
          settlement={settlement}
          issuedAt={period.issuedAt}
          paidAt={period.paidAt}
        />
      </div>

      <div className="pb-10 print:hidden" />
    </div>
  );
}
