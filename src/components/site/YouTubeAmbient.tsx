// =========================================================
// 놓을 위치: src/components/site/YouTubeAmbient.tsx
//
// 소리 없이 배경처럼 도는 유튜브 영상. (사용자 요청 2026-08-14)
//
// ★ **`loop=1&playlist=<id>` 를 안 씁니다.** 유튜브가 반복을 걸려면
//   재생목록을 하나 만들라고 안내하는데, 그 순간 플레이어가 **재생목록
//   모드**가 되어 `controls=0` 을 무시하고 이전/일시정지/다음 단추 세
//   개를 화면 한가운데에 박아 둡니다. 마우스를 치워도 안 사라집니다.
//   (실제로 붙여 보고 확인했습니다 — 그 값을 빼니 바로 없어졌습니다)
//
// ★ 그래서 반복은 **플레이어 API 로** 겁니다. 끝나면 처음으로 되감고
//   다시 틉니다. 단추가 하나도 안 생깁니다.
//
// ★ API 가 안 실려도 영상은 나갑니다. 주소에 `autoplay` `mute` 가
//   그대로 있어서, 못 하는 것은 '반복' 하나뿐입니다.
//   붙는 것이 늘어날수록 하나가 죽으면 전부 죽는 구조가 되기 쉬운데,
//   여기서는 그렇게 안 됩니다.
//
// ★ **영상은 `youtube-nocookie.com`, 스크립트는 `youtube.com` 입니다.**
//   스크립트도 nocookie 쪽에서 받으려고 해 봤는데 그 주소는 **404**
//   입니다(직접 받아 확인했습니다). 거기엔 없습니다.
//   중요한 것은 영상 틀이고, 그건 nocookie 로 갑니다.
//
// ★ 눌리지 않습니다(`pointer-events-none`). 눌리면 유튜브가 제 화면을
//   덮어씁니다.
// =========================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { shouldRewind } from '@/server/domain/video';

