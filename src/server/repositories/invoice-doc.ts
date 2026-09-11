// =========================================================
// 놓을 위치: src/server/repositories/invoice-doc.ts
//
// 청구서 한 장의 재료 — 화면(InvoiceSheet)과 PDF 가 **같은 것**을 씁니다.
// (2026-09-07, PDF 내려받기를 붙이며 세 화면에 흩어져 있던 것을 모음)
//
// ★ 보는 사람에 따라 상대가 정해집니다.
//     디자인센터  partyOrgId 의 거래처 (치과·기공소)
//     치과        나 ↔ 디자인센터   (디자인센터가 청구)
//     기공소      나 ↔ 디자인센터   (기공소가 청구)
// ★ 마감된 기간만 줍니다. 열린 기간은 금액이 아직 움직입니다.
// ★ 남의 것은 RLS 가 막지만, 치과·기공소가 partyOrgId 를 바꿔 치는
//   길은 여기서도 막습니다 — 자기 조직만 봅니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getPartner } from '@/server/repositories/partner';
import { getClosedSettlement, getPeriod, billingRangeOf } from '@/server/repositories/billing';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { invoicePartiesFor, isValidYearMonth, invoiceFileName } from '@/server/domain/billing';
import type { InvoiceSheetProps } from '@/components/billing/InvoiceSheet';

type Viewer = { orgType: 'clinic' | 'design_center' | 'lab'; orgId: string; orgName: string | null };

interface OrgCard {
  name: string;
  biz_no: string | null;
  ceo_name: string | null;
  address: string | null;
}

export interface InvoiceDoc {
  props: InvoiceSheetProps;
  /** 'INV-26000011' — 없으면 미발행 */
  invoiceNo: string | null;
  /** 저장 파일 이름 (확장자 없이) */
  fileName: string;
}

export async function loadInvoiceDoc(
  viewer: Viewer,
  partyOrgId: string,
  yearMonth: string,
): Promise<InvoiceDoc | null> {
  if (!isValidYearMonth(yearMonth)) return null;
  // ★ 치과·기공소는 자기 것만
  if (viewer.orgType !== 'design_center' && partyOrgId !== viewer.orgId) return null;

  const supabase = await createClient();
  const isCenter = viewer.orgType === 'design_center';

  const [party, period, catalog, { data: center }, { data: invoiceRow }] = await Promise.all([
    getPartner(partyOrgId),
    getPeriod(partyOrgId, yearMonth),
    getProsthesisCatalog({ includeInactive: true }),
    isCenter
      ? supabase.from('organizations').select('name, biz_no, ceo_name, address').eq('id', viewer.orgId).maybeSingle()
      : supabase.from('organizations').select('name, biz_no, ceo_name, address').eq('org_type', 'design_center').limit(1).maybeSingle(),
    supabase.from('billing_periods').select('invoice_no').eq('party_org_id', partyOrgId).eq('year_month', yearMonth).maybeSingle(),
  ]);

  if (!party || !period?.closedAt) return null;

  const { from, to } = await billingRangeOf(partyOrgId, yearMonth, party.closingDay);
  const settlement = await getClosedSettlement(period.id, from, to, catalog);

  const design = (center ?? { name: viewer.orgName ?? '디자인센터', biz_no: null, ceo_name: null, address: null }) as OrgCard;
  const us = { name: design.name, bizNo: design.biz_no, ceoName: design.ceo_name, address: design.address };
  const them = { name: party.name, bizNo: party.bizNo, ceoName: party.ceoName, address: party.address };

  const parties = invoicePartiesFor(party.orgType);
  // ★ 기공소 청구서는 기공소가 보내는 쪽입니다
  const issuer = parties.from === 'design_center' ? us : them;
  const receiver = parties.from === 'design_center' ? them : us;

  return {
    props: { parties, issuer, receiver, yearMonth, settlement, issuedAt: period.issuedAt, paidAt: period.paidAt },
    invoiceNo: (invoiceRow as { invoice_no: string | null } | null)?.invoice_no ?? null,
    fileName: invoiceFileName(parties.title, receiver.name, yearMonth),
  };
}
