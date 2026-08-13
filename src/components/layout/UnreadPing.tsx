// =========================================================
// 놓을 위치: src/components/layout/UnreadPing.tsx
//
// 안 읽은 알림을 **탭 제목**과 **소리**로 알립니다.
// (사용자 결정 2026-08-13 — 카톡 대신 먼저 해 보는 가장 싼 방법)
//
// ★ 왜 이것부터인가.
//   센터는 이 앱을 하루 종일 켜 둡니다. 그렇다면 창을 다른 탭으로
//   넘겨 놨을 때 **탭 제목이 (1) 로 바뀌고 소리가 한 번 나는 것**만으로
//   "지금 봐주세요" 의 대부분이 전달됩니다. 서비스워커도 도메인도
//   권한 팝업도 필요 없습니다.
//
// ★ 소리 파일을 안 씁니다.
//   짧은 두 음을 그 자리에서 만듭니다(WebAudio). 파일을 받아 넣으면
//   저작권을 확인해야 하고, 용량도 늡니다. 알림음은 그럴 값어치가
//   없습니다.
//
// ★ 소리는 끌 수 있어야 합니다.
//   못 끄는 소리는 결국 스피커를 끄게 만들고, 그러면 정작 필요한 때
//   못 듣습니다. 종 안에 스위치를 뒀고 여기서는 그 값을 읽습니다.
// =========================================================

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { titleWithUnread, shouldPing } from '@/server/domain/ping';

/*
  소리를 낼지 말지. 브라우저에 남습니다 — 계정이 아니라 **그 자리**의
  설정입니다. 같은 사람이 사무실 PC 에서는 켜 두고 집에서는 꺼 둘 수
  있어야 합니다.

  ★ 서버에는 localStorage 가 없습니다.
    첫 그림은 '켬' 으로 그리고, 화면에 붙은 뒤 실제 값으로 맞춥니다.
    useSyncExternalStore 가 그 두 값을 갈라 받습니다 — 직접 맞추려고
    하면 서버와 첫 그림이 어긋나 경고가 납니다.
*/
const PING_SOUND_KEY = 'ds-flow-ping-sound';

const listeners = new Set<() => void>();

export function isPingSoundOn(): boolean {
  return window.localStorage.getItem(PING_SOUND_KEY) !== 'off';
}

/** 서버에서 그릴 때의 값 */
export function pingSoundDefault(): boolean {
  return true;
}

export function setPingSound(on: boolean): void {
  window.localStorage.setItem(PING_SOUND_KEY, on ? 'on' : 'off');
  for (const listener of listeners) listener();
}

export function subscribePingSound(onChange: () => void): () => void {
  listeners.add(onChange);
  // 다른 탭에서 끄면 이 탭도 따라갑니다
  window.addEventListener('storage', onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export interface UnreadPingProps {
  unreadCount: number;
}

export default function UnreadPing({ unreadCount }: UnreadPingProps) {
  const pathname = usePathname();
  const before = useRef<number | null>(null);

  /*
    ★ 화면을 옮기면 Next 가 제목을 다시 씁니다.
      그래서 pathname 도 의존성에 넣어, 옮긴 뒤에 한 번 더 붙입니다.
      안 그러면 다른 메뉴로 가는 순간 (2) 가 사라집니다.
  */
  useEffect(() => {
    document.title = titleWithUnread(document.title, unreadCount);
  }, [unreadCount, pathname]);

  useEffect(() => {
    if (shouldPing(before.current, unreadCount) && isPingSoundOn()) {
      void beep();
    }
    before.current = unreadCount;
  }, [unreadCount]);

  return null;
}

/**
 * 짧은 두 음.
 *
 * ★ 실패해도 조용히 넘어갑니다.
 *   브라우저는 사람이 한 번도 안 누른 페이지에서 소리를 막습니다.
 *   막혔다고 화면에 무언가 띄우면, 소리가 필요 없는 사람에게
 *   쓸데없는 말을 거는 셈입니다. 제목은 어차피 바뀝니다.
 */
async function beep(): Promise<void> {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    if (ctx.state === 'suspended') await ctx.resume();

    const now = ctx.currentTime;

    // 도 → 솔. 짧고 부드럽게, 사무실에서 튀지 않을 만큼만
    play(ctx, 880, now, 0.09);
    play(ctx, 1174, now + 0.1, 0.12);

    // 다 울리면 정리합니다 — 안 닫으면 탭마다 오디오가 쌓입니다
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    /* 소리는 덤입니다 */
  }
}

function play(ctx: AudioContext, hz: number, at: number, length: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = hz;

  // 뚝 끊으면 '틱' 하는 잡음이 납니다. 서서히 줄입니다
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.18, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}
