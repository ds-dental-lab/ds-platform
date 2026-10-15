// =========================================================
// 놓을 위치: src/components/layout/FlowTempDock.tsx
//
// 치과 화면 오른쪽 책갈피 — FlowTemp 진행 (사용자 요청 2026-10-15).
//   "DenFlow 모든 화면에서 오른쪽 책갈피처럼 접어두고, 펼치면 환자 이름 /
//    상태값 / 진행률. 오류면 오류라고"
//
// ★ 진행 중인 것이 없으면 **탭도 없습니다.** 쓸 일 없는 치과 화면에 군더더기를
//   남기지 않습니다.
// ★ 접힌 탭의 색이 곧 요약입니다 — 빨강(오류) · 파랑(치과가 할 일) · 주황(지연)
//   · 회청(진행) · 초록(다 나옴). 펼치지 않아도 지금 봐야 하는지 압니다.
// ★ 「비웠습니다」는 여기서 바로 누릅니다. 가장 자주 하는 일이라 주문 상세까지
//   가지 않게 합니다.
// ★ 몇 초마다 다시 묻습니다(진행 중일 때 6초, 아니면 30초). 안 보는 탭에서는
//   묻지 않고, 돌아오는 순간 한 번 묻습니다 (AutoRefresh 와 같은 예절).
// ★ 무엇을 어떤 색으로 말할지는 domain/auto-print 의 boardRow 가 정합니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { getFlowTempBoard, submitClearBed, type Board, type BoardItem } from '@/server/actions/auto-print';
import { boardTone, type BoardTone } from '@/server/domain/auto-print';

const BUSY_MS = 6_000;
const IDLE_MS = 30_000;
const OPEN_KEY = 'denflow.flowtempDock.open';
const TOP_KEY = 'denflow.flowtempDock.top';

/**
 * 탭의 높이 — 화면 높이의 % (사용자 요청 2026-10-15 — "위치를 위아래로 지정할 수는 없나").
 * ★ 위아래 끝에 너무 붙으면 상단바·브라우저 아래 막대에 가립니다. 그 사이로만.
 */
const TOP_DEFAULT = 38;
const TOP_MIN = 10;
const TOP_MAX = 85;
/** 이보다 덜 움직였으면 끈 게 아니라 누른 것입니다 */
const DRAG_PX = 5;

const clampTop = (v: number) => Math.max(TOP_MIN, Math.min(TOP_MAX, v));

function readTop(): number {
  try {
    const v = Number(window.localStorage.getItem(TOP_KEY));
    return Number.isFinite(v) && v > 0 ? clampTop(v) : TOP_DEFAULT;
  } catch {
    return TOP_DEFAULT;
  }
}

function writeTop(top: number) {
  try {
    window.localStorage.setItem(TOP_KEY, String(Math.round(top * 10) / 10));
  } catch {
    // 저장이 막혀도 이번 화면에서는 옮긴 자리 그대로입니다
  }
}

const TONE: Record<BoardTone, { main: string; soft: string; ink: string; label: string }> = {
  error: { main: '#D64545', soft: '#FDECEA', ink: '#A32F2F', label: '오류' },
  action: { main: '#1279E8', soft: '#EAF3FE', ink: '#0F5FB8', label: '확인 필요' },
  delay: { main: '#E09A1B', soft: '#FFF6E5', ink: '#8A5A12', label: '지연' },
  progress: { main: '#4F6B8A', soft: '#EEF2F7', ink: '#3A4F66', label: '진행 중' },
  done: { main: '#12855B', soft: '#E7F5EE', ink: '#0E6B49', label: '완료' },
};

const noop = () => () => {};

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    // 저장이 막혀도 화면은 그대로 씁니다
  }
}

