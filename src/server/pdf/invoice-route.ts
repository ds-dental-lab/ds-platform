// =========================================================
// 놓을 위치: src/server/pdf/invoice-route.ts
//
// 세 섹터의 PDF 주소가 같이 쓰는 한 줄. (2026-09-07)
//   /design/billing/[partyOrgId]/[yearMonth]/pdf   센터
//   /clinic/billing/[yearMonth]/pdf                치과 (partyOrgId = 나)
//   /lab/billing/[yearMonth]/pdf                   기공소 (partyOrgId = 나)
//
// ★ 로그인이 없으면 proxy 가 /login?next=… 로 보냅니다 — 메일의 링크를
//   눌러도 로그인 뒤 바로 파일이 내려옵니다. 여기까지 왔는데 세션이
//   없으면(만료) 404 대신 로그인으로 보냅니다.
// ★ 파일 이름은 화면의 '인쇄 → PDF 저장' 과 같은 규칙(invoiceFileName).
//   브라우저마다 한글 이름을 다르게 다뤄 RFC 5987 (filename*) 로 적습니다.
// =========================================================

import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/policies/session';
import { loadInvoiceDoc } from '@/server/repositories/invoice-doc';
import { renderInvoicePdf } from '@/server/pdf/invoice-pdf';

export async function invoicePdfResponse(
  sector: 'clinic' | 'design_center' | 'lab',
  partyOrgId: string | null,
  yearMonth: string,
  requestUrl: string,
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    const next = new URL(requestUrl).pathname;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (session.orgType !== sector || !session.orgId) return new Response('not found', { status: 404 });

  const doc = await loadInvoiceDoc(
    { orgType: sector, orgId: session.orgId, orgName: session.orgName },
    partyOrgId ?? session.orgId,
    yearMonth,
  );
  if (!doc) return new Response('not found', { status: 404 });

  const pdf = await renderInvoicePdf(doc.props);
  const name = `${doc.fileName}.pdf`;
  const ascii = name.replace(/[^\x20-\x7E]/g, '_');

  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'private, no-store',
    },
  });
}
