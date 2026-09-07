// 치과 — 받은 청구서 PDF (2026-09-07). 재료·응답은 server/pdf/invoice-route
import { invoicePdfResponse } from '@/server/pdf/invoice-route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ yearMonth: string }> }) {
  const { yearMonth } = await params;
  return invoicePdfResponse('clinic', null, yearMonth, request.url);
}
