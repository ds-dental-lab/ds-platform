// =========================================================
// 놓을 위치: src/components/site/YouTubeAmbient.tsx
//
// 소리 없이 배경처럼 도는 유튜브 영상. (사용자 요청 2026-08-14)
//
// ★★ **플레이어 두 대를 겹쳐 놓고 번갈아 씁니다.**
//   유튜브는 시작할 때·되감을 때·멈출 때 제 UI(일시정지 물결·큰 단추)를
//   얹는데 설정으로는 하나도 못 끕니다. 화면에는 항상 '깨끗하게 흐르는
//   중'인 쪽만 보이고, 그 순간들은 전부 숨은 쪽에서 일어나게 합니다.
//
//   한 바퀴 (stopAt=20 기준):
//     A 흐름 → 14.5초(= 20 − CLEAN − 1)에 B 를 몰래 틂 →
//     B 가 깨끗해지는 순간 A 는 딱 20초 근처 → A→B 스르륵 교대 →
//     A 는 숨어서 멈추고 처음으로 → (반복)
//
// ★★ 유튜브 **공식 래퍼(YT.Player)를 안 씁니다** (2026-08-15).
//   두 대 중 **둘째 것의 래퍼가 조용히 반쪽으로 죽는** 사고를 두 번
//   겪었습니다 — iframe 에 붙이는 방식도, div 에 만들게 하는 방식도
//   같았습니다. 위젯 자체는 멀쩡히 돌고 시각도 보내오는데(그걸로
//   재서 잡았습니다) 래퍼의 메서드만 죽어서, 교대가 영영 안 일어나고
//   A 가 영상 끝(채널 문구 아웃트로)까지 화면에 보였습니다.
//
//   그래서 래퍼가 속으로 쓰는 **postMessage 를 직접** 씁니다.
//     듣기: 'listening' 을 보내면 위젯이 시각·상태(infoDelivery)를 보내옴
//     시키기: {event:'command', func:'playVideo'} 꼴로 보냄
//   측정에 쓴 바로 그 통로라 동작이 증명돼 있고, youtube.com 스크립트를
//   받을 필요도 없어집니다.
//
// ★ 교대는 stopAt 보다 **미리** 겁니다. stopAt 에서 걸면 대기조가
//   깨끗해지는 동안 옛 쪽이 stopAt+5초까지 화면에 보입니다 — 이 영상
//   뒷부분에 박힌 채널 문구가 그때 스쳤습니다 (사용자 신고).
//
// ★ 기다리는 동안은 이 영상의 **섬네일**이 깔립니다. 열자마자 영상이
//   있는 것처럼 보이고, 깨끗해지면 그 위로 진짜 영상이 페이드됩니다.
//
// ★ `loop=1&playlist=` 는 안 씁니다 — 재생목록 모드가 되어 한가운데
//   단추 셋이 박힙니다 (실측). 눌리지도 않습니다(pointer-events 상속).
// =========================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { shouldRewind } from '@/server/domain/video';

/** 위젯이 보내오는 상태값 */
const ENDED = 0;
const PAUSED = 2;

/** 얼마나 자주 들여다보는가 */
const WATCH_MS = 250;

/**
 * 재생 시작 후 이만큼 흘러야 '깨끗하다' 고 봅니다 (초).
 * 유튜브 시동 화면이 걷히는 데 약 3초 — 환경마다 달라 여유를 뒀습니다.
 */
const CLEAN = 4.5;

/** 교대 페이드가 끝난 뒤에야 옛 쪽을 멈춥니다 (ms) */
const AFTER_FADE_MS = 600;

const ORIGIN = 'https://www.youtube-nocookie.com';

