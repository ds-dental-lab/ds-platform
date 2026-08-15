// =========================================================
// 놓을 위치: src/components/site/YouTubeAmbient.tsx
//
// 소리 없이 배경처럼 도는 유튜브 영상. (사용자 요청 2026-08-14)
//
// ★★ **플레이어 두 대를 겹쳐 놓고 번갈아 씁니다** (2026-08-15 —
//   사용자 신고 세 번째: "여전히 일시정지 나온다").
//
//   유튜브는 제 UI 를 세 군데서 얹습니다. 설정으로는 하나도 못 끕니다.
//     · 재생이 **시작**될 때 — 일시정지 물결·채널 표시 (약 3초)
//     · **되감을** 때 — 조작 표시가 다시 떠오름
//     · 멈출 때 — 큰 재생 단추
//
//   한 대로는 답이 없습니다. 시작도 되감기도 그 플레이어 화면 위에서
//   일어나기 때문입니다. 두 대면 답이 됩니다 —
//   **화면에는 항상 '깨끗하게 흐르는 중'인 쪽만** 보이고,
//   시작·정지·되감기는 전부 **숨은 쪽**에서 일어납니다.
//
//   한 바퀴 (stopAt=20 기준):
//     A 가 흐름 → 20초에 B 를 몰래 틂 → B 가 3.8초쯤 흘러 깨끗해지면
//     A→B 로 스르륵 교대 → A 는 숨어서 멈추고 처음으로 → (반복)
//
// ★ 값 셋의 근거
//   CLEAN 3.8초  시동 화면이 걷히는 데 약 3초 — 여유를 더한 값
//   교대 뒤 600ms  페이드(400ms)가 끝나기 전에 옛 쪽을 멈추면
//                  멈춘 화면이 스칩니다
//   stopAt 20 + CLEAN 3.8 + 여유 < 영상 길이 27초 — 넘치면 교대 전에
//   영상이 끝나 버립니다
//
// ★ `loop=1&playlist=` 를 안 쓰는 이유는 그대로입니다 — 그 값이 붙으면
//   재생목록 모드가 되어 한가운데 단추 셋이 박힙니다 (실측).
//
// ★ 영상은 `youtube-nocookie.com`, 스크립트는 `youtube.com` 입니다.
//   nocookie 쪽 iframe_api 는 404 입니다 (직접 받아 확인).
//
// ★ 눌리지 않습니다 — pointer-events 는 상속되므로 부모의 none 이
//   두 iframe 에도 걸립니다. 눌리면 유튜브가 제 화면을 덮어씁니다.
// =========================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { shouldRewind } from '@/server/domain/video';

interface YTPlayer {
  mute(): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
}

interface YTEvent {
  target: YTPlayer;
  data: number;
}

interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement,
    opts: { events: { onReady(e: YTEvent): void; onStateChange(e: YTEvent): void } },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** 영상이 끝났다는 신호 */
const ENDED = 0;

/** 멈췄다는 신호 */
const PAUSED = 2;

/** 얼마나 자주 들여다보는가 */
const WATCH_MS = 250;

/**
 * 재생 시작 후 이만큼 흘러야 '깨끗하다' 고 봅니다 (초).
 * 유튜브 시동 화면이 걷히는 데 약 3초 — 3.8 로 뒀다가 사용자 화면에서
 * 여전히 걸려 4.5 로 늘렸습니다 (2026-08-15). 환경마다 더 깁니다.
 */
const CLEAN = 4.5;

/** 교대 페이드가 끝난 뒤에야 옛 쪽을 멈춥니다 (ms) */
const AFTER_FADE_MS = 600;