export default function FlowTempDock({
  preview,
}: {
  /** 놀이터에서 모양만 볼 때 — 주면 서버에 묻지 않습니다 */
  preview?: Board;
} = {}) {
  const [board, setBoard] = useState<Board | null>(preview ?? null);
  // ★ 브라우저에 붙은 뒤에만 그립니다 — 접힘 상태는 브라우저에만 있어서,
  //   서버가 그린 것과 어긋나지 않게 합니다
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  // ★ 접힘은 이 브라우저만의 편의라 localStorage 에 둡니다. 목록이 오기 전엔
  //   아무것도 안 그리므로(서버도 null) 처음부터 읽어도 화면이 어긋나지 않습니다.
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && readOpen());
  const [top, setTop] = useState(() => (typeof window !== 'undefined' ? readTop() : TOP_DEFAULT));
  const busy = useRef(false);
  /*
    ★ 끌기와 누르기를 가릅니다. 눌렀다 떼면 펼치고, 끌었으면 펼치지 않습니다 —
      자리를 옮기려다 칸이 열려 버리면 짜증납니다.
  */
  const drag = useRef<{ startY: number; startTop: number; moved: boolean } | null>(null);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setBoard(await getFlowTempBoard());
    } catch {
      // 한 번 못 받아도 다음 차례에 다시 묻습니다
    } finally {
      busy.current = false;
    }
  }, []);

  const active = board?.items.some((i) => i.tone !== 'done') ?? false;

  useEffect(() => {
    if (preview) return;
    const first = setTimeout(() => void load(), 0);
    const every = active ? BUSY_MS : IDLE_MS;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, every);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, load, preview]);

  if (!onClient || !board || board.items.length === 0) return null;

  const tone = boardTone(board.items.map((i) => i.tone)) ?? 'progress';
  const color = TONE[tone];
  const urgent = tone === 'error' || tone === 'action';
  const needs = board.items.filter((i) => i.tone === 'error' || i.tone === 'action').length;

  const toggle = (next: boolean) => {
    setOpen(next);
    writeOpen(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { startY: e.clientY, startTop: top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < DRAG_PX) return;
    d.moved = true;
    setTop(clampTop(d.startTop + (dy / window.innerHeight) * 100));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) writeTop(top);
    else toggle(true);
  };

  return (
    <>
      {/* ---------- 접힌 탭 ---------- */}
      {!open ? (
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle(true);
            }
          }}
          aria-label={`${board.productName} 진행 ${board.items.length}건 펼치기 (위아래로 끌어 옮길 수 있습니다)`}
          title="누르면 펼칩니다 · 위아래로 끌면 자리를 옮깁니다"
          className="fixed right-0 z-40 flex cursor-grab touch-none select-none flex-col items-center gap-2 rounded-l-xl py-3 pl-2 pr-1.5 text-white shadow-[0_6px_20px_rgba(26,33,48,0.18)] transition-[padding] hover:pl-3 active:cursor-grabbing"
          style={{ background: color.main, top: `${top}%` }}
        >
          {/* 잡는 자리 표시 — 끌 수 있다는 것을 보입니다 */}
          <span aria-hidden="true" className="flex flex-col gap-[2px] opacity-70">
            <span className="h-[2px] w-3 rounded bg-white" />
            <span className="h-[2px] w-3 rounded bg-white" />
          </span>
          {urgent ? (
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          ) : null}
          <span
            className="text-[12.5px] font-bold tracking-[0.02em]"
            style={{ writingMode: 'vertical-rl' }}
          >
            {board.productName}
          </span>
          <span
            className="grid h-[20px] min-w-[20px] place-items-center rounded-full bg-white px-1 text-[11.5px] font-bold"
            style={{ color: color.main }}
          >
            {needs > 0 ? needs : board.items.length}
          </span>
        </button>
      ) : null}

      {/* ---------- 펼친 칸 ---------- */}
      {open ? (
        <aside
          aria-label={`${board.productName} 진행`}
          className="fixed bottom-4 right-0 top-[64px] z-40 flex w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-l-2xl border border-r-0 border-[#E8EBF0] bg-white shadow-[0_12px_40px_rgba(26,33,48,0.18)]"
        >
          <header className="flex items-center gap-2 border-b border-[#F0F2F5] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color.main }} aria-hidden="true" />
            <h2 className="text-[14px] font-bold tracking-[-0.02em] text-[#1A2130]">
              {board.productName} 진행
            </h2>
            <span className="text-[12.5px] text-[#98A2B3]">{board.items.length}건</span>
            <button
              type="button"
              onClick={() => toggle(false)}
              aria-label="접기"
              title="접기"
              className="ml-auto grid h-7 w-7 place-items-center rounded-full text-[15px] text-[#98A2B3] hover:bg-[#F2F4F7] hover:text-[#1A2130]"
            >
              »
            </button>
          </header>

          <ul className="flex-1 space-y-2.5 overflow-y-auto bg-[#F8F9FB] p-3">
            {board.items.map((item) => (
              <DockRow key={item.orderId} item={item} onChanged={load} />
            ))}
          </ul>

          <p className="border-t border-[#F0F2F5] px-4 py-2.5 text-[11.5px] text-[#98A2B3]">
            다 나온 건은 6시간 뒤 이 목록에서 사라집니다.
          </p>
        </aside>
      ) : null}
    </>
  );
}

function DockRow({ item, onChanged }: { item: BoardItem; onChanged: () => Promise<void> }) {
  const color = TONE[item.tone];
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setError(null);
    start(async () => {
      const got = await submitClearBed(item.orderId);
      if (got.ok) await onChanged();
      else setError(got.error);
    });
  };

  return (
    <li
      className="overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: item.tone === 'progress' || item.tone === 'done' ? '#E8EBF0' : color.main }}
    >
      <Link href={`/clinic/orders/${item.orderId}`} className="block px-3.5 pb-3 pt-3 hover:bg-[#FBFCFD]">
        <div className="flex items-center gap-2">
          <b className="min-w-0 truncate text-[14px] font-bold tracking-[-0.02em] text-[#1A2130]">
            {item.patientLabel}
          </b>
          {item.teeth.length > 0 ? (
            <span className="shrink-0 rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#4A5567]">
              #{item.teeth.join(', ')}
            </span>
          ) : null}
          <span
            className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold"
            style={{ background: color.soft, color: color.ink }}
          >
            {item.tone === 'error' ? '⚠ ' : item.tone === 'done' ? '✓ ' : ''}
            {item.status}
          </span>
        </div>

        {/* 진행 막대 — 오류면 멈춘 자리까지 빨갛게 */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(4, item.overall)}%`, background: color.main }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-[11.5px] font-bold tabular-nums" style={{ color: color.ink }}>
            {item.percent !== null ? `${item.percent}%` : item.tone === 'done' ? '100%' : ''}
          </span>
        </div>

        <p
          className="mt-1.5 text-[12px] leading-snug"
          style={{ color: item.tone === 'progress' ? '#7C8595' : color.ink }}
        >
          {item.tone === 'error' ? `오류 — ${item.detail}` : item.detail}
        </p>
        <p className="mt-0.5 text-[11px] text-[#B6BECC]">{item.orderNo}</p>
      </Link>

      {item.canClearBed ? (
        <div className="border-t border-[#EAF3FE] bg-[#F5F9FF] px-3.5 py-2.5">
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="w-full rounded-lg bg-[#1279E8] py-2 text-[13px] font-bold text-white hover:bg-[#0F6AD0] disabled:opacity-50"
          >
            {pending ? '확인하는 중…' : '출력판 비웠습니다 — 출력 시작'}
          </button>
          {error ? <p className="mt-1.5 text-[11.5px] text-[#D64545]">{error}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
