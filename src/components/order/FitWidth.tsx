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
// ★ 인쇄 직전(beforeprint)과 폭이 바뀔 때마다 다시 잽니다 — 종이 폭은 화면과 다릅니다.
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
      setZoom(natural > 0 ? Math.min(1, room / natural) : 1);
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
      <div ref={inner} style={{ width: 'max-content', zoom }}>
        {children}
      </div>
    </div>
  );
}
