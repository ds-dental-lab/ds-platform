// =========================================================
// 놓을 위치: src/components/brand/DenFlowMark.tsx
//
// DenFlow 마크. 사용자가 준 denflow-mark-v2.svg 를 그대로 옮겼습니다.
// 왼쪽 점 셋(스캔)이 선으로 모여 오른쪽 한 줄기로 나갑니다.
//
// ★ 파일이 아니라 컴포넌트로 둡니다.
//   로그인·회원가입·비밀번호찾기·상단바 넷이 같은 마크를 씁니다.
//   높이만 주면 폭은 비율대로 따라옵니다 — 눌린 로고가 안 생깁니다.
//
// ★ viewBox 를 원본(0 0 100 100)이 아니라 **잉크에 맞춰 잘랐습니다.**
//   원본은 정사각형인데 그림은 가로로 길어서, 위아래 22% 가 빈칸입니다.
//   그대로 두면 "높이 26px" 를 줘도 실제로 보이는 것은 15px 라
//   옆 글자보다 마크만 작아 보입니다. 자르고 나면 준 높이가 곧 잉크 높이입니다.
//
// ★ 그라디언트 좌표는 userSpaceOnUse 입니다.
//   viewBox 를 잘라도 색이 흐르는 방향이 원본과 같습니다.
//   섹터 색(치과 파랑·센터 보라·기공소 초록)을 안 탑니다 — 화면마다
//   색이 바뀌면 그것은 로고가 아닙니다.
//
// ★ 획 굵기 8 은 잉크 높이 56 의 14% 입니다.
//   지난 마크가 작은 자리에서 뭉갠 이유가 획이 가늘어서였습니다.
//   19px 로 줄여도 획이 2.6px 라 버팁니다.
// =========================================================

/* 잘라 낸 viewBox — 획 굵기 8 의 절반까지 감안한 실제 잉크 범위 */
const BOX = { x: 6, y: 22, w: 90, h: 56 };

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
      <defs>
        {/*
          ★ id 는 문서에 하나만 있으면 됩니다.
            한 화면에 마크가 둘 뜨는 곳은 지금 없습니다(로그인 화면과
            상단바는 서로 다른 화면입니다). 둘을 나란히 놓을 일이 생기면
            이 id 를 인자로 받아야 합니다 — 같은 id 가 둘이면 브라우저가
            먼저 것만 씁니다.
        */}
        <linearGradient
          id="denflow-mark"
          gradientUnits="userSpaceOnUse"
          x1="8"
          y1="72"
          x2="94"
          y2="28"
        >
          <stop offset="0%" stopColor="#16D6D1" />
          <stop offset="55%" stopColor="#2D7BF4" />
          <stop offset="100%" stopColor="#7159F7" />
        </linearGradient>
      </defs>

      <g fill="none" stroke="url(#denflow-mark)" strokeWidth="8" strokeLinecap="round">
        {/* 스캔 — 점으로 흩어진 시작 */}
        <path d="M14 26 C21 25, 27 26, 33 28" strokeDasharray="0.1 12" />
        <path d="M10 50 H28" strokeDasharray="0.1 12" />
        <path d="M14 74 C21 75, 27 74, 33 72" strokeDasharray="0.1 12" />
        {/* 디자인·제작 — 선이 되어 모임 */}
        <path d="M33 28 C50 33, 65 43, 76 50" />
        <path d="M28 50 H76" />
        <path d="M33 72 C50 67, 65 57, 76 50" />
        {/* 배송 — 한 줄기로 나감 */}
        <path d="M76 50 H92" />
      </g>
    </svg>
  );
}
