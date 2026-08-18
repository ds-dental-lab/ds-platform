// =========================================================
// 놓을 위치: src/components/brand/DenFlowLogo.tsx
//
// 마크 + 글자('DenFlow') 한 벌. (사용자 요청 2026-08-18 —
// "홈페이지 로고 이걸로 해줘, 통일성이 있어야지")
//
// ★ 글자가 **세 벌**로 흩어져 있었습니다.
//   로그인·가입·비밀번호찾기는 화면 안 CSS(.logo-txt)로,
//   사이드바는 Tailwind 로, 홈페이지는 또 다른 글자로 그렸습니다.
//   마크는 2026-08-14 에 한 벌로 합쳤는데 글자는 그대로 뒀더니,
//   홈페이지만 다른 이름이 되어도 아무도 모르는 상태였습니다.
//   실제로 그렇게 됐고, 그래서 여기로 모읍니다.
//
// ★ 'Den' 은 진하게, 'Flow' 는 흐리게.
//   색은 시안 그대로입니다 (#1B2A4A · #9AA3AE). 마크의 남색과
//   한 끗 다른데, 글자가 마크보다 넓은 면을 차지해 같은 값을 쓰면
//   글자 쪽이 더 무거워 보입니다.
//
// ★ 크기를 둘로 받습니다.
//   자리마다 마크와 글자의 균형이 다릅니다 — 로그인 카드는 크게
//   (26/24), 사이드바는 작게(19/17). 한 값에서 비율로 계산해 봤지만
//   자리마다 비율이 달라(1.08~1.29) 억지가 됐습니다. 눈으로 맞춘
//   값을 그대로 받는 편이 정직합니다.
// =========================================================

import DenFlowMark from '@/components/brand/DenFlowMark';

export interface DenFlowLogoProps {
  /** 마크 높이 (px) */
  markHeight?: number;
  /** 글자 크기 (px) */
  fontSize?: number;
  /** 마크와 글자 사이 (px) */
  gap?: number;
  className?: string;
}

export default function DenFlowLogo({
  markHeight = 22,
  fontSize = 17,
  gap = 10,
  className,
}: DenFlowLogoProps) {
  return (
    <span className={'inline-flex items-center ' + (className ?? '')} style={{ gap }}>
      <DenFlowMark height={markHeight} />

      <span
        className="inline-flex items-baseline whitespace-nowrap leading-none tracking-[-0.045em]"
        style={{ fontSize }}
      >
        <b className="font-extrabold text-[#1B2A4A]">Den</b>
        <i className="font-semibold not-italic tracking-[.01em] text-[#9AA3AE]">Flow</i>
      </span>
    </span>
  );
}
