// =========================================================
// 놓을 위치: src/components/site/MillingStage.tsx
//
// 홈페이지 첫 화면의 밀링 장면. (사용자 요청 2026-08-14 —
// "메인 화면에는 지르코니아 밀링기 깔끔하게 가공하는 영상")
//
// ★ **영상 자리를 만들고, 영상이 없을 때 보여 줄 그림을 같이 넣었습니다.**
//   지금 저희에게 실제 밀링 영상 파일이 없습니다. 남의 영상을 받아다
//   붙이면 저작권이 걸리고, 자리를 빈 검은 네모로 두면 첫 화면이
//   고장 난 것처럼 보입니다. 그래서 **직접 그린 밀링 장면**을 기본으로
//   두고, 진짜 영상이 생기면 그것으로 바뀌게 했습니다.
//
// ★ 바꾸는 곳은 `LandingPage.tsx` 의 `SITE.heroVideo` **한 줄**입니다.
//   `public/media/` 에 파일을 넣고 그 줄에 경로를 적으면 끝입니다.
//   파일이 있는지 서버에서 뒤지게 하지 않았습니다 — Vercel 에서는
//   `public/` 이 함수 안에 없을 수 있어서 **되기도 하고 안 되기도 하는**
//   코드가 됩니다. 그건 나중에 원인을 못 찾습니다.
//
// ★ 영상은 소리 없이 저절로 돕니다(`muted` `playsInline`).
//   이 셋 중 하나만 빠져도 휴대전화에서 재생이 막힙니다.
//
// ★ 움직임을 싫어하는 설정을 켠 분에게는 멈춘 그림이 나갑니다
//   (globals.css 의 `prefers-reduced-motion`). 어지럼증 때문에 그 설정을
//   켜 두는 분들이 있습니다.
// =========================================================

export interface MillingStageProps {
  /** 실제 영상 파일 경로. 비어 있으면 아래 그림이 나갑니다 */
  src?: string;
  /** 영상이 뜨기 전에 보여 줄 정지 이미지 */
  poster?: string;
}

export default function MillingStage({ src, poster }: MillingStageProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#243352] bg-[#0E1626] shadow-[0_28px_60px_-34px_rgba(14,28,58,0.75)]">
      {src ? (
        <video
          className="block aspect-[520/340] w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          aria-label="지르코니아 디스크를 밀링하는 모습"
        >
          <source src={src} />
        </video>
      ) : (
        <MillingArt />
      )}
    </div>
  );
}

// ---------- 그려 넣은 밀링 장면 ----------

/**
 * 위에서 내려다본 5축 밀링. 디스크가 천천히 돌고, 스핀들이 제자리에서
 * 깎으며, 다 깎인 크라운이 하나씩 밝아집니다.
 *
 * ★ 숫자를 안 지어냈습니다. 화면 아래 글씨는 디스크 규격(98φ)과
 *   공정 이름뿐입니다. 가동률·정확도 같은 것을 적어 두면 물어볼 때
 *   곤란해집니다.
 */