export default function YouTubeAmbient({
  id,
  className,
  title,
  stopAt,
}: {
  id: string;
  className?: string;
  title: string;
  /** 화면에 이 시각 넘는 장면이 안 보이게 합니다 (초). 없으면 끝까지 */
  stopAt?: number;
}) {
  const refA = useRef<HTMLIFrameElement>(null);
  const refB = useRef<HTMLIFrameElement>(null);

  /** 지금 보이는 쪽. -1 이면 아직 아무도 (섬네일이 보입니다) */
  const [visible, setVisible] = useState(-1);

  useEffect(() => {
    /*
      ★★ 여기에 `한 번만 만들기` 표시를 두면 아무것도 안 돕니다.
        실제로 그렇게 짰다가 죽었습니다(2026-08-14) — 개발 중에는 효과가
        두 번 도는데 표시와 cancelled 가 서로를 막습니다. cancelled
        하나면 1회차는 버려지고 2회차만 남아 정확히 하나가 됩니다.
    */
    let cancelled = false;

    const frames = [refA.current, refB.current];
    if (!frames[0] || !frames[1]) return;

    /** 위젯이 보내온 마지막 시각·상태 */
    const last = [
      { t: Number.NaN, state: -9 },
      { t: Number.NaN, state: -9 },
    ];

    /** 우리가 시킨 멈춤인가 — 아니면 되살립니다 */
    const intendedPause = [false, true];

    const cmd = (idx: number, func: string, args: unknown[] = []) => {
      frames[idx]?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        ORIGIN,
      );
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== ORIGIN) return;

      let data: { event?: string; info?: { currentTime?: number; playerState?: number } };
      try {
        data = JSON.parse(e.data as string);
      } catch {
        return;
      }
      if (!data.info) return;

      const idx = frames.findIndex((f) => f?.contentWindow === e.source);
      if (idx < 0) return;

      if (typeof data.info.currentTime === 'number') last[idx].t = data.info.currentTime;

      if (typeof data.info.playerState === 'number') {
        last[idx].state = data.info.playerState;

        // 시키지 않은 멈춤이면 되살립니다 (절전·백그라운드가 멈춥니다)
        if (data.info.playerState === PAUSED && !intendedPause[idx]) cmd(idx, 'playVideo');

        // 영상이 stopAt 보다 짧으면 여기로 옵니다. 이 다시 시작은 화면에
        // 보일 수 있습니다 — stopAt 을 영상보다 짧게 두는 것이 전제입니다
        if (data.info.playerState === ENDED) {
          cmd(idx, 'seekTo', [0, true]);
          cmd(idx, 'playVideo');
        }
      }
    };

    window.addEventListener('message', onMessage);

    /*
      ★ 'listening' 은 계속 보냅니다 (500ms).
        위젯이 언제 뜰지 몰라 한 번만 보내면 놓칩니다. 응답을 받은 뒤에도
        보내는 것은 낭비지만 초당 두 통이라 셈할 것이 못 되고,
        '언제부터 안 듣고 있었나' 같은 상태를 하나 줄여 줍니다.
    */
    const hello = setInterval(() => {
      for (const f of frames) {
        f?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), ORIGIN);
      }
      cmd(0, 'mute');
      cmd(1, 'mute');
    }, 500);

    /*
      ★ 상태는 넷뿐이고 한 방향으로만 돕니다.
        first   첫 판이 깨끗해지기를 기다림 (화면엔 섬네일)
        solo    한쪽만 흐르는 중
        warming 교대 때가 되어 대기조를 몰래 틀어 둠
        cooling 교대 페이드 중 — 끝나면 옛 쪽을 숨어서 정리
    */
    let active = 0;
    let phase: 'first' | 'solo' | 'warming' | 'cooling' = 'first';
    let fadeStartedAt = 0;

    const warmAt = stopAt ? Math.max(stopAt - CLEAN - 1, 1) : 0;

    const watch = setInterval(() => {
      const t = last[active].t;

      if (phase === 'first' && Number.isFinite(t) && t >= CLEAN) {
        if (!cancelled) setVisible(active);
        phase = 'solo';
      }

      if (phase === 'solo' && shouldRewind(t, warmAt)) {
        intendedPause[1 - active] = false;
        cmd(1 - active, 'mute');
        cmd(1 - active, 'playVideo');
        phase = 'warming';
      }

      if (phase === 'warming') {
        const ts = last[1 - active].t;
        if (Number.isFinite(ts) && ts >= CLEAN) {
          if (!cancelled) setVisible(1 - active);
          phase = 'cooling';
          fadeStartedAt = Date.now();
        }
      }

      if (phase === 'cooling' && Date.now() - fadeStartedAt > AFTER_FADE_MS) {
        // 이제 아무도 안 봅니다 — 숨어서 정리하고 다음 차례를 기다립니다
        intendedPause[active] = true;
        cmd(active, 'pauseVideo');
        cmd(active, 'seekTo', [0, true]);
        /*
          ★ 기억해 둔 시각도 0 으로 되돌립니다. 멈춘 위젯은 시각을 안
            보내오므로, 안 되돌리면 다음 교대 때 옛 시각(20초쯤)이
            그대로 남아 '이미 깨끗하다' 로 잘못 읽혀 **즉시 교대**됩니다.
        */
        last[active].t = 0;
        active = 1 - active;
        phase = 'solo';
      }
    }, WATCH_MS);

    return () => {
      cancelled = true;
      clearInterval(watch);
      clearInterval(hello);
      window.removeEventListener('message', onMessage);
    };
  }, [id, stopAt]);

  const frame = (which: 0 | 1, ref: React.RefObject<HTMLIFrameElement | null>) => (
    <iframe
      ref={ref}
      title={which === 0 ? title : `${title} (교대)`}
      src={embedUrl(id, which === 0)}
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
        ★ 기다리는 동안 이 영상의 섬네일을 보여 줍니다.
          cover 로 자르면 딱 세로 영상 부분만 남습니다 — 섬네일(16:9)에서
          세로 영상 띠가 폭의 31.6%(1280 중 440~845, 픽셀로 잰 값)인데,
          이 칸(9:16)으로 cover 하면 보이는 폭이 정확히 31.6% 입니다.
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
 *   `enablejsapi=1` 이 있어야 postMessage 를 듣습니다
 *
 * ★ 대기조(둘째)는 autoplay 없이 태어납니다 — 태어나자마자 멈춰
 *   세우는 춤이 필요 없고, 교대 신호가 올 때 처음 틉니다.
 */
function embedUrl(id: string, autoplay: boolean): string {
  const q = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: '1',
    controls: '0',
    rel: '0',
    iv_load_policy: '3',
    disablekb: '1',
    fs: '0',
    playsinline: '1',
    enablejsapi: '1',
  });
  return `${ORIGIN}/embed/${id}?${q}`;
}
