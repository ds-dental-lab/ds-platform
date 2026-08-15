// =========================================================
// 놓을 위치: src/components/order/WorkOrderButton.tsx
//
// 기공의뢰서 버튼. **누르면 바로 인쇄창**입니다.
// (사용자 요청 2026-08-15 — "클릭수를 줄이고 싶어")
//
// ★★ 새 창을 안 엽니다. 안 보이는 틀(iframe)에 의뢰서를 담아
//   거기서 인쇄를 부릅니다.
//
//     전  기공의뢰서 → (새 창) → 인쇄/PDF → 인쇄     세 번
//     후  기공의뢰서 → 인쇄                          **한 번**
//
//   보던 주문 화면이 그대로 있고, 인쇄창을 닫으면 아무 일도 없었던
//   것처럼 됩니다 — 새 창을 닫고 돌아올 필요가 없습니다.
//   기공소는 이걸 하루에 수십 번 합니다.
//
// ★ 틀 안에서는 껍데기가 안 보이게 `?bare=1` 로 부릅니다.
//   상단바·사이드바가 종이에 찍히면 안 됩니다.
//
// ★ **못 되면 새 창으로 물러섭니다.** 틀 안 인쇄를 막는 브라우저가
//   있습니다. 그때 아무 일도 안 일어나면 사람은 버튼이 고장 난 줄
//   압니다 — 종이를 못 뽑는 것이 이 화면에서 제일 나쁜 일입니다.
//
// ★ 틀은 다 쓰고 치웁니다. 남겨 두면 주문을 옮겨 다닐 때마다 하나씩
//   쌓입니다.
// =========================================================

'use client';

import { useRef, useState } from 'react';

/** 그림이 다 앉을 때까지 — 치식도가 반만 그려진 채로 뜨면 안 됩니다 */
const SETTLE_MS = 350;

export default function WorkOrderButton({ href }: { href: string }) {
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function print() {
    if (busy) return;
    setBusy(true);

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';

    /** 한 번만 치웁니다 — onload 가 두 번 오는 브라우저가 있습니다 */
    let done = false;

    const giveUp = () => {
      if (done) return;
      done = true;
      frame.remove();
      setBusy(false);
      // 마지막 길 — 새 창에서 열고 거기서 인쇄창을 띄웁니다
      window.open(`${href}?print=1`, '_blank', 'noopener');
    };

    frame.onerror = giveUp;

    frame.onload = () => {
      if (done) return;
      done = true;

      timer.current = setTimeout(() => {
        try {
          const win = frame.contentWindow;
          if (!win) throw new Error('틀이 비었습니다');

          /*
            ★ 인쇄가 끝난 뒤에 치웁니다. 바로 지우면 인쇄창이 아직
              읽고 있는 문서가 사라져 빈 종이가 나옵니다.
          */
          win.addEventListener('afterprint', () => {
            frame.remove();
            setBusy(false);
          });

          win.focus();
          win.print();

          /*
            ★ afterprint 를 안 보내는 브라우저가 있습니다. 그때를 대비해
              한참 뒤에 한 번 더 치웁니다 — 안 그러면 틀이 남습니다.
          */
          setTimeout(() => {
            if (document.body.contains(frame)) {
              frame.remove();
              setBusy(false);
            }
          }, 60_000);
        } catch {
          frame.remove();
          setBusy(false);
          window.open(`${href}?print=1`, '_blank', 'noopener');
        }
      }, SETTLE_MS);
    };

    frame.src = `${href}?bare=1`;
    document.body.appendChild(frame);
  }

  return (
    <button
      type="button"
      onClick={print}
      disabled={busy}
      title="기공의뢰서 인쇄창을 바로 엽니다"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#BFD5F5] bg-[#F2F7FE] px-2.5 text-[13px] font-bold text-[#1279E8] hover:bg-[#E7EEFA] disabled:opacity-60"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 8V3h8v5" />
        <path d="M6 15H4v-5h12v5h-2" />
        <path d="M6 13h8v5H6z" />
      </svg>
      {busy ? '여는 중…' : '기공의뢰서'}
    </button>
  );
}