interface YTPlayer {
  mute(): void;
  playVideo(): void;
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

/** 얼마나 자주 시각을 들여다보는가 */
const WATCH_MS = 250;

/**
 * 이만큼 흐른 뒤에야 영상을 보여 줍니다 (초).
 *
 * ★ 유튜브는 재생이 시작되는 찰나에 시동 화면(일시정지 물결·채널 표시)을
 *   띄웠다 거둡니다. 그게 걷히고 나서 나타나야 합니다 — 재생 시작
 *   '신호' 에 맞춰 보여 줬더니 번쩍임을 정통으로 보여 줬습니다.
 */
const REVEAL_AT = 1.2;

export default function YouTubeAmbient({
  id,
  className,
  title,
  stopAt,
}: {
  id: string;
  className?: string;
  title: string;
  /** 여기까지만 틀고 처음으로 돌아갑니다 (초). 없으면 끝까지 */
  stopAt?: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  /*
    ★ 실제로 흐르기 전까지는 영상을 **안 보여 줍니다** (사용자 요청
      2026-08-14 — "초반에 일시정지창 나타나는거 없애줘").

      영상이 뜨는 첫 몇 초 동안 유튜브가 제 것들을 띄웁니다 — 스피너,
      일시정지/재생 표시. controls=0 을 줘도 이 시동 화면은 안 꺼집니다.
      끌 수 없으면 그동안 안 보이게 하는 것이 답입니다. 이 조각 뒤에는
      직접 그린 밀링 장면이 늘 깔려 있어서, 숨겨도 빈 네모가 아닙니다.

    ★ 한 번 보이면 다시 안 숨깁니다. 되감기(seekTo)마다 버퍼링이
      끼는데, 그때마다 껐다 켜면 그게 더 큰 깜빡임입니다.

    ★ 끝내 재생이 안 되면(자동재생 차단·API 실패) 영상은 영영 안 보이고
      그린 장면이 그대로 남습니다 — 눌러도 반응 없는 멈춘 유튜브
      화면보다 낫습니다. 이 조각은 pointer-events 가 없어서 사람이
      재생 단추를 눌러 줄 수도 없기 때문입니다.
  */
  const [flowing, setFlowing] = useState(false);

  useEffect(() => {
    /*
      ★★ 여기에 `한 번만 만들기` 표시를 두면 **아무것도 안 만들어집니다.**
        실제로 그렇게 짰다가 되감기가 통째로 죽었습니다(2026-08-14).

        개발 중에는 React 가 효과를 두 번 돌립니다.
          1회차 실행 → 표시를 켜고 통신 시작
          1회차 정리 → cancelled = true
          2회차 실행 → 표시가 이미 켜져 있어 **그냥 나감**
          1회차 통신 도착 → cancelled 가 true 라 **그냥 나감**
        둘 다 나가 버려서 플레이어가 없습니다.

        `cancelled` 하나로 충분합니다. 정리와 실행이 한 묶음으로
        돌기 때문에, 1회차 것은 버려지고 2회차 것만 남습니다 —
        **정확히 하나**입니다.

      ★ 운영에서는 효과가 한 번만 돌아서 이 실수가 안 드러납니다.
        개발에서만 죽는 종류라 더 오래 못 찾습니다.
    */
    let cancelled = false;
    let watch: ReturnType<typeof setInterval> | undefined;

    loadPlayerApi()
      .then((YT) => {
        if (cancelled || !ref.current) return;
        const player = new YT.Player(ref.current, {
          events: {
            onReady(e) {
              e.target.mute();
              e.target.playVideo();
            },
            onStateChange(e) {
              // 20초보다 짧은 영상이면 여기로 옵니다
              if (e.data !== ENDED) return;
              e.target.seekTo(0, true);
              e.target.playVideo();
            },
          },
        });

        /*
          ★★ '재생 시작' 신호로 보여 주면 **번쩍임을 정통으로 보여 줍니다**
            (사용자 신고 2026-08-14 — "여전히 일시정지 아이콘 나오고").

            유튜브는 재생이 시작되는 바로 그 찰나에 제 시동 화면
            (일시정지 물결·채널 표시)을 띄웠다 거둡니다. PLAYING 신호에
            맞춰 커튼을 걷었더니 정확히 그 번쩍임이 보였습니다.
            실제로 겪고 바꿨습니다.

            그래서 신호가 아니라 **실제 재생 시각**을 봅니다 — 1.2초를
            지나면 시동 화면이 다 걷힌 뒤입니다. 그때 나타납니다.
            영상 첫 1.2초를 못 보여 주는 값이지만, 배경 영상에서 그건
            아무도 아쉬워하지 않습니다.

          ★ 이 시계는 되감기도 함께 봅니다.
            `end=20` 을 안 쓰는 이유: 유튜브가 그 지점에서 정말로 멈추고,
            멈추는 순간 끝 화면이 스칩니다. 흐르는 중에 자리만 옮기면
            이어 붙은 것처럼 보입니다.

          ★ getCurrentTime 이 가끔 던집니다 — 플레이어가 아직 준비되지
            않았을 때입니다. 그때는 그냥 넘깁니다. 여기서 터지면
            되감기와 나타나기가 같이 멎습니다.
        */
        let revealed = false;

        watch = setInterval(() => {
          try {
            const t = player.getCurrentTime();

            if (!revealed && Number.isFinite(t) && t >= REVEAL_AT) {
              revealed = true;
              if (!cancelled) setFlowing(true);
            }

            if (stopAt && shouldRewind(t, stopAt)) player.seekTo(0, true);
          } catch {
            /* 다음 차례에 다시 봅니다 */
          }
        }, WATCH_MS);
      })
      .catch(() => {
        // 반복만 못 겁니다. 영상은 주소에 걸어 둔 대로 이미 돌고 있습니다
      });

    return () => {
      cancelled = true;
      if (watch) clearInterval(watch);
      // ★ 플레이어는 안 부숩니다. iframe 은 React 가 치우고,
      //   destroy() 는 그 iframe 을 직접 지우려 들어 서로 부딪힙니다
    };
  }, [stopAt]);

  return (
    <iframe
      ref={ref}
      title={title}
      className={className}
      src={embedUrl(id)}
      // 흐르기 전에는 투명 — 유튜브의 시동 화면(스피너·일시정지)이 안 보입니다
      style={{ opacity: flowing ? 1 : 0, transition: 'opacity 400ms ease' }}
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      tabIndex={-1}
    />
  );
}

/**
 * ★ 붙는 값 하나하나가 화면에서 뭔가를 지웁니다.
 *   `controls=0` 제목·채널 표시와 재생바 / `rel=0` 끝난 뒤 추천 영상 /
 *   `iv_load_policy=3` 카드·주석 / `fs=0` 전체화면 단추 /
 *   `enablejsapi=1` 이 있어야 위에서 되감기를 걸 수 있습니다
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
