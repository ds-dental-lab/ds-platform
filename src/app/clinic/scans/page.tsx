// =========================================================
// 놓을 위치: src/app/clinic/scans/page.tsx
//
// 올라왔는데 **주문서를 아직 안 쓴** 스캔 (사용자 요청 2026-10-02).
// 이름은 '들어온 스캔' 이었는데 '주문서 대기' 로 바꿨습니다 (2026-10-06) —
// 할 일이라는 것이 안 읽혔습니다.
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
        <h1 className="text-[19px] font-extrabold tracking-[-0.03em] text-[#1A2130]">주문서 대기</h1>
        <p className="mt-1 text-[14px] text-[#7C8595]">
          스캔은 올라왔는데 주문서를 아직 안 쓴 것들입니다. 주문서를 쓰면 사라집니다.
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
