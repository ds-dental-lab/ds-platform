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

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { submitClearBed, submitReprint, submitRetryAutoPrint } from '@/server/actions/auto-print';
import { remainingLabel, type AutoProgressStep, type BoardRow } from '@/server/domain/auto-print';

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
  designNote = null,
  manualSlot = null,
  finishedAt = null,
  canReprint = false,
  printing = null,
}: {
  orderId: string;
  steps: AutoProgressStep[];
  notice: string;
  needsBed: boolean;
  /** 치과인가. 치과만 누를 수 있습니다 */
  canClear: boolean;
  /** 디자인이 멈춘 까닭 — 센터 화면에만 넘어옵니다 */
  designNote?: string | null;
  /** 센터만 — STL 을 손으로 고르는 작은 링크 (AutoPrintSendButton) */
  manualSlot?: ReactNode;
  /** 다 나온 때 (ISO) */
  finishedAt?: string | null;
  /** 다 나왔다 — 「다시 뽑기」 를 보입니다 */
  canReprint?: boolean;
  /** 출력 중이면 그 줄 (퍼센트·남은 시간·층) */
  printing?: BoardRow | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stopped = steps.some((s) => s.state === 'stopped');
  // ★ 디자인이 멈춘 것(확인 중)도 다시 겁니다 (2026-10-15)
  const designStalled = steps.some((s) => s.key === 'waiting_design' && s.detail === '확인 중');

  const press = () => {
    setError(null);
    start(async () => {
      const got = await submitClearBed(orderId);
      if (got.ok) router.refresh();
      else setError(got.error);
    });
  };

  /*
    ★★ 멈춘 작업을 다시 겁니다 (2026-10-12). 전에는 실패하면 **거기서
      끝이었습니다** — 필라멘트가 떨어지기만 해도 그 주문은 영영 자동
      출력으로 못 돌아왔습니다. 치과와 센터 둘 다 누를 수 있습니다.
  */
  const retry = () => {
    setError(null);
    start(async () => {
      const got = await submitRetryAutoPrint(orderId);
      if (got.ok) router.refresh();
      else setError(got.error);
    });
  };

  /*
    ★ 같은 디자인을 다시 뽑습니다 (사용자 요청 2026-10-15 — 깨짐·분실·하나 더).
      출력판 확인부터 다시 돕니다.
  */
  const reprint = () => {
    setError(null);
    start(async () => {
      const got = await submitReprint(orderId);
      if (got.ok) router.refresh();
      else setError(got.error);
    });
  };

  const done = canReprint;

  return (
    <section
      className={
        'rounded-xl border bg-white p-4 ' + (done ? 'border-[#BFE3CF]' : 'border-[#E8EBF0]')
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13.5px] font-bold tracking-[-0.02em] text-[#1A2130]">자동 출력</h3>
        <span
          className={
            'text-[12.5px] ' +
            (stopped
              ? 'font-bold text-[#D64545]'
              : done
                ? 'font-bold text-[#12855B]'
                : 'text-[#4A5567]')
          }
        >
          {done ? '✓ ' : ''}
          {notice}
        </span>
      </div>

      <ol aria-label="자동 출력 진행" className="mt-3 flex items-start overflow-x-auto">
        {steps.map((step, i) => {
          const color = COLOR[step.state];
          const last = i === steps.length - 1;

          return (
            <li key={step.key} className="flex items-start">
              <div className="flex w-[64px] flex-col items-center gap-1.5">
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
                  {/* ★ 디자인 칸 안에서 지금 하는 일 — '치아 분석' 처럼 (2026-10-15) */}
                  {step.detail ? (
                    <span className="mt-0.5 block text-[11px] font-semibold">{step.detail}</span>
                  ) : null}
                </span>
              </div>
              {last ? null : (
                <span
                  aria-hidden="true"
                  className="mt-[8px] h-[2px] w-[14px] shrink-0 rounded"
                  style={{ background: step.state === 'done' ? '#12855B' : '#DDE2EA' }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {printing ? <PrintingCard row={printing} /> : null}

      {/*
        ★ 다 나왔으면 크게 (2026-10-15 — "출력 완료도 가시성이 떨어져").
          칸이 다 초록이 되는 것만으로는 끝났는지 눈에 안 들어왔습니다.
      */}
      {done ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#BFE3CF] bg-[#EEF8F2] p-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#12855B] text-[17px] font-bold text-white"
          >
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold tracking-[-0.02em] text-[#0E6B49]">
              출력 완료{finishedAt ? <span className="ml-1.5 font-semibold">· {whenKst(finishedAt)}</span> : null}
            </p>
            <p className="mt-0.5 text-[12px] text-[#3E7A5E]">다 나왔습니다 — 출력판에서 꺼내 주세요.</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={reprint}
              disabled={pending}
              className="rounded-lg border border-[#12855B] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#12855B] hover:bg-[#F3FBF7] disabled:opacity-50"
            >
              {pending ? '거는 중…' : '↻ 다시 뽑기'}
            </button>
            <span className="text-[11px] text-[#7C8595]">같은 디자인 · 출력판 확인부터</span>
          </div>
          {error ? <p className="w-full text-[12px] text-[#D64545]">{error}</p> : null}
        </div>
      ) : null}

      {designNote ? (
        <div className="mt-3 rounded-lg border border-[#F6DDB0] bg-[#FFF8EC] p-3">
          <p className="text-[12px] font-bold text-[#8A5A12]">디자인이 멈췄습니다 (센터에만 보입니다)</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#6B4A16]">{designNote}</p>
        </div>
      ) : null}

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

      {/* ★ 센터만 — 다시 설계하면 덴트버드 건수를 씁니다 */}
      {designStalled && !stopped && !canClear ? (
        <div className="mt-3 rounded-lg border border-[#F6DDB0] bg-[#FFF8EC] p-3">
          <p className="text-[12.5px] leading-relaxed text-[#6B4A16]">
            디자인이 멈춰 있습니다. 까닭을 확인하고 다시 걸면 처음부터 다시 설계합니다.
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={pending}
            className="mt-2.5 rounded-lg bg-[#E09A1B] px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            {pending ? '다시 거는 중…' : '디자인 다시 걸기'}
          </button>
          {error ? <p className="mt-1.5 text-[12px] text-[#D64545]">{error}</p> : null}
        </div>
      ) : null}

      {stopped ? (
        <div className="mt-3 rounded-lg border border-[#F3C6C6] bg-[#FDECEA] p-3">
          <p className="text-[12.5px] leading-relaxed text-[#8A3A3A]">
            멈춘 까닭을 고치고 다시 걸어 주세요. 다시 걸면{' '}
            <b className="text-[#6B2B2B]">출력판을 비웠는지 한 번 더</b> 확인합니다.
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={pending}
            className="mt-2.5 rounded-lg bg-[#C4383A] px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            {pending ? '다시 거는 중…' : '다시 걸기'}
          </button>
        </div>
      ) : null}

      {needsBed && !canClear ? (
        <p className="mt-3 text-[12px] text-[#7C8595]">
          치과에서 출력판을 비우고 확인하면 시작됩니다.
        </p>
      ) : null}

      {manualSlot ? <div className="mt-3 border-t border-[#F0F2F5] pt-2.5">{manualSlot}</div> : null}
    </section>
  );
}

/** '15:32' — 오늘이 아니면 '10/14 15:32'. 한국 시간으로 */
function whenKst(iso: string): string {
  const d = new Date(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...o }).format(d);
  const day = (x: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(x);
  const time = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
  return day(d) === day(new Date()) ? time : `${fmt({ month: 'numeric', day: 'numeric' })} ${time}`;
}

/**
 * 출력 중 칸 (사용자 2026-10-15 — "남은 시간은 안 보여주네, 출력중 UI 가 조금 아쉽네").
 *
 * ★ 치과가 궁금한 것은 '언제 끝나나' 입니다. 퍼센트를 크게, 그 옆에 남은 시간과
 *   끝날 시각을 둡니다. 층은 덤으로 작게.
 * ★ 남은 시간은 끝날 시각(etaAt)에서 **이 화면이 스스로** 셉니다 — 서버를
 *   다시 안 물어도 30초마다 줄어듭니다.
 */
function PrintingCard({ row }: { row: BoardRow }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const left = row.etaAt ? Math.max(0, Math.round((new Date(row.etaAt).getTime() - now) / 60000)) : null;
  const pct = row.percent ?? 0;

  return (
    <div className="mt-3 rounded-lg border border-[#D6E2EF] bg-[#F5F8FC] p-3.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <b className="text-[28px] font-bold leading-none tracking-[-0.03em] text-[#1A2130] tabular-nums">
            {row.percent !== null ? `${pct}%` : '—'}
          </b>
          <span className="text-[12.5px] font-semibold text-[#4F6B8A]">출력 중</span>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-bold tracking-[-0.02em] text-[#1A2130]">
            {left !== null ? remainingLabel(left) : '남은 시간 계산 중'}
          </p>
          {row.etaAt ? (
            <p className="mt-0.5 text-[11.5px] text-[#7C8595]">{clock(row.etaAt)} 완료 예정</p>
          ) : null}
        </div>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#E3EAF2]">
        <div
          className="h-full rounded-full bg-[#1279E8] transition-[width] duration-700"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      {row.layerNow && row.layerTotal ? (
        <p className="mt-1.5 text-[11.5px] text-[#7C8595] tabular-nums">
          {row.layerNow} / {row.layerTotal}층
        </p>
      ) : null}
    </div>
  );
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
