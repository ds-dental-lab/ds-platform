// =========================================================
// 놓을 위치: src/components/billing/AutoPrint.tsx
//
// ?print=1 로 열리면 인쇄창을 띄웁니다.
//
// ★ 소리 없이 PDF 파일로 떨어지게 하려면 한글 글꼴을 통째로 싣거나
//   서버에서 그려야 합니다 — 둘 다 지금 없습니다. 브라우저 인쇄창의
//   기본 대상이 'PDF로 저장' 이라, 지금은 여기까지가 정직한 최선입니다.
//
// ★ 그림이 다 앉은 뒤에 띄웁니다.
//   바로 부르면 표가 반만 그려진 채로 인쇄창이 뜹니다.
// =========================================================

'use client';

import { useEffect } from 'react';

export default function AutoPrint({ on }: { on: boolean }) {
  useEffect(() => {
    if (!on) return;

    const timer = setTimeout(() => window.print(), 400);

    return () => clearTimeout(timer);
  }, [on]);

  return null;
}
