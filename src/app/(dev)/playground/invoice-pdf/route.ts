// =========================================================
// 놓을 위치: src/app/(dev)/playground/invoice-pdf/route.ts
//
// 청구서 PDF 를 로그인 없이 시험 자료로 뽑아 보는 시연 주소. (2026-09-07)
// ★ 개발에서만 열립니다 — 운영은 404 ((dev)/layout 과 같은 규칙을 여기서도).
// =========================================================

import { renderInvoicePdf } from '@/server/pdf/invoice-pdf';
import { invoicePartiesFor } from '@/server/domain/billing';
import type { Settlement, SettlementItem } from '@/server/repositories/billing';

export const dynamic = 'force-dynamic';

function item(over: Partial<SettlementItem>): SettlementItem {
  return {
    orderId: 'o', itemId: Math.random().toString(36).slice(2), orderNo: 'ORD-260801-001',
    receivedAt: '2026-07-03', shippedAt: '2026-07-08', patientLabel: '김민서',
    remakeSeq: 0, isRemake: false, billable: true, typeCode: 'CR', materialCode: 'ZIR',
    label: 'Crown / Zirconia', toothNumber: 26, isPontic: false, hasGingival: false,
    amount: 45000, unpriced: false, adjustment: 0, adjustmentReason: '',
    price: 45000, ponticPrice: null, pinkPrice: null, ...over,
  };
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') return new Response('not found', { status: 404 });

  const items = [
    item({ itemId: 'a', toothNumber: 26 }),
    item({ itemId: 'b', toothNumber: 15, patientLabel: '이서준', orderNo: 'ORD-260801-002' }),
    item({ itemId: 'c', toothNumber: 16, patientLabel: '이서준', orderNo: 'ORD-260801-002', isPontic: true, label: 'Crown / Zirconia (Pontic)' }),
    item({ itemId: 'd', toothNumber: 17, patientLabel: '이서준', orderNo: 'ORD-260801-002' }),
    item({ itemId: 'e', toothNumber: 36, patientLabel: '박지우', orderNo: 'ORD-260801-003', adjustment: -5000, adjustmentReason: '마진 재조정 할인' }),
    item({ itemId: 'f', toothNumber: 46, patientLabel: '최하은', orderNo: 'ORD-260801-004', isRemake: true, remakeSeq: 1, billable: false, amount: 0 }),
  ];
  const settlement: Settlement = {
    from: '2026-06-27', to: '2026-07-26', items,
    products: [{ key: 'CR/ZIR', label: 'Crown / Zirconia', count: 5, amount: 225000, unpriced: false }],
    subtotal: 225000, adjustment: -5000, total: 220000, unpricedCount: 0,
    bridgeOf: { b: 'br1', c: 'br1', d: 'br1' },
  };

  const pdf = await renderInvoicePdf({
    parties: invoicePartiesFor('clinic'),
    issuer: { name: '덴플로우 치과기공소', bizNo: '728-90-02198', ceoName: '이대신', address: '경기도 하남시 미사강변서로 16, 9층 F934호' },
    receiver: { name: '미사치과', bizNo: '123-45-67890', ceoName: '홍길동', address: '경기도 하남시 미사대로 100' },
    yearMonth: '2026-07',
    settlement,
    issuedAt: '2026-08-13T14:13:42Z',
    paidAt: null,
  });

  return new Response(new Uint8Array(pdf), { headers: { 'content-type': 'application/pdf' } });
}
