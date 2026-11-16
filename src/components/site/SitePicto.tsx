// =========================================================
// 놓을 위치: src/components/site/SitePicto.tsx
//
// 홈페이지의 픽토그램 (2026-11-16, 사용자 "세련된 픽토그램 없을까").
//
// ★ 가는 선 아이콘(SiteArt)이 아니라 **속을 채운 표지판 그림**입니다.
//   공항·병원 안내판처럼 한 색으로 채우고, 겹치는 자리는 바탕색으로 파냅니다.
//   가는 선 아이콘을 동그라미에 넣은 모양은 어디서나 보는 것이라 걷어냈습니다.
//
// ★ 48칸 격자에 그렸습니다. 선은 3.5~4, 모서리는 둥글게 — 여덟 개가 한 식구로 보이게.
// ★ 색은 글자색을 따릅니다(currentColor). 파낼 자리의 색은 `cut` 으로 받습니다 —
//   놓이는 바탕과 같은 색을 주셔야 합니다.
// =========================================================

export type SitePictoName = 'scan' | 'review' | 'design' | 'mill' | 'ship' | 'track' | 'bridge' | 'chart';

/** 어금니 한 개 — 여러 그림이 같이 씁니다 (x 8~40, y 6~42) */
const TOOTH =
  'M24 9c-3-2.2-6-3-8.5-3C11 6 8 9.5 8 14.5c0 4 1.5 6.5 2.5 10 1 3.6 1.2 8 2 12 .6 3 1.6 5.5 3.5 5.5 2.2 0 2.6-3 3.2-6.5.6-3.4 1.6-6 4.800-6s4.200 2.600 4.800 6c.6 3.500 1 6.500 3.200 6.500 1.900 0 2.900-2.500 3.500-5.500.8-4 1-8.400 2-12 1-3.500 2.500-6 2.500-10C40 9.500 37 6 32.500 6c-2.500 0-5.500.8-8.500 3z';

function Tooth({ cx, cy, scale, fill = 'currentColor' }: { cx: number; cy: number; scale: number; fill?: string }) {
  return <path d={TOOTH} fill={fill} transform={`translate(${cx} ${cy}) scale(${scale}) translate(-24 -24)`} />;
}

export function SitePicto({
  name,
  className,
  cut = '#fff',
}: {
  name: SitePictoName;
  className?: string;
  /** 파낼 자리의 색 — 놓이는 바탕색 */
  cut?: string;
}) {
  const line = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden fill="currentColor">
      {name === 'scan' && (
        <>
          {/* 네 귀의 꺾쇠 = 스캔 틀 */}
          <g {...line} strokeWidth={3.6}>
            <path d="M5 15V9a4 4 0 0 1 4-4h6" />
            <path d="M33 5h6a4 4 0 0 1 4 4v6" />
            <path d="M43 33v6a4 4 0 0 1-4 4h-6" />
            <path d="M15 43H9a4 4 0 0 1-4-4v-6" />
          </g>
          <Tooth cx={24} cy={24} scale={0.66} />
        </>
      )}

      {name === 'review' && (
        <>
          {/* 돋보기 안의 확인 표시 */}
          <circle cx="20" cy="20" r="13.5" {...line} strokeWidth={4} />
          <path d="M31 31l11 11" {...line} strokeWidth={5.5} />
          <path d="M13.500 20.500l4.500 4.500 8.500-9.500" {...line} strokeWidth={3.6} />
        </>
      )}

      {name === 'design' && (
        <>
          {/* CAD 의 곡선 — 두 점과 당김손 */}
          <path d="M9 38C9 16 39 32 39 10" {...line} strokeWidth={4} />
          <path d="M9 38V21M39 10v17" {...line} strokeWidth={2.2} />
          <circle cx="9" cy="19" r="3.4" />
          <circle cx="39" cy="29" r="3.4" />
          <rect x="3.500" y="32.500" width="11" height="11" rx="2.500" />
          <rect x="33.500" y="4.500" width="11" height="11" rx="2.500" />
        </>
      )}

      {name === 'mill' && (
        <>
          {/* 지르코니아 원판에서 치아를 깎아 냄. 위는 밀링 바 */}
          <circle cx="24" cy="29" r="17" />
          <Tooth cx={24} cy={30} scale={0.52} fill={cut} />
          <rect x="18.500" y="7" width="11" height="10" rx="5" fill={cut} />
          <rect x="21.800" y="4" width="4.400" height="11" rx="2.200" />
          <rect x="18.500" y="0.500" width="11" height="6" rx="2" />
        </>
      )}

      {name === 'ship' && (
        <>
          {/* 상자 — 뚜껑과 몸통, 가운데 테이프 */}
          <rect x="4" y="9" width="40" height="10" rx="3" />
          <rect x="7" y="22" width="34" height="21" rx="3" />
          <rect x="20.500" y="9" width="7" height="10" fill={cut} />
          <rect x="20.500" y="22" width="7" height="9" rx="0" fill={cut} />
        </>
      )}

      {name === 'track' && (
        <>
          {/* 지나온 두 점과 다음 한 점 */}
          <path d="M9 24h30" {...line} strokeWidth={3.6} />
          <circle cx="9" cy="24" r="6" />
          <circle cx="24" cy="24" r="6" />
          <circle cx="39" cy="24" r="5" fill={cut} stroke="currentColor" strokeWidth={3.6} />
        </>
      )}

      {name === 'bridge' && (
        <>
          {/*
            보철 — 치아 위에 씌우는 머리(크라운)를 뿌리에서 살짝 띄웠습니다.
            ★ 처음에는 치아 셋을 이어 그렸는데 **빗이나 틀니로 보였습니다.** 한 개로 바꿨습니다.
          */}
          <Tooth cx={24} cy={24} scale={1.08} />
          <path d="M3 25.500c7-3.200 35-3.200 42 0" fill="none" stroke={cut} strokeWidth={3.4} strokeLinecap="round" />
        </>
      )}

      {name === 'chart' && (
        <>
          <rect x="6" y="27" width="9" height="16" rx="2.500" />
          <rect x="19.500" y="16" width="9" height="27" rx="2.500" />
          <rect x="33" y="5" width="9" height="38" rx="2.500" />
        </>
      )}
    </svg>
  );
}
