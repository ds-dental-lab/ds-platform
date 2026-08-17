// =========================================================
// 놓을 위치: src/components/site/ChannelTalk.tsx
//
// 채널톡 상담 버튼 (오른쪽 아래). (사용자 요청 2026-08-15)
//
// ★ **회사 홈페이지에만 답니다.** 로그인해서 쓰는 플랫폼 화면에는
//   안 붙습니다. 거래처는 이미 주문마다 대화 칸이 있고, 그게 그 건에
//   붙어서 기록으로 남습니다. 채널톡을 거기까지 띄우면 같은 이야기가
//   두 곳으로 갈라져서, 나중에 "그 얘기 어디서 했더라" 가 됩니다.
//   여기 오는 사람은 **아직 거래처가 아닌 분**입니다.
//
// ★ 키가 없으면 **아무것도 안 합니다.** 스크립트도 안 받습니다.
//   키를 못 받은 채로 붙여 두면 홈페이지마다 남의 서버를 부르고
//   콘솔에 오류만 쌓입니다.
//
// ★ 스크립트를 **한 번만** 받습니다. 이 조각이 다시 그려져도
//   두 번 부르지 않습니다 — 두 번 부르면 버튼이 둘 생깁니다.
//
// ★ 개인정보를 안 넘깁니다. 로그인한 사람 정보를 채널톡에 태우는
//   기능(member 연동)이 있지만 안 씁니다 — 여기는 로그인 안 한
//   화면이고, 넘길 것도 넘길 이유도 없습니다.
// =========================================================

'use client';

import { useEffect } from 'react';

/** 채널톡이 window 에 심는 것들 — 우리가 쓰는 것만 적습니다 */
interface ChannelIO {
  (...args: unknown[]): void;
  q?: unknown[][];
  c?: (args: unknown) => void;
}

declare global {
  interface Window {
    ChannelIO?: ChannelIO;
    ChannelIOInitialized?: boolean;
  }
}

export default function ChannelTalk({ pluginKey }: { pluginKey: string }) {
  useEffect(() => {
    if (!pluginKey) return;
    if (window.ChannelIOInitialized) {
      window.ChannelIO?.('boot', { pluginKey });
      return;
    }

    /*
      ★ 채널톡이 안내하는 대기열 방식입니다.
        스크립트가 늦게 와도 그동안의 호출을 쌓아 두었다가 이어서
        처리합니다 — 안 그러면 스크립트가 오기 전 호출이 사라집니다.
    */
    const ch: ChannelIO = function (...args: unknown[]) {
      ch.c?.(args);
    };
    ch.q = [];
    ch.c = (args) => {
      ch.q?.push(args as unknown[]);
    };
    window.ChannelIO = ch;
    window.ChannelIOInitialized = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
    script.onload = () => window.ChannelIO?.('boot', { pluginKey });
    script.onerror = () => {
      // 못 받으면 버튼이 안 뜰 뿐입니다. 홈페이지는 그대로 돕니다
      window.ChannelIOInitialized = false;
    };
    document.head.appendChild(script);

    /*
      ★ 화면을 떠나면 버튼을 거둡니다(`shutdown`). 스크립트는 그대로
        두고 붙은 것만 뗍니다 — 로그인해서 플랫폼으로 들어갔는데
        상담 버튼이 따라다니면 안 됩니다.
    */
    return () => {
      window.ChannelIO?.('shutdown');
    };
  }, [pluginKey]);

  return null;
}
