// =========================================================
// 놓을 위치: src/components/site/SiteArt.tsx
//
// 홈페이지에 들어가는 선 그림들. (사용자 요청 2026-08-14 —
// "나머지 자리도 적당한거 일단 붙여줘")
//
// ★ **사진이 아니라 그림입니다.** 장비 사진이 아직 없어서, 남의 사진을
//   가져오는 대신 직접 그렸습니다. 사진이 생기면 이 자리를 그대로
//   바꾸시면 됩니다.
//
// ★ 굵기와 크기를 한 곳에서 정합니다. 화면마다 따로 그리면 어떤 칸은
//   두껍고 어떤 칸은 얇아집니다.
//
// ★ 색을 안 박았습니다 — `currentColor` 라 놓이는 자리의 글자색을
//   따라갑니다. 어두운 칸(진행 과정)과 밝은 칸(취급 보철)에 같은
//   그림을 쓰기 때문입니다.
// =========================================================

import type { ReactNode } from 'react';

export type SiteArtName =
  | 'scan'
  | 'design'
  | 'mill'
  | 'ship'
  | 'crown'
  | 'inlay'
  | 'implant'
  | 'bridge'
  | 'file';

/** 크라운 하나. 여러 그림이 같이 쓰므로 따로 뽑아 둡니다 */
const TOOTH =
  'M11 27c-2-3.5-2.6-9-1.4-12.6C10.7 11 13 9.4 15 9.4c1.4 0 2.4.9 3 2 .6-1.1 1.6-2 3-2 2 0 4.3 1.6 5.4 5 1.2 3.6.6 9.1-1.4 12.6-1.1 1.9-2.7.8-3.2-1.4-.5-2.1-.7-3.1-2.3-3.1s-1.8 1-2.3 3.1c-.5 2.2-2.1 3.3-3.2 1.4Z';

const ART: Record<SiteArtName, ReactNode> = {
  // 구강스캐너 — 손잡이와 퍼지는 파장
  scan: (
    <>
      <path d="M4.6 27.4l8.6-8.6 3 3-8.6 8.6a2.1 2.1 0 0 1-3-3Z" />
      <path d="M13.2 18.8l4.2-4.2 3 3-4.2 4.2" />
      <path d="M23 14a6 6 0 0 1 0-8.4" />
      <path d="M27 16.4a11 11 0 0 1 0-13.2" />
    </>
  ),

  // 설계 — 크라운 위에 격자
  design: (
    <>
      <path d={TOOTH} />
      <path d="M9.6 16.4h12.8M18 9.6V27" strokeDasharray="2.4 2.2" strokeOpacity="0.7" />
      <path d="M9.9 21.6h13" strokeDasharray="2.4 2.2" strokeOpacity="0.7" />
    </>
  ),

  // 밀링 — 디스크와 버
  mill: (
    <>
      <circle cx="16" cy="20.5" r="9.2" />
      <circle cx="16" cy="20.5" r="2.2" />
      <path d="M16 3.2v6.4" />
      <path d="M13.6 9.6h4.8l-1 3.4h-2.8Z" />
    </>
  ),

  // 납품 — 상자
  ship: (
    <>
      <path d="M4.6 10.6L16 5.2l11.4 5.4v10.8L16 26.8 4.6 21.4Z" />
      <path d="M4.6 10.6L16 16l11.4-5.4" />
      <path d="M16 16v10.8" />
    </>
  ),

  // 크라운
  crown: (
    <>
      <path d={TOOTH} />
      <path d="M12.6 17.4c1.7 1.7 4.7 1.7 6.4 0" strokeOpacity="0.6" />
    </>
  ),

  // 인레이 — 크라운에 박히는 조각
  inlay: (
    <>
      <path d={TOOTH} />
      <path d="M13.4 15.2h6.4l-1.4 4.4h-3.6Z" />
    </>
  ),

  // 임플란트 — 어버트먼트와 나사
  implant: (
    <>
      <path d="M16 3.4v5.4" />
      <path d="M12.4 8.8h7.2l-1.1 3.4h-5Z" />
      <path d="M13 12.2h6l-.9 12.4L16 28.6l-2.1-4Z" />
      <path d="M13.5 16h5M13.8 19.4h4.4M14.1 22.8h3.8" strokeOpacity="0.65" />
    </>
  ),

  // 브릿지 — 세 유닛
  bridge: (
    <>
      <path d="M4.4 12.6h23.2a2 2 0 0 1 2 2c0 5.4-2.2 11-5.3 11-2 0-2.1-3-3.1-3s-1.1 3-4 3-3-3-4-3-1.1 3-3.1 3c-3.1 0-5.3-5.6-5.3-11a2 2 0 0 1 2-2Z" />
      <path d="M12.6 12.6v10.2M19.4 12.6v10.2" strokeDasharray="2.4 2.2" strokeOpacity="0.65" />
    </>
  ),

  // 스캔 파일 — 어떤 스캐너든 받습니다
  file: (
    <>
      <path d="M7 4.4h11l7 7v16.2H7Z" />
      <path d="M18 4.4v7h7" />
      <path d="M11 22.6l3.6-4.6 3.2 3.6 3.2-5" />
    </>
  ),
};

export function SiteArt({
  name,
  className,
  strokeWidth = 1.6,
}: {
  name: SiteArtName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ART[name]}
    </svg>
  );
}
