// =========================================================
// 놓을 위치: src/components/site/MillingStage.tsx
//
// 홈페이지 첫 화면의 밀링 장면. (사용자 요청 2026-08-14 —
// "메인 화면에는 지르코니아 밀링기 깔끔하게 가공하는 영상")
//
// ★ **세로 칸입니다.** 넣을 영상이 쇼츠(9:16)라서 그렇습니다.
//   가로 칸에 세로 영상을 넣으면 좌우가 시커멓게 남거나, 위아래를
//   40% 넘게 잘라 내야 합니다. 칸을 영상에 맞추는 편이 낫습니다.
//   지금 비율(2:3)에서 잘리는 것은 위아래 8% 씩입니다.
//
// ★ 들어오는 길이 셋이고, 순서가 정해져 있습니다.
//   1) 유튜브 아이디  2) 우리 서버의 영상 파일  3) 직접 그린 장면
//   셋 다 없을 수는 없습니다 — 3번이 늘 받쳐 줍니다. 치과 중에는
//   유튜브를 막아 둔 곳이 있어서, 그런 곳에서는 검은 네모만 남습니다.
//
// ★ **마크를 잘라 냅니다** (사용자 요청 — "상단 마크 빼고").
//   테두리를 다 드러내 놓고 재 봤더니 셋이 있었습니다.
//
//     위 2.4~12.5%   유튜브가 씌우는 제목줄 (채널 사진·제목·채널명)
//     위 3.9~ 9.3%   올린 사람이 **영상에 구워 넣은** 채널 로고 (오른쪽 위)
//     아래 91.5%~    유튜브가 씌우는 'Shorts' 로고
//
//   앞의 것과 뒤의 것은 주소 설정으로 못 없앱니다(`controls=0` 을 줘도
//   쇼츠 껍데기는 제목줄을 붙입니다). 가운데 것은 영상 자체라 애초에
//   방법이 없습니다. **셋 다 잘라 내는 것이 유일한 길입니다.**
//
//   그래서 영상을 칸보다 25% 크게 잡고 **위 17% · 아래 15.5%** 를
//   잘랐습니다. 필요한 양(12.5% / 8.5%)보다 넉넉합니다.
//   좌우로는 10% 씩 잘리는데, 깎는 자리가 한가운데라 안 걸립니다.
//
// ★ 유튜브가 씌우는 나머지는 주소로 껐습니다 → YouTubeAmbient.tsx
//
// ★ 소리 없이 저절로 돕니다(`mute` `playsinline`). 이 둘 중 하나만
//   빠져도 휴대전화에서 재생이 막힙니다.
//
// ★ 움직임을 싫어하는 설정을 켠 분에게는 그린 장면이 멈춰서 나갑니다
//   (globals.css 의 `prefers-reduced-motion`).
// =========================================================

import YouTubeAmbient from '@/components/site/YouTubeAmbient';

export interface MillingStageProps {
  /** 유튜브 영상 아이디. 가장 먼저 씁니다 */
  youtubeId?: string;
  /** 우리 서버에 올린 영상 파일 경로 */
  src?: string;
  /** 영상이 뜨기 전에 보여 줄 정지 이미지 */
  poster?: string;
  /**
   * 여기까지만 틀고 처음으로 돌아갑니다 (초). 없으면 끝까지.
   *
   * ★ **유튜브에만 걸립니다.** 우리 서버 영상(`src`)에는 아직 안 걸어
   *   뒀습니다 — 그러려면 이 조각이 클라이언트 컴포넌트가 되어야 하는데,
   *   지금 안 쓰는 길 때문에 그러기는 아깝습니다. 우리 영상을 올릴 때는
   *   애초에 20초로 잘라서 올리는 편이 낫습니다(파일도 작아집니다).
   */
  stopAt?: number;
  /** 남의 영상을 쓸 때 아래에 붙일 한 줄. 비우면 안 나옵니다 */
  credit?: string;
}

/** 그린 장면의 바탕과 똑같이. 영상이 없을 때 이어지는 곳이 안 보이게 합니다 */
const CHAMBER = 'linear-gradient(160deg, #18233D 0%, #111A2E 55%, #0A101C 100%)';

export default function MillingStage({ youtubeId, src, poster, stopAt, credit }: MillingStageProps) {
  return (
    <figure className="mx-auto w-full max-w-[330px]">
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-[#243352] shadow-[0_28px_60px_-34px_rgba(14,28,58,0.75)]"
        style={{ background: CHAMBER }}
      >
        {/* 늘 깔려 있습니다 — 영상이 막히거나 늦게 뜨면 이것이 보입니다 */}
        <MillingArt className="absolute inset-0 m-auto h-auto w-full" />

        {youtubeId ? (
          // 125% × 148.1% 는 9:16 을 지킨 채 칸보다 25% 크게 잡은 것이고,
          // -25.2% 는 그중 위쪽을 더 많이 버리려고 끌어올린 것입니다
          <YouTubeAmbient
            id={youtubeId}
            stopAt={stopAt}
            title="지르코니아 밀링"
            className="pointer-events-none absolute left-1/2 top-[-25.2%] h-[148.1%] w-[125%] -translate-x-1/2 border-0"
          />
        ) : src ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
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
        ) : null}
      </div>

      {credit && (
        <figcaption className="mt-2 text-center text-[12px] text-[#B0B8C6]">{credit}</figcaption>
      )}
    </figure>
  );
}

// ---------- 그려 넣은 밀링 장면 ----------

/**
 * 위에서 내려다본 5축 밀링. 디스크가 천천히 돌고, 스핀들이 제자리에서
 * 깎으며, 다 깎인 크라운이 하나씩 밝아집니다.
 *
 * ★ 숫자를 안 지어냈습니다. 아래 글씨는 디스크 규격(98φ)과 공정
 *   이름뿐입니다. 가동률·정확도 같은 것을 적어 두면 물어볼 때
 *   곤란해집니다.
 *
 * ★ 세로 칸에서는 위아래로 여백이 생기는데, 바탕색을 칸과 똑같이
 *   맞춰 뒀으므로 이어지는 자리가 안 보입니다. 잘라 내는(slice) 대신
 *   여백을 두는 이유는, 잘라 내면 아래 글씨가 먼저 날아가서입니다.
 */
function MillingArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 340"
      className={className}
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
        <circle cx="108" cy="26" r="4" fill="#4CD08A" className="ms-blink" />
        <text x="119" y="30" fill="#8FA6CE" fontSize="11.5" fontWeight="700" letterSpacing="1.6">
          MILLING
        </text>

        <text x="104" y="304" fill="#7C93BE" fontSize="11.5" fontWeight="700" letterSpacing="1.4">
          ZIRCONIA DISC 98φ
        </text>
        <rect x="104" y="314" width="180" height="4" rx="2" fill="#22304C" />
        <rect x="104" y="314" width="180" height="4" rx="2" fill="#4C8DF5" className="ms-progress" />

        <text x="418" y="304" textAnchor="end" fill="#5F7398" fontSize="11.5" fontWeight="700" letterSpacing="1.4">
          5-AXIS
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