function MillingArt() {
  return (
    <svg
      viewBox="0 0 520 340"
      className="block w-full"
      role="img"
      aria-label="지르코니아 디스크를 밀링하는 모습"
    >
      <defs>
        <linearGradient id="ms-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#18233D" />
          <stop offset="55%" stopColor="#111A2E" />
          <stop offset="100%" stopColor="#0A101C" />
        </linearGradient>

        <radialGradient id="ms-disc" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#FBFCFE" />
          <stop offset="58%" stopColor="#E6EAF1" />
          <stop offset="100%" stopColor="#C9D1DE" />
        </radialGradient>

        <linearGradient id="ms-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7E8CA4" />
          <stop offset="34%" stopColor="#E8EDF5" />
          <stop offset="62%" stopColor="#9AA7BC" />
          <stop offset="100%" stopColor="#6C7A93" />
        </linearGradient>

        <radialGradient id="ms-glow">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#9CC6FF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#4C8DF5" stopOpacity="0" />
        </radialGradient>

        <pattern id="ms-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#FFFFFF" strokeOpacity="0.035" />
        </pattern>
      </defs>

      {/* 가공실 */}
      <rect width="520" height="340" fill="url(#ms-bg)" />
      <rect width="520" height="340" fill="url(#ms-grid)" />

      {/* 공구가 지나갈 길 — 점선이 흐릅니다 */}
      <circle
        cx="262"
        cy="196"
        r="66"
        fill="none"
        stroke="#4C8DF5"
        strokeOpacity="0.4"
        strokeWidth="1.2"
        strokeDasharray="5 7"
        className="ms-path"
      />

      {/* ---- 디스크 (돕니다) ---- */}
      <g className="ms-disc">
        <circle cx="262" cy="196" r="100" fill="url(#ms-disc)" />
        <circle cx="262" cy="196" r="100" fill="none" stroke="#A9B4C6" strokeWidth="1.6" />
        <circle cx="262" cy="196" r="91" fill="none" stroke="#B9C2D2" strokeWidth="1" strokeOpacity="0.9" />

        {/* 방향을 알려 주는 홈 */}
        <rect x="256" y="88" width="12" height="9" rx="2" fill="#AEB8C8" />

        {/* 물림 자리 */}
        <circle cx="262" cy="196" r="13" fill="#D2D9E4" stroke="#A9B4C6" strokeWidth="1.4" />
        <circle cx="262" cy="196" r="4" fill="#8D99AC" />

        {/* 크라운 아홉 자리 — 넷은 다 깎였고, 나머지는 아직 */}
        {CROWN_ANGLES.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 262 196) translate(262 130)`}>
            {i < 4 ? <CutCrown /> : <PendingCrown />}
          </g>
        ))}
      </g>

      {/* ---- 스핀들 (제자리에서 깎습니다) ---- */}
      <g className="ms-spindle">
        <rect x="234" y="4" width="56" height="40" rx="7" fill="#26334C" stroke="#3B4D74" strokeWidth="1.4" />
        <rect x="243" y="13" width="38" height="6" rx="3" fill="#4C8DF5" fillOpacity="0.55" />
        <rect x="243" y="25" width="24" height="4" rx="2" fill="#5C6E92" />
        <rect x="248" y="44" width="28" height="12" rx="3" fill="#39496B" stroke="#4A5E88" strokeWidth="1.2" />

        {/* 버 */}
        <path d="M256 56h12l-2.6 54h-6.8Z" fill="url(#ms-steel)" />
        <path d="M258.6 110h6.8l-3.4 14Z" fill="#DCE4F0" />
        <path d="M257.4 68h11.2M257.8 80h10.4M258.2 92h9.6" stroke="#6F7D95" strokeWidth="0.9" strokeOpacity="0.75" />
      </g>

      {/* ---- 깎이는 자리 ---- */}
      <g className="ms-cut">
        <circle cx="262" cy="128" r="26" fill="url(#ms-glow)" />
        <circle cx="262" cy="128" r="3.4" fill="#FFFFFF" fillOpacity="0.9" />
      </g>

      {/* 튀는 가루 — 넷이 시차를 두고 */}
      <g stroke="#CFE0FF" strokeWidth="1.4" strokeLinecap="round">
        <path d="M262 128l-16 -9" className="ms-dust ms-dust-1" />
        <path d="M262 128l17 -7" className="ms-dust ms-dust-2" />
        <path d="M262 128l-11 12" className="ms-dust ms-dust-3" />
        <path d="M262 128l13 11" className="ms-dust ms-dust-4" />
      </g>

      {/* ---- 아래 글씨 ---- */}
      <g fontFamily="var(--font-sans)">
        <circle cx="32" cy="26" r="4" fill="#4CD08A" className="ms-blink" />
        <text x="43" y="30" fill="#8FA6CE" fontSize="11.5" fontWeight="700" letterSpacing="1.6">
          MILLING
        </text>

        <text x="28" y="304" fill="#7C93BE" fontSize="11.5" fontWeight="700" letterSpacing="1.4">
          ZIRCONIA DISC 98φ
        </text>
        <rect x="28" y="314" width="212" height="4" rx="2" fill="#22304C" />
        <rect x="28" y="314" width="212" height="4" rx="2" fill="#4C8DF5" className="ms-progress" />

        <text x="492" y="304" textAnchor="end" fill="#5F7398" fontSize="11.5" fontWeight="700" letterSpacing="1.4">
          5-AXIS · DRY
        </text>
      </g>
    </svg>
  );
}

/** 크라운이 놓이는 아홉 자리 */
const CROWN_ANGLES = [0, 40, 80, 120, 160, 200, 240, 280, 320];

/** 다 깎인 것 */
function CutCrown() {
  return (
    <g>
      <path
        d="M-9 11c-1.7-3.4-2-8-1-11 .9-2.7 3-4 4.6-4 1.2 0 2 .7 2.4 1.6.4-.9 1.2-1.6 2.4-1.6 1.6 0 3.7 1.3 4.6 4 1 3 .7 7.6-1 11-.9 1.8-2.2.7-2.6-1.2-.4-1.8-.6-2.6-1.8-2.6s-1.4.8-1.8 2.6c-.4 1.9-1.7 3-2.6 1.2Z"
        fill="#FFFFFF"
        stroke="#A9B4C6"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M-4.6 -1.4c1.3 1.4 3.6 1.4 4.9 0" fill="none" stroke="#C3CBD9" strokeWidth="0.9" />
    </g>
  );
}

/** 아직 안 깎인 자리 */
function PendingCrown() {
  return (
    <path
      d="M-9 11c-1.7-3.4-2-8-1-11 .9-2.7 3-4 4.6-4 1.2 0 2 .7 2.4 1.6.4-.9 1.2-1.6 2.4-1.6 1.6 0 3.7 1.3 4.6 4 1 3 .7 7.6-1 11-.9 1.8-2.2.7-2.6-1.2-.4-1.8-.6-2.6-1.8-2.6s-1.4.8-1.8 2.6c-.4 1.9-1.7 3-2.6 1.2Z"
      fill="#DCE2EC"
      fillOpacity="0.5"
      stroke="#B6BFCE"
      strokeWidth="0.9"
      strokeDasharray="3 2.5"
      strokeLinejoin="round"
    />
  );
}
