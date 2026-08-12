// =========================================================
// 놓을 위치: src/app/clinic/billing/[yearMonth]/page.tsx
//
// 치과가 받은 청구서. 인쇄해서 보관하거나 결재에 올립니다.
//
// ★ 방향이 기공소와 반대입니다.
//   디자인센터가 공급자, 치과가 공급받는 자입니다.
//   (기공소 청구서는 기공소가 공급자입니다 — 같은 틀에 방향만 다릅니다)
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

export default async function ClinicInvoicePage({
  params,
}: {
  params: Promise<{ yearMonth: string }>;
}) {
  const session = await requireSector('clinic');
  const { yearMonth } = await params;

  if (!isValidYearMonth(yearMonth)) notFound();

  /*
    ★ 서로를 안 쓰는 넷을 **함께** 부릅니다.
      기간을 찾을 때 me.id 를 기다렸는데, getPartner(orgId) 는 그 조직을
      그대로 돌려주므로 me.id 는 session.orgId 와 같습니다.
      즉 기다릴 이유가 없었습니다. 다섯 단계 → 두 단계.
  */
  const supabase = await createClient();

  const [me, period, catalog, { data }] = await Promise.all([
    getPartner(session.orgId!),
    getPeriod(session.orgId!, yearMonth),
    getProsthesisCatalog({ includeInactive: true }),
    // 청구하는 쪽 — 전속 디자인센터 (통합 모델이라 하나뿐입니다)
    supabase
      .from('organizations')
      .select('name, biz_no, ceo_name, address')
      .eq('org_type', 'design_center')
      .limit(1)
      .maybeSingle(),
  ]);

  if (!me) notFound();
  if (!period?.closedAt) notFound();

  // 이것만 앞의 결과를 씁니다 (기간·제품)
  const { from, to } = periodRange(yearMonth, me.closingDay);
  const settlement = await getClosedSettlement(period.id, from, to, catalog);

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
          href={`/clinic/billing?ym=${yearMonth}`}
          className="h-9 rounded-md border border-[#DDE2EA] bg-white px-3.5 text-[12.5px] font-semibold leading-9 text-[#4A5567] hover:bg-[#F4F6F9]"
        >
          ← 정산으로
        </Link>

        <PrintButton />

        <span className="text-[12px] text-[#98A2B3]">
          금액이 다르면 디자인센터에 알려 주세요.
        </span>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] print:border-0">
        <InvoiceSheet
          parties={invoicePartiesFor('clinic')}
          issuer={{
            name: design.name,
            bizNo: design.biz_no,
            ceoName: design.ceo_name,
            address: design.address,
          }}
          receiver={{
            name: me.name,
            bizNo: me.bizNo,
            ceoName: me.ceoName,
            address: me.address,
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
