// =========================================================
// 놓을 위치: src/app/clinic/scans/page.tsx
//
// 구강스캐너에서 올라온 스캔 목록 (사용자 요청 2026-10-02).
// 여기 남아 있으면 아직 주문서를 안 쓴 것입니다.
// =========================================================

import { notFound } from 'next/navigation';
import { requireSession } from '@/server/policies/session';
import { listIncomingScans, listRescanWaitingOrders } from '@/server/repositories/device-link';
import IncomingScanList from '@/components/order/IncomingScanList';

export const dynamic = 'force-dynamic';

export default async function IncomingScansPage() {
  const session = await requireSession();
  if (session.orgType !== 'clinic') notFound();

  const [scans, rescanOrders] = await Promise.all([listIncomingScans(), listRescanWaitingOrders()]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-1">
      <header>
        <h1 className="text-[19px] font-extrabold tracking-[-0.03em] text-[#1A2130]">들어온 스캔</h1>
        <p className="mt-1 text-[14px] text-[#7C8595]">
          구강스캐너에서 내보낸 스캔입니다. 주문서를 쓰면 이 목록에서 사라집니다.
        </p>
      </header>

      <IncomingScanList
        scans={scans}
        clinicName={session.orgName ?? ''}
        rescanOrders={rescanOrders}
      />
    </div>
  );
}
