// =========================================================
// 놓을 위치: src/components/order/ToothFixCard.tsx
//
// 스캔과 주문서의 치식이 다를 때 치과가 고르는 칸 (사용자 2026-10-30).
//   "치식이 오류인 경우 UI 적으로 치과가 치식을 바꾸기 쉽게 도와줄 수 있는 루트는 없어? 디자인도 이쁘게"
//
// ★ 번호 둘을 나란히 보여 주고 단추 둘만 둡니다. 다시 주문할 필요가 없습니다.
// ★ 설계가 알아서 바꾸지 않습니다 — 스캔을 잘못 읽었을 수 있어 치과가 한 번 봅니다.
// ★ 책갈피와 주문 상세가 같은 칸을 씁니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { submitDismissAutoJob, submitToothFix } from '@/server/actions/auto-print';

function ToothTile({ label, number, picked }: { label: string; number: number; picked?: boolean }) {
  return (
    <div
      className={
        'flex min-w-0 flex-1 flex-col items-center rounded-xl border py-2.5 ' +
        (picked ? 'border-[#1279E8] bg-white shadow-[0_1px_4px_rgba(18,121,232,0.18)]' : 'border-[#E3E8EF] bg-white/70')
      }
    >
      <span className={'text-[11.5px] font-semibold ' + (picked ? 'text-[#0F5FB8]' : 'text-[#7C8595]')}>{label}</span>
      <b
        className={
          'mt-0.5 text-[22px] font-extrabold leading-none tracking-[-0.02em] tabular-nums ' +
          (picked ? 'text-[#1279E8]' : 'text-[#A3ACB9] line-through decoration-[1.5px]')
        }
      >
        {number}
      </b>
    </div>
  );
}

export default function ToothFixCard({
  orderId,
  fix,
  onChanged,
}: {
  orderId: string;
  fix: { from: number; to: number };
  onChanged: () => void | Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const got = await action(orderId);
      if (got.ok) await onChanged();
      else setError(got.error);
    });
  };

  return (
    <div className="rounded-xl border border-[#CFE3FB] bg-[#F2F7FE] p-3">
      <p className="text-[13px] font-bold tracking-[-0.02em] text-[#1A2130]">어느 치아가 맞나요?</p>

      <div className="mt-2 flex items-center gap-2">
        <ToothTile label="주문서" number={fix.from} />
        <span aria-hidden="true" className="shrink-0 text-[15px] font-bold text-[#1279E8]">
          →
        </span>
        <ToothTile label="스캔" number={fix.to} picked />
      </div>

      <button
        type="button"
        onClick={() => run(submitToothFix)}
        disabled={pending}
        className="mt-2.5 w-full rounded-lg bg-[#1279E8] py-2 text-[13px] font-bold text-white hover:bg-[#0F6AD0] disabled:opacity-50"
      >
        {pending ? '처리하는 중…' : `${fix.to}번으로 바꿔서 진행`}
      </button>
      <button
        type="button"
        onClick={() => run(submitDismissAutoJob)}
        disabled={pending}
        className="mt-1.5 w-full rounded-lg py-1.5 text-[12px] font-semibold text-[#5B6675] hover:bg-white/70 disabled:opacity-50"
      >
        {fix.from}번이 맞습니다 — 이번 건은 임시치아 없이 진행
      </button>

      {error ? <p className="mt-1.5 text-[11.5px] text-[#D64545]">{error}</p> : null}
    </div>
  );
}
