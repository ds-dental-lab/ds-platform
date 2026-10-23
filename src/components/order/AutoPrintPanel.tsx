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
import {
  submitClearBed,
  submitDismissAutoJob,
  submitRetryAutoPrint,
} from '@/server/actions/auto-print';
import ReprintDialog from '@/components/order/ReprintDialog';
import { remainingLabel, type AutoProgressStep, type BoardRow } from '@/server/domain/auto-print';


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
  canDismiss = false,
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
  /** 치과가 ✕ 로 치울 수 있다 — 멈춘 것·실패한 것의 「FlowTemp 그만두기」 (domain canDismiss) */
  canDismiss?: boolean;
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
  // ★ 바로 걸지 않고 확인 창부터 — 「비웠습니다」까지 한 번에 (사용자 2026-10-23)
  const [asking, setAsking] = useState(false);
  const reprint = () => {
    setError(null);
    setAsking(true);
  };

  const done = canReprint;

  return (
    /*
      ★ 모양 다듬기 (사용자 2026-10-23 "화면 UI 좀 이쁘게"). 동작은 그대로 — 머리줄에 상태 알약,
        단계는 아이콘 동그라미와 이어지는 선, 지금 칸은 숨 쉬는 점, 출력 중 칸은 큰 숫자와 줄무늬 막대.
    */
    <section
      className={
        'overflow-hidden rounded-2xl border bg-white ' + (done ? 'border-[#BFE3CF]' : stopped ? 'border-[#F3C6C6]' : 'border-[#E3E8EF]')
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#F0F2F5] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={
              'grid h-8 w-8 place-items-center rounded-lg ' +
              (done ? 'bg-[#EAF7F0] text-[#12855B]' : stopped ? 'bg-[#FDECEA] text-[#C4383A]' : 'bg-[#EEF5FE] text-[#1279E8]')
            }
          >
            <PrinterIcon />
          </span>
          <h3 className="text-[14px] font-extrabold tracking-[-0.02em] text-[#1A2130]">자동 출력</h3>
        </div>
        <span
          className={
            'rounded-full px-2.5 py-1 text-[12px] font-bold ' +
            (stopped
              ? 'bg-[#FDECEA] text-[#B83A3A]'
              : done
                ? 'bg-[#12855B] text-white'
                : 'bg-[#EEF5FE] text-[#1462B8]')
          }
        >
          {done ? '✓ ' : stopped ? '! ' : ''}
          {notice}
        </span>
      </div>

      <div className="px-4 pb-4 pt-4">
      <ol aria-label="자동 출력 진행" className="flex items-start overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const next = steps[i + 1];
          const lineDone = step.state === 'done' && next && next.state !== 'todo';
          return (
            <li key={step.key} className="relative flex min-w-[64px] flex-1 flex-col items-center">
              {/* 다음 칸까지 잇는 선 — 동그라미 뒤로 */}
              {last ? null : (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-[13px] h-[2px] w-full"
                  style={{ background: lineDone || step.state === 'done' ? '#12855B' : '#E3E8EF' }}
                />
              )}
              <StepDot state={step.state} />
              <span
                className={
                  'mt-1.5 px-1 text-center text-[11.5px] leading-tight ' +
                  (step.state === 'current'
                    ? 'font-bold text-[#1279E8]'
                    : step.state === 'stopped'
                      ? 'font-bold text-[#C4383A]'
                      : step.state === 'done'
                        ? 'text-[#3A4F66]'
                        : 'text-[#A3ACB9]')
                }
              >
                {step.label}
                {step.percent !== undefined ? <b className="block font-extrabold tabular-nums">{step.percent}%</b> : null}
                {step.detail ? <span className="mt-0.5 block text-[11px] font-semibold">{step.detail}</span> : null}
              </span>
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

      {asking ? (
        <ReprintDialog
          orderId={orderId}
          canClear={canClear}
          onClose={() => setAsking(false)}
          onDone={() => router.refresh()}
        />
      ) : null}

      {designNote ? (
        <div className="mt-3 rounded-lg border border-[#F6DDB0] bg-[#FFF8EC] p-3">
          <p className="text-[12px] font-bold text-[#8A5A12]">디자인 확인 필요 (센터에만 보입니다)</p>
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

      {/*
        ★ 치과의 출구 (사용자 지적 2026-10-19 "UI 출구가 없네") — 멈춘 디자인에 치과가 할 수 있는
          두 가지: 스캔을 바꿔 올리면 다시 설계(주문 수정이 저절로 다시 겁니다), 아니면 FlowTemp 만
          그만두기. 다시 걸기는 센터 몫 그대로입니다(덴트버드 건수를 쓰니까).
      */}
      {canClear && canDismiss && (designStalled || stopped) ? (
        <div className="mt-3 rounded-lg border border-[#F6DDB0] bg-[#FFF8EC] p-3">
          <p className="text-[12.5px] leading-relaxed text-[#6B4A16]">
            {designStalled
              ? '디자인이 멈춰 센터가 확인하고 있습니다. 스캔을 잘못 올리셨다면 주문 수정에서 파일을 바꾸면 다시 설계합니다.'
              : '출력이 멈췄습니다. 센터가 확인하고 있습니다.'}{' '}
            임시치아를 그만두셔도 크라운 주문은 그대로 갑니다.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              start(async () => {
                const got = await submitDismissAutoJob(orderId);
                if (got.ok) router.refresh();
                else setError(got.error);
              });
            }}
            disabled={pending}
            className="mt-2.5 rounded-lg border border-[#E0B36A] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#8A5A12] disabled:opacity-50"
          >
            {pending ? '치우는 중…' : 'FlowTemp 그만두기'}
          </button>
          {error ? <p className="mt-1.5 text-[12px] text-[#D64545]">{error}</p> : null}
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
      </div>
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
  const layers = row.layerNow && row.layerTotal ? `${row.layerNow} / ${row.layerTotal}층` : null;

  return (
    <div className="mt-4 rounded-xl bg-gradient-to-br from-[#F2F7FE] to-[#F8FAFD] p-4 ring-1 ring-[#DCE8F7]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-semibold text-[#5A7699]">출력 중</p>
          <b className="mt-0.5 block text-[34px] font-extrabold leading-none tracking-[-0.04em] text-[#13304F] tabular-nums">
            {row.percent !== null ? pct : '—'}
            <span className="ml-0.5 text-[18px] font-bold text-[#5A7699]">%</span>
          </b>
        </div>
        <div className="text-right">
          <p className="text-[15px] font-extrabold tracking-[-0.02em] text-[#13304F]">
            {left !== null ? remainingLabel(left) : '남은 시간 계산 중'}
          </p>
          {row.etaAt ? <p className="mt-0.5 text-[12px] text-[#5A7699]">{clock(row.etaAt)} 완료 예정</p> : null}
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-[#DCE8F7]">
        <div
          className="relative h-full overflow-hidden rounded-full bg-[#1279E8] transition-[width] duration-700"
          style={{ width: `${Math.max(3, pct)}%` }}
        >
          {/* 줄무늬가 천천히 흐릅니다 — 멈춘 게 아니라는 표시 */}
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-[flowtemp-stripes_1.2s_linear_infinite] motion-reduce:animate-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 6px, transparent 6px 12px)',
              backgroundSize: '17px 17px',
            }}
          />
        </div>
      </div>
      {layers ? <p className="mt-2 text-[11.5px] font-semibold text-[#7C8FA6] tabular-nums">{layers}</p> : null}
    </div>
  );
}

/** 단계 동그라미 — 다 됨 ✓ · 지금 숨 쉬는 점 · 멈춤 ! · 남음 빈 칸 */
function StepDot({ state }: { state: 'done' | 'current' | 'todo' | 'stopped' }) {
  if (state === 'done') {
    return (
      <span className="relative z-10 grid h-7 w-7 place-items-center rounded-full bg-[#12855B] text-white shadow-[0_2px_6px_-2px_rgba(18,133,91,0.6)]">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5">
          <path d="M3.5 8.4l3 3 6-6.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="relative z-10 grid h-7 w-7 place-items-center rounded-full bg-white ring-[2.5px] ring-[#1279E8]">
        <span className="absolute h-3 w-3 animate-ping rounded-full bg-[#1279E8]/40 motion-reduce:animate-none" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#1279E8]" />
      </span>
    );
  }
  if (state === 'stopped') {
    return (
      <span className="relative z-10 grid h-7 w-7 place-items-center rounded-full bg-[#D64545] text-[13px] font-extrabold text-white">
        !
      </span>
    );
  }
  return <span className="relative z-10 h-7 w-7 rounded-full bg-white ring-2 ring-[#E3E8EF]" />;
}

function PrinterIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <path d="M3 7.5h14" />
      <path d="M8.5 7.5v2.2l1.5 1.3 1.5-1.3V7.5" strokeLinecap="round" />
      <path d="M6 14.5h8" strokeLinecap="round" />
    </svg>
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
