// =========================================================
// 놓을 위치: src/components/billing/PrintTitle.tsx
//
// 인쇄하는 동안만 창 제목을 파일명으로 바꿉니다.
// (사용자 결정 2026-08-13)
//
// ★ 크롬의 'PDF 로 저장' 은 기본 파일명을 **창 제목**에서 가져옵니다.
//   그대로 두면 거래처마다 `DenFlow.pdf` 가 나옵니다.
//
// ★ 끝나면 되돌립니다.
//   안 되돌리면 인쇄한 뒤로 브라우저 탭에 파일명이 계속 붙어 있습니다.
//   [[UnreadPing]] 이 붙이는 (2) 표시와도 엉킵니다.
// =========================================================

'use client';

import { useEffect } from 'react';

export default function PrintTitle({ fileName }: { fileName: string }) {
  useEffect(() => {
    const before = () => {
      document.title = fileName;
    };

    /*
      ★ 원래 제목을 미리 담아 두지 않습니다.
        담아 두면 그 사이에 안 읽은 알림 수가 바뀌었을 때 옛 제목으로
        되돌아갑니다. Next 가 화면마다 제목을 다시 쓰므로, 되돌릴 때는
        '이 화면의 제목' 을 그때 다시 만듭니다.
    */
    const after = () => {
      document.title = 'DenFlow';
    };

    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);

    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [fileName]);

  return null;
}
