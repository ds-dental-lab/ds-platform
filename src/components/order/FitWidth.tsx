'use client';

// =========================================================
// 놓을 위치: src/components/order/FitWidth.tsx
//
// 안의 것이 자리보다 넓으면 **통째로 줄여** 한 폭에 담습니다 (2026-09-21).
// 기공의뢰서의 치식도가 약 960px 인데 A4 폭은 약 720px 이라, 스크롤바가
// 생기고 오른쪽 치아(24~28, 35~38)가 종이에서 잘려 나갔습니다.
//
// ★ transform 이 아니라 zoom — transform 은 자리를 그대로 차지해 아래에
//   빈 공간이 남고, 인쇄에서 다음 칸과 겹칩니다. zoom 은 차지하는 자리도 줄입니다.
// ★ 화면에서만 잽니다. 인쇄는 globals.css 의 고정 배율이 맡습니다 (2026-09-21) —
//   인쇄 단추는 1px 짜리 숨은 틀에서 print() 를 불러, 거기서는 폭을 잴 수 없고
//   잰 값이 인쇄 전에 반영되지도 않아 치식도가 줄지 않은 채 잘렸습니다.
// =========================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function FitWidth({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useIsoLayoutEffect(() => {
    const fit = () => {
      const box = outer.current;
      const content = inner.current;
      if (!box || !content) return;
      // zoom 을 뺀 본래 폭
      const natural = content.scrollWidth;
      const room = box.clientWidth;
      // ★ 폭을 못 재는 자리(인쇄용 1px 틀)에서는 손대지 않습니다 — 인쇄는 CSS 가 맡습니다
      if (natural <= 0 || room < 200) return setZoom(1);
      setZoom(Math.min(1, room / natural));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (outer.current) ro.observe(outer.current);
    window.addEventListener('beforeprint', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('beforeprint', fit);
    };
  }, []);

  return (
    <div ref={outer} className="w-full overflow-hidden">
      <div ref={inner} className="fit-width-inner" style={{ width: 'max-content', zoom }}>
        {children}
      </div>
    </div>
  );
}
