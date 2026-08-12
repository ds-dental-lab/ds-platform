// =========================================================
// 놓을 위치: src/app/design/billing/[partyOrgId]/[yearMonth]/page.tsx
//
// 청구서 한 장. 화면에서 보고 그대로 인쇄합니다.
//
// ★ 마감된 기간만 뽑습니다.
//   열린 기간은 금액이 아직 움직입니다. 그 상태로 뽑은 종이는
//   내일이면 틀린 문서가 됩니다.
//
// ★ 방향은 거래처 종류가 정합니다 (사용자 확정 2026-08-12).
//     치과   디자인센터 → 치과
//     기공소 기공소 → 디자인센터
// =========================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireManagerSector } from '@/server/policies/session';
import { getPartner } from '@/server/repositories/partner';
import { getClosedSettlement, getPeriod } from '@/server/repositories/billing';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { periodRange, invoicePartiesFor, isValidYearMonth } from '@/server/domain/billing';
import InvoiceSheet from '@/components/billing/InvoiceSheet';
import InvoiceBar from '@/components/billing/InvoiceBar';
import AutoPrint from '@/components/billing/AutoPrint';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ partyOrgId: string; yearMonth: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const session = await requireManagerSector('design_center');
  const { partyOrgId, yearMonth } = await params;
  // 청구 내역의 ⬇ 가 이 주소로 엽니다 — 뜨자마자 인쇄창을 띄웁니다
  const { print } = await searchParams;

  if (!isValidYearMonth(yearMonth)) notFound();

  /*
    ★ 서로를 안 쓰는 넷을 **함께** 부릅니다.
      전에는 거래처 → 정산기간 → 제품목록 → 우리조직 순으로 줄을 세웠는데,
      넷 다 앞의 결과를 하나도 안 씁니다 (기간도 partyOrgId 로 찾습니다).
      다섯 단계였던 것이 두 단계가 됩니다.
  */
  const supabase = await createClient();

  const [partner, period, catalog, { data }] = await Promise.all([
    getPartner(partyOrgId),
    getPeriod(partyOrgId, yearMonth),
    getProsthesisCatalog({ includeInactive: true }),
    // 우리 조직 정보 — 문서의 한쪽에 들어갑니다
    supabase
      .from('organizations')
      .select('name, biz_no, ceo_name, address')
      .eq('id', session.orgId!)
      .maybeSingle(),
  ]);

  if (!partner) notFound();
  // 마감 전에는 뽑을 것이 없습니다
  if (!period?.closedAt) notFound();

  // 이것만 앞의 결과를 씁니다 (기간·제품)
  const { from, to } = periodRange(yearMonth, partner.closingDay);
  const settlement = await getClosedSettlement(period.id, from, to, catalog);

  const parties = invoicePartiesFor(partner.orgType);

  const mine = (data ?? { name: session.orgName ?? '', biz_no: null, ceo_name: null, address: null }) as {
    name: string;
    biz_no: string | null;
    ceo_name: string | null;
    address: string | null;
  };

  const us = {
    name: mine.name,
    bizNo: mine.biz_no,
    ceoName: mine.ceo_name,
    address: mine.address,
  };

  const them = {
    name: partner.name,
    bizNo: partner.bizNo,
    ceoName: partner.ceoName,
    address: partner.address,
  };

  // ★ 기공소 청구서는 기공소가 보내는 쪽입니다
  const issuer = parties.from === 'design_center' ? us : them;
  const receiver = parties.from === 'design_center' ? them : us;

  return (
    <div className="mx-auto max-w-[900px]">
      <AutoPrint on={print === '1'} />

      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href={`/design/billing?type=${partner.orgType}&party=${partner.id}&ym=${yearMonth}`}
          className="h-9 rounded-md border border-[#DDE2EA] bg-white px-3.5 text-[12.5px] font-semibold leading-9 text-[#4A5567] hover:bg-[#F4F6F9]"
        >
          ← 정산으로
        </Link>

        <InvoiceBar
          partyOrgId={partner.id}
          yearMonth={yearMonth}
          issued={Boolean(period.issuedAt)}
          paid={Boolean(period.paidAt)}
        />
      </div>

      <div className="rounded-lg border border-[#E8EBF0] print:border-0">
        <InvoiceSheet
          parties={parties}
          issuer={issuer}
          receiver={receiver}
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
