// =========================================================
// 놓을 위치: src/app/(dev)/playground/uploading/page.tsx
//
// '스캔 대기' 상태가 화면에 어떻게 서는지. (작업지시서 §3-3)
// 진짜 화면은 로그인이 필요해서 모양은 여기서 봅니다.
// =========================================================

import OrderStatusBadge from '@/components/order/OrderStatusBadge';
import OrderProgress from '@/components/order/OrderProgress';
import { orderProgress } from '@/server/domain/progress';
import { STATUS_ORDER, STATUS_LABEL, getAvailableActions } from '@/server/domain/order-status';
import { statusesForSector, colorOfStatus } from '@/server/domain/order-list';

export default function UploadingPlayground() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">스캔 대기 상태</h1>

      <section className="mt-7">
        <h2 className="mb-2 font-semibold">① 배지 — 아홉 가지</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <OrderStatusBadge key={s} status={s} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-semibold">② 진행 막대 — 스캔 대기</h2>
        <div className="rounded-lg border bg-white p-4">
          <OrderProgress steps={orderProgress({ status: 'uploading', isRepair: false, pickups: [] })} />
        </div>
        <h3 className="mt-4 mb-2 text-[13.5px] text-[#98A2B3]">견주기 — 접수</h3>
        <div className="rounded-lg border bg-white p-4">
          <OrderProgress steps={orderProgress({ status: 'received', isRepair: false, pickups: [] })} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-semibold">③ 목록 필터에 서는가 (섹터별)</h2>
        <ul className="space-y-1.5 text-[13.5px]">
          {(['clinic', 'design_center', 'lab'] as const).map((sector) => (
            <li key={sector}>
              <b>{sector}</b> —{' '}
              {statusesForSector(sector).map((s) => (
                <span key={s.status} style={{ color: colorOfStatus(s.status) }} className="mr-2 font-semibold">
                  {STATUS_LABEL[s.status]}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-[#98A2B3]">
          ★ 기공소에는 안 떠야 맞습니다 — 배정 전 단계라 볼 일이 없습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-semibold">④ 버튼 — 하나도 없어야 맞습니다</h2>
        <ul className="space-y-1 text-[13.5px]">
          {(['clinic', 'design_center', 'lab'] as const).map((sector) => (
            <li key={sector}>
              <b>{sector}</b> — {getAvailableActions('uploading', sector).map((a) => a.label).join(', ') || '(없음)'}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-[#98A2B3]">
          ★ 넘어가는 것은 사람이 아니라 마지막 파일입니다.
        </p>
      </section>
    </main>
  );
}