export default function YouTubeAmbient({
  id,
  className,
  title,
  stopAt,
}: {
  id: string;
  className?: string;
  title: string;
  /** 이 시각에 다음 판으로 손을 바꿉니다 (초). 없으면 끝까지 갑니다 */
  stopAt?: number;
}) {
  const refA = useRef<HTMLIFrameElement>(null);
  const refB = useRef<HTMLIFrameElement>(null);

  /** 지금 보이는 쪽. -1 이면 아직 아무도 (그린 장면이 보입니다) */
  const [visible, setVisible] = useState(-1);

  useEffect(() => {
    /*
      ★★ 여기에 `한 번만 만들기` 표시를 두면 아무것도 안 만들어집니다.
        실제로 그렇게 짰다가 되감기가 통째로 죽었습니다(2026-08-14).
        개발 중에는 효과가 두 번 도는데, 표시와 cancelled 가 서로를
        막아 두 번 다 그냥 나가 버립니다. `cancelled` 하나면 1회차는
        버려지고 2회차만 남아 정확히 하나가 됩니다.
    */
    let cancelled = false;
    let watch: ReturnType<typeof setInterval> | undefined;

    loadPlayerApi()
      .then((YT) => {
        if (cancelled || !refA.current || !refB.current) return;

        /*
          ★ '우리가 시킨 멈춤'인지 표시해 둡니다.
            브라우저·유튜브가 제멋대로 멈추는 일이 있습니다(절전·백그라운드).
            보이는 쪽이 멈추면 화면 한가운데 큰 단추가 뜹니다 — 그때는
            바로 다시 틀어야 합니다. 그런데 교대 뒤에 우리가 시키는 멈춤까지
            다시 틀면 두 대가 동시에 돌아 버립니다. 그래서 표시로 가릅니다.
        */
        const intendedPause = [false, false];

        const make = (el: HTMLIFrameElement, idx: number, starter: boolean) =>
          new YT.Player(el, {
            events: {
              onReady(e) {
                e.target.mute();
                if (starter) {
                  e.target.playVideo();
                } else {
                  // 대기조 — 숨은 채 처음에서 기다립니다
                  intendedPause[idx] = true;
                  e.target.pauseVideo();
                  e.target.seekTo(0, true);
                }
              },
              onStateChange(e) {
                // 시키지 않은 멈춤이면 되살립니다
                if (e.data === PAUSED && !intendedPause[idx]) {
                  e.target.playVideo();
                  return;
                }

                // stopAt 이 없거나 영상이 그보다 짧으면 여기로 옵니다.
                // 이 다시 시작은 화면에 보일 수 있습니다 — stopAt 을
                // 영상 길이보다 짧게 두는 것이 이 조각을 쓰는 전제입니다
                if (e.data !== ENDED) return;
                e.target.seekTo(0, true);
                e.target.playVideo();
              },
            },
          });

        const players = [make(refA.current, 0, true), make(refB.current, 1, false)];

        /*
          ★ 상태는 넷뿐이고 한 방향으로만 돕니다.
            first   첫 판이 깨끗해지기를 기다림 (화면엔 그린 장면)
            solo    한쪽만 흐르는 중
            warming 손 바꿀 때가 되어 대기조를 몰래 틀어 둠
            cooling 교대 페이드 중 — 끝나면 옛 쪽을 숨어서 정리
        */
        let active = 0;
        let phase: 'first' | 'solo' | 'warming' | 'cooling' = 'first';
        let fadeStartedAt = 0;

        watch = setInterval(() => {
          try {
            const t = players[active].getCurrentTime();

            if (phase === 'first' && Number.isFinite(t) && t >= CLEAN) {
              if (!cancelled) setVisible(active);
              phase = 'solo';
            }

            if (phase === 'solo' && shouldRewind(t, stopAt)) {
              intendedPause[1 - active] = false;
              players[1 - active].playVideo();
              phase = 'warming';
            }

            if (phase === 'warming') {
              const ts = players[1 - active].getCurrentTime();
              if (Number.isFinite(ts) && ts >= CLEAN) {
                if (!cancelled) setVisible(1 - active);
                phase = 'cooling';
                fadeStartedAt = Date.now();
              }
            }

            if (phase === 'cooling' && Date.now() - fadeStartedAt > AFTER_FADE_MS) {
              // 이제 아무도 안 봅니다 — 숨어서 정리하고 다음 차례를 기다립니다
              intendedPause[active] = true;
              players[active].pauseVideo();
              players[active].seekTo(0, true);
              active = 1 - active;
              phase = 'solo';
            }
          } catch {
            /* 플레이어가 아직 덜 준비된 것 — 다음 차례에 다시 봅니다 */
          }
        }, WATCH_MS);
      })
      .catch(() => {
        // API 를 못 받으면 교대를 못 겁니다. 첫 판은 주소의 autoplay 로
        // 이미 돌고 있지만, 깨끗해졌다는 신호를 줄 수 없어 화면에는
        // 그린 장면이 남습니다 — 멈춘 유튜브 화면보다 낫습니다
      });

    return () => {
      cancelled = true;
      if (watch) clearInterval(watch);
      // ★ 플레이어는 안 부숩니다. iframe 은 React 가 치우고,
      //   destroy() 는 그 iframe 을 직접 지우려 들어 서로 부딪힙니다
    };
  }, [stopAt]);

  const frame = (which: 0 | 1, ref: React.RefObject<HTMLIFrameElement | null>) => (
    <iframe
      ref={ref}
      title={which === 0 ? title : `${title} (교대)`}
      src={embedUrl(id)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        opacity: visible === which ? 1 : 0,
        transition: 'opacity 400ms ease',
      }}
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      tabIndex={-1}
    />
  );

  return (
    <span className={className} style={{ display: 'block' }}>
      {/*
        ★ 기다리는 동안 그림 대신 **이 영상의 섬네일**을 보여 줍니다
          (사용자 신고 2026-08-15 — "여전히 그린밀링화면 나온다").
          열자마자 영상이 있는 것처럼 보이고, 깨끗해지면 그 위로
          진짜 영상이 페이드되어 '멈춰 있다가 움직이기 시작' 으로 읽힙니다.

        ★ cover 로 자르면 딱 세로 영상 부분만 남습니다 — 계산이 아니라
          우연이 아닙니다. 섬네일(16:9)에서 세로 영상이 차지하는 가운데
          띠가 전체 폭의 31.6% 인데(픽셀로 잰 값: 1280 중 440~845),
          이 칸의 비율(9:16)로 cover 하면 보이는 폭이 정확히 31.6% 입니다.

        ★ 한 번 영상이 뜨면 다시 안 나옵니다. 교대는 영상끼리 합니다.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 유튜브 섬네일은 원격 최적화 대상이 아닙니다 */}
      <img
        src={`https://i.ytimg.com/vi/${id}/hq720.jpg`}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          opacity: visible === -1 ? 1 : 0,
          transition: 'opacity 400ms ease',
        }}
      />
      {frame(0, refA)}
      {frame(1, refB)}
    </span>
  );
}

