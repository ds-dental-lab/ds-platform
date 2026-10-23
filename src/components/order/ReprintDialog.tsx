// =========================================================
// 놓을 위치: src/components/order/ReprintDialog.tsx
//
// 「↻ 다시 뽑기」 를 누르면 뜨는 확인 창 (사용자 2026-10-23
// "다시 뽑기 누르고 모달창이 뜨는 건 어때? 비웠습니다 놓치기 쉬울 것 같아").
//
// ★ 전에는 다시 뽑기 → 카드가 '출력판 확인' 으로 바뀌고 → 「비웠습니다」를
//   **한 번 더** 찾아 눌러야 했습니다. 다시 뽑았는데 안 나오는 줄 압니다.
//   이제 창에서 한 번에: 다시 뽑기 + 출력판 확인.
// ★ 「비웠습니다」는 여전히 **치과만** (canClear). 센터 화면에서는 다시 거는
//   것까지만 하고, 비우는 건 치과 몫이라고 적어 둡니다.
// ★ 책갈피(FlowTempDock)는 옆으로 밀려 나오는 칸이라 그 안에 그리면 창이
//   칸에 갇힐 수 있습니다 — body 로 띄웁니다.
// =========================================================

'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { submitClearBed, submitReprint } from '@/server/actions/auto-print';

export default function ReprintDialog({
  orderId,
  label,
  canClear,
  onClose,
  onDone,
}: {
  orderId: string;
  /** 누구 것인지 — 환자 이름·치식 (없으면 생략) */
  label?: string | null;
  /** 치과인가 — 「비웠습니다」는 치과만 */
  canClear: boolean;
  onClose: () => void;
  /** 다 걸었으면 (화면 새로 읽기) */
  onDone: () => void | Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<'now' | 'later' | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const go = (cleared: boolean) => {
    setError(null);
    setPicked(cleared ? 'now' : 'later');
    start(async () => {
      const got = await submitReprint(orderId);
      if (!got.ok) {
        setError(got.error);
        return;
      }
      if (cleared) {
        const bed = await submitClearBed(orderId);
        if (!bed.ok) {
          // 다시 뽑기는 걸렸습니다 — 출력판 확인만 남은 것. 카드의 「비웠습니다」로 이어집니다
          setError(`다시 뽑기는 걸렸지만 출력판 확인을 못 했습니다 — ${bed.error}`);
          await onDone();
          return;
        }
      }
      await onDone();
      onClose();
    });
  };

  // 단추를 누른 뒤에만 그려지므로 늘 브라우저입니다 — 그래도 서버에서 불리면 조용히
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[#0B1220]/45 p-4 backdrop-blur-[2px] transition-opacity duration-200 starting:opacity-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reprint-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-[380px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(16,24,40,0.35)] transition duration-200 ease-out starting:translate-y-2 starting:scale-[0.97] starting:opacity-0">
        {/* ---------- 머리: 그림 + 제목 ---------- */}
        <div className="relative bg-gradient-to-b from-[#EEF8F2] to-white px-6 pb-4 pt-6 text-center">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="닫기"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[15px] text-[#98A2B3] hover:bg-white hover:text-[#4A5567] disabled:opacity-40"
          >
            ✕
          </button>
          <PlateArt />
          <h2 id="reprint-title" className="mt-3 text-[18px] font-extrabold tracking-[-0.03em] text-[#1A2130]">
            같은 디자인으로 다시 뽑을게요
          </h2>
          {label ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-[#3A4F66] ring-1 ring-[#E3E8EF]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#12855B]" />
              {label}
            </span>
          ) : null}
        </div>

        {/* ---------- 본문 ---------- */}
        <div className="px-6 pb-6">
          {canClear ? (
            <p className="text-center text-[13.5px] leading-relaxed text-[#4A5567]">
              출력판이 <b className="font-bold text-[#1A2130]">비어 있어야</b> 시작합니다.
              <br />
              방금 나온 것을 꺼내셨나요?
            </p>
          ) : (
            <p className="text-center text-[13.5px] leading-relaxed text-[#4A5567]">
              출력 대기로 돌립니다.
              <br />
              치과에서 출력판을 비우고 「비웠습니다」를 누르면 시작합니다.
            </p>
          )}

          {error ? (
            <p className="mt-3 rounded-lg bg-[#FDF0F0] px-3 py-2 text-[12.5px] leading-snug text-[#B83A3A]">{error}</p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => go(canClear)}
              disabled={pending}
              autoFocus
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1279E8] py-3 text-[14.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(18,121,232,0.6)] transition hover:bg-[#0F6AD0] active:scale-[0.99] disabled:opacity-60"
            >
              {pending && picked !== 'later' ? (
                <Spinner />
              ) : (
                <span aria-hidden="true" className="text-[15px]">▶</span>
              )}
              {canClear
                ? pending && picked === 'now'
                  ? '출력 거는 중…'
                  : '비웠습니다 · 바로 출력'
                : pending
                  ? '거는 중…'
                  : '다시 뽑기'}
            </button>
            {canClear ? (
              <button
                type="button"
                onClick={() => go(false)}
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-[#4A5567] ring-1 ring-[#E3E8EF] transition hover:bg-[#F7F8FA] disabled:opacity-60"
              >
                {pending && picked === 'later' ? <Spinner dark /> : null}
                아직이요, 비운 뒤에 누를게요
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 빈 출력판 그림 — 판 위에 크라운이 없고 초록 확인 표시 */
function PlateArt() {
  return (
    <svg aria-hidden="true" viewBox="0 0 96 64" className="mx-auto h-16 w-24">
      {/* 바닥 그림자 */}
      <ellipse cx="48" cy="56" rx="36" ry="4" fill="#12855B" opacity="0.12" />
      {/* 출력판 (비스듬히) */}
      <path d="M14 40 L48 26 L82 40 L48 54 Z" fill="#F7FCF9" stroke="#7CC39D" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 40 L14 44 L48 58 L82 44 L82 40 L48 54 Z" fill="#B7E0C9" />
      {/* 판 위 격자 */}
      <path d="M31 33 L65 47 M65 33 L31 47" stroke="#CBE8D8" strokeWidth="1.2" />
      {/* 확인 표시 */}
      <circle cx="70" cy="18" r="11" fill="#12855B" />
      <path d="M64.5 18.2 L68.5 22 L75.5 14.5" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        'h-4 w-4 animate-spin rounded-full border-2 ' +
        (dark ? 'border-[#C9D1DC] border-t-[#4A5567]' : 'border-white/40 border-t-white')
      }
    />
  );
}
