// 센터 — 거래처 청구서 PDF (2026-09-07). 재료·응답은 server/pdf/invoice-route
import { invoicePdfResponse } from '@/server/pdf/invoice-route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ partyOrgId: string; yearMonth: string }> }) {
  const { partyOrgId, yearMonth } = await params;
  return invoicePdfResponse('design_center', partyOrgId, yearMonth, request.url);
}
