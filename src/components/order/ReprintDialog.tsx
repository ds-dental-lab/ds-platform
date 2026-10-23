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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const go = (cleared: boolean) => {
    setError(null);
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
      className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="다시 뽑기"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-[400px] rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-[17px] font-extrabold tracking-[-0.03em] text-[#1A2130]">
          같은 디자인으로 다시 뽑습니다
        </h2>
        {label ? <p className="mt-1 text-[12.5px] font-semibold text-[#4A5567]">{label}</p> : null}

        {canClear ? (
          <p className="mt-3 text-[13.5px] leading-relaxed text-[#4A5567]">
            프린터 <b className="text-[#1A2130]">출력판이 비어 있어야</b> 시작합니다.
            <br />
            방금 나온 것을 꺼내셨나요?
          </p>
        ) : (
          <p className="mt-3 text-[13.5px] leading-relaxed text-[#4A5567]">
            출력 대기로 돌립니다. 치과에서 출력판을 비우고 「비웠습니다」를 눌러야 시작합니다.
          </p>
        )}

        {error ? <p className="mt-3 text-[12.5px] text-[#D64545]">{error}</p> : null}

        <div className="mt-5 flex flex-col gap-2">
          {canClear ? (
            <>
              <button
                type="button"
                onClick={() => go(true)}
                disabled={pending}
                autoFocus
                className="w-full rounded-lg bg-[#1279E8] py-2.5 text-[14px] font-bold text-white hover:bg-[#0F6AD0] disabled:opacity-50"
              >
                {pending ? '거는 중…' : '비웠습니다 — 바로 출력'}
              </button>
              <button
                type="button"
                onClick={() => go(false)}
                disabled={pending}
                className="w-full rounded-lg border border-[#DDE2EA] bg-white py-2.5 text-[13px] font-semibold text-[#4A5567] hover:bg-[#F7F8FA] disabled:opacity-50"
              >
                아직이요 — 비운 뒤 「비웠습니다」를 누를게요
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => go(false)}
              disabled={pending}
              autoFocus
              className="w-full rounded-lg bg-[#1279E8] py-2.5 text-[14px] font-bold text-white hover:bg-[#0F6AD0] disabled:opacity-50"
            >
              {pending ? '거는 중…' : '다시 뽑기'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="w-full py-2 text-[12.5px] text-[#7C8595] hover:text-[#4A5567] disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
