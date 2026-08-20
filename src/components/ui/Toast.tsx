// =========================================================
// 놓을 위치: src/components/ui/Toast.tsx
//
// 오른쪽 위에 잠깐 떴다 사라지는 알림. (사용자 요청 2026-08-21)
//
// ★ 왜 필요한가.
//   상태를 바꾸면 화면이 새로 그려지기만 했습니다. 배지 글자가
//   '접수' 에서 '디자인' 으로 바뀌는데, 누른 사람은 그 작은 글자를
//   안 봅니다. 그래서 "눌린 건가?" 하고 한 번 더 누릅니다.
//   무엇이 일어났는지 **말로** 한 줄 띄웁니다.
//
// ★ 껍데기(SectorShell)에 답니다.
//   화면을 옮겨 다녀도 껍데기는 안 죽습니다. 그래서 주문상세에서
//   목록으로 넘어가는 동안에도 알림이 살아 있습니다 — 페이지 안에
//   두면 넘어가는 순간 같이 사라집니다.
//
// ★★ **시계는 알림 줄이 안 들고 있습니다.**
//   처음엔 줄마다 useEffect 로 타이머를 걸었습니다. 그런데 그 효과가
//   onDone 에 걸려 있어, 위쪽이 다시 그려질 때마다 타이머가 취소되고
//   새로 걸렸습니다 — **영영 안 사라졌습니다.** 브라우저에서 직접
//   눌러 보고 알았습니다(6초를 기다려도 셋 다 그대로 남아 있었습니다).
//
//   그래서 시계를 **띄우는 순간 한 번만** 겁니다. 다시 그려지는 것과
//   아무 상관이 없어집니다. 알림의 수명은 화면이 몇 번 그려지느냐가
//   아니라 사람이 읽는 시간에 달린 것이니, 이쪽이 맞기도 합니다.
//
// ★ 실패도 같은 자리에 띄웁니다. 성공만 알리면, 안 된 것은
//   여전히 아무 말이 없습니다.
// =========================================================

'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  /** 나가는 중인가. 사라지기 전 잠깐 흐려집니다 */
  leaving: boolean;
}

/** 얼마나 떠 있는가. 한 줄을 읽고도 남는 시간입니다 */
const LIFE_MS = 3200;

/** 실패는 조금 더 둡니다 — 읽고 무엇을 할지 정해야 합니다 */
const LIFE_MS_ERROR = 5200;

/** 흐려지는 데 걸리는 시간. 아래 CSS(duration-200)보다 조금 넉넉히 */
const FADE_MS = 260;

/** 한 번에 몇 줄까지. 그 위로는 오래된 것부터 밀어냅니다 */
const MAX_ROWS = 4;

type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * 알림 한 줄을 띄웁니다.
 *
 * ★ 껍데기 밖(로그인 화면 등)에서 불러도 터지지 않습니다.
 *   알림이 없는 자리에서는 조용히 아무 일도 안 합니다 — 알림 하나
 *   때문에 화면이 죽는 것이 더 나쁩니다.
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);

  return useCallback(
    (message, tone) => {
      show?.(message, tone);
    },
    [show],
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 화면을 떠날 때 걸어 둔 시계를 거둡니다
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    },
    [],
  );

  const show = useCallback<ShowToast>((message, tone = 'success') => {
    const id = ++seq.current;
    const life = tone === 'error' ? LIFE_MS_ERROR : LIFE_MS;

    setItems((prev) => [...prev, { id, message, tone, leaving: false }].slice(-MAX_ROWS));

    // ★ 시계는 여기서 딱 한 번. 다시 그려져도 안 흔들립니다
    timers.current.push(
      setTimeout(() => {
        setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      }, life),
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, life + FADE_MS),
    );
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}

      {/* ★ 상단바(48px) 바로 아래. 화면 조작은 안 막습니다 —
          알림이지 확인창이 아닙니다 (pointer-events-none) */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-[60px] z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
      >
        {items.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONE: Record<ToastTone, { bar: string; text: string; bg: string; border: string }> = {
  success: { bar: '#12855B', text: '#0F5B41', bg: '#F1FAF6', border: '#BFE3D3' },
  error: { bar: '#D8453F', text: '#98211D', bg: '#FEF4F3', border: '#F3C7C4' },
  info: { bar: '#1279E8', text: '#14538F', bg: '#F2F7FE', border: '#C6DDF9' },
};

/**
 * 줄 하나. 그리기만 합니다 — 언제 사라지는지는 위에서 정합니다.
 *
 * ★★ 들어오는 움직임은 **CSS 에 맡깁니다**(.toast-in, globals.css).
 *   자바스크립트로 켜 봤다가 데였습니다 — 창이 뒤에 있으면
 *   requestAnimationFrame 이 안 와서, 알림이 투명한 채로 떴다가
 *   그대로 사라졌습니다. 아무 말도 안 한 것과 같습니다.
 *
 * ★ 나가는 것만 transition 입니다. 그건 우리가 정한 시각에
 *   클래스가 바뀌는 것이라 확실히 일어납니다.
 */
function ToastRow({ item }: { item: ToastItem }) {
  const tone = TONE[item.tone];

  return (
    <div
      role="status"
      style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
      className={
        'toast-in pointer-events-auto flex items-stretch gap-3 overflow-hidden rounded-lg border py-3 pl-0 pr-3.5 shadow-[0_6px_20px_rgba(26,33,48,0.13)] transition-all duration-200 ' +
        (item.leaving ? 'translate-x-3 opacity-0' : 'translate-x-0 opacity-100')
      }
    >
      {/* 왼쪽 굵은 줄 — 색만으로도 성공·실패가 갈립니다 */}
      <span style={{ background: tone.bar }} className="w-1 shrink-0" aria-hidden="true" />

      <p className="min-w-0 flex-1 self-center pl-1 text-[13.5px] font-semibold leading-[1.45]">
        {item.message}
      </p>
    </div>
  );
}
