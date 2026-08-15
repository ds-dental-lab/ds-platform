// =========================================================
// 놓을 위치: src/components/brand/DenFlowMark.tsx
//
// DenFlow 마크. 사용자가 준 denflow_C_v2_symbol.svg 를 그대로 옮겼습니다
// (2026-08-14 교체 — 전에는 점·선 그라디언트 마크였습니다).
// 치아 능선을 한 붓으로 그린 선입니다. 남색 몸통에 청록 꼬리.
//
// ★ 파일이 아니라 컴포넌트로 둡니다.
//   로그인·회원가입·비밀번호찾기·상단바 넷이 같은 마크를 씁니다.
//   높이만 주면 폭은 비율대로 따라옵니다 — 눌린 로고가 안 생깁니다.
//
// ★ viewBox 를 원본(0 0 120 120)이 아니라 **잉크에 맞춰 잘랐습니다.**
//   원본은 정사각형인데 그림은 가로로 긴 띠라, 위아래 절반이 빈칸입니다.
//   그대로 두면 "높이 26px" 를 줘도 실제 보이는 것은 13px 라
//   옆 글자보다 마크만 작아 보입니다. 자르고 나면 준 높이가 곧 잉크 높이입니다.
//
// ★ 색을 시안 그대로 박았습니다 (남색 #16324F · 청록 #14B8A6).
//   섹터 색(치과 파랑·센터 보라·기공소 초록)을 안 탑니다 — 화면마다
//   색이 바뀌면 그것은 로고가 아닙니다.
//
// ★ 획 굵기 9 는 잉크 높이 60 의 15% 입니다. 19px 로 줄여도 획이
//   2.8px 라 버팁니다 — 지난번 첫 마크가 작은 자리에서 뭉갠 이유가
//   획이 가늘어서였습니다.
// =========================================================

/* 잘라 낸 viewBox — 획 굵기 9 의 절반까지 감안한 실제 잉크 범위 */
const BOX = { x: 3.5, y: 27, w: 113, h: 60 };

export default function DenFlowMark({
  height = 26,
  className,
}: {
  height?: number;
  className?: string;
}) {
  const width = Math.round((height * BOX.w) / BOX.h);

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`}
      role="img"
      aria-label="DenFlow"
      style={{ flexShrink: 0 }}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="9">
        {/* 몸통 — 들어와서 치아 능선 둘을 넘는 선 */}
        <path
          d="M8 82 H 24
             C 33 82, 27 44, 44 34
             C 51 30, 55 40, 60 40
             C 65 40, 69 30, 76 34
             C 93 44, 87 82, 96 82"
          stroke="#16324F"
        />
        {/* 꼬리 — 흐름이 이어져 나감 */}
        <path d="M96 82 H 112" stroke="#14B8A6" />
      </g>
    </svg>
  );
}