/**
 * ★ 붙는 값 하나하나가 화면에서 뭔가를 지웁니다.
 *   `controls=0` 제목·채널 표시와 재생바 / `rel=0` 끝난 뒤 추천 영상 /
 *   `iv_load_policy=3` 카드·주석 / `fs=0` 전체화면 단추 /
 *   `enablejsapi=1` 이 있어야 교대와 되감기를 걸 수 있습니다
 *
 * ★ `origin` 은 일부러 안 붙였습니다. 그 값은 브라우저에서만 알 수
 *   있어서, 서버가 그린 주소와 브라우저가 그린 주소가 달라집니다.
 */
function embedUrl(id: string): string {
  const q = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    rel: '0',
    iv_load_policy: '3',
    disablekb: '1',
    fs: '0',
    playsinline: '1',
    enablejsapi: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
}

/** 스크립트는 한 번만 받습니다 */
let pending: Promise<YTNamespace> | null = null;

function loadPlayerApi(): Promise<YTNamespace> {
  if (pending) return pending;

  pending = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);

    // 다른 곳에서 이미 걸어 둔 것이 있으면 같이 부릅니다
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('YT 없음'));
    };

    const script = document.createElement('script');
    // ★ nocookie 쪽에는 이 파일이 없습니다 (404). 여기만 있습니다
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('스크립트를 못 받았습니다'));
    document.head.appendChild(script);
  });

  return pending;
}
