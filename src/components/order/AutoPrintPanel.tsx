// =========================================================
// 놓을 위치: src/components/order/AutoPrintPanel.tsx
//
// 자동 템포러리 — 주문상세에 붙는 칸 (사용자 요청 2026-10-06).
//
// ★ exocad 때 "진행되는 상황을 알 수가 없어" 를 들었습니다.
//   그래서 **다섯 칸을 늘 보여 줍니다.** 지금 어디인지만 말하지 않습니다.
//
// ★ 멈추면 멈춘 칸이 빨갛게 서고 까닭이 그대로 뜹니다.
//   조용히 멈춘 자동화가 가장 위험합니다.
//
// ★ 「비웠습니다」는 **치과만** 보입니다. 디자인센터가 대신 눌러 주면
//   아무도 출력판을 안 봅니다.
//
// ★ 무엇을 그릴지는 domain/auto-print 가 정합니다. 여기서는 늘어놓기만.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitClearBed } from '@/server/actions/auto-print';
import type { AutoProgressStep } from '@/server/domain/auto-print';

const COLOR = {
  done: { dot: '#12855B', text: '#4A5567' },
  current: { dot: '#1279E8', text: '#1279E8' },
  todo: { dot: '#DDE2EA', text: '#98A2B3' },
  stopped: { dot: '#D64545', text: '#D64545' },
} as const;

export default function AutoPrintPanel({
  orderId,
  steps,
  notice,
  needsBed,
  canClear,
}: {
  orderId: string;
  steps: AutoProgressStep[];
  notice: string;
  needsBed: boolean;
  /** 치과인가. 치과만 누를 수 있습니다 */
  canClear: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stopped = steps.some((s) => s.state === 'stopped');

  const press = () => {
    setError(null);
    start(async () => {
      const got = await submitClearBed(orderId);
      if (got.ok) router.refresh();
      else setError(got.error);
    });
  };

  return (
    <section className="rounded-xl border border-[#E8EBF0] bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13.5px] font-bold tracking-[-0.02em] text-[#1A2130]">자동 출력</h3>
        <span
          className={
            'text-[12.5px] ' + (stopped ? 'font-bold text-[#D64545]' : 'text-[#4A5567]')
          }
        >
          {notice}
        </span>
      </div>

      <ol aria-label="자동 출력 진행" className="mt-3 flex items-start overflow-x-auto">
        {steps.map((step, i) => {
          const color = COLOR[step.state];
          const last = i === steps.length - 1;

          return (
            <li key={step.key} className="flex items-start">
              <div className="flex w-[72px] flex-col items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="grid h-[18px] w-[18px] place-items-center rounded-full"
                  style={{ background: color.dot }}
                >
                  {step.state === 'stopped' ? (
                    <span className="text-[11px] font-bold leading-none text-white">!</span>
                  ) : null}
                </span>
                <span
                  className="text-center text-[11.5px] leading-tight"
                  style={{ color: color.text }}
                >
                  {step.label}
                  {step.percent !== undefined ? (
                    <b className="block font-bold">{step.percent}%</b>
                  ) : null}
                </span>
              </div>
              {last ? null : (
                <span
                  aria-hidden="true"
                  className="mt-[8px] h-[2px] w-[18px] shrink-0 rounded"
                  style={{ background: step.state === 'done' ? '#12855B' : '#DDE2EA' }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {needsBed && canClear ? (
        <div className="mt-3 rounded-lg border border-[#CFE3FB] bg-[#F2F7FE] p-3">
          <p className="text-[12.5px] leading-relaxed text-[#4A5567]">
            프린터 <b className="text-[#1A2130]">출력판에 남은 것이 없는지</b> 확인해 주세요.
            비어 있어야 출력을 시작합니다.
          </p>
          <button
            type="button"
            onClick={press}
            disabled={pending}
            className="mt-2.5 rounded-lg bg-[#1279E8] px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            {pending ? '확인하는 중…' : '비웠습니다'}
          </button>
          {error ? <p className="mt-2 text-[12px] text-[#D64545]">{error}</p> : null}
        </div>
      ) : null}

      {needsBed && !canClear ? (
        <p className="mt-3 text-[12px] text-[#7C8595]">
          치과에서 출력판을 비우고 확인하면 시작됩니다.
        </p>
      ) : null}
    </section>
  );
}
