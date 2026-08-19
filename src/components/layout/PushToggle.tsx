// =========================================================
// 놓을 위치: src/components/layout/PushToggle.tsx
//
// PC 알림(웹푸시) 켬/끔. 종 안에 삽니다 — 소리 스위치 옆.
//
// ★ 계정이 아니라 **그 브라우저**의 설정입니다 (소리와 같은 결).
//   사무실 PC 에서는 켜고 집에서는 끌 수 있어야 합니다. 그래서 서버가
//   아니라 브라우저의 구독 상태를 물어봐서 그립니다.
//
// ★ 권한 요청은 **누른 순간에만** 합니다.
//   화면을 열자마자 "알림을 허용하시겠습니까" 가 뜨면 다들 차단을
//   누릅니다. 한 번 차단하면 코드로는 못 되돌립니다 — 그래서 차단
//   상태면 스위치 대신 푸는 방법을 알려 줍니다.
// =========================================================

'use client';

import { useEffect, useState } from 'react';
import { savePushSubscription, deletePushSubscription } from '@/server/actions/push';

type PushState =
  | 'loading'
  | 'unsupported' // 이 브라우저는 못 합니다
  | 'denied'      // 사용자가 브라우저에서 차단해 둠
  | 'off'
  | 'on';

export default function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (alive) setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (alive) setState('denied');
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (alive) setState(subscription ? 'on' : 'off');
    })().catch(() => {
      if (alive) setState('unsupported');
    });

    return () => {
      alive = false;
    };
  }, [vapidKey]);

  async function turnOn() {
    if (!vapidKey) return;
    setBusy(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js');
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      const json = subscription.toJSON();
      const result = await savePushSubscription({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
        },
      });

      if (!result.ok) {
        // 서버가 못 받았으면 브라우저 쪽도 되돌립니다 — 반쪽 구독을 안 남깁니다
        await subscription.unsubscribe();
        setState('off');
        return;
      }

      setState('on');
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setState('off');
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' || state === 'unsupported') return null;

  if (state === 'denied') {
    return (
      <span
        className="text-[13px] text-[#98A2B3]"
        title="브라우저가 알림을 차단하고 있습니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 다시 눌러 주세요."
      >
        PC 알림 차단됨
      </span>
    );
  }

  return (
    <button
      onClick={() => (state === 'on' ? turnOff() : turnOn())}
      disabled={busy}
      title={
        state === 'on'
          ? '탭을 안 보고 있어도 새 대화가 PC 알림으로 뜹니다'
          : '켜면 탭을 안 보고 있어도 새 대화가 PC 알림으로 뜹니다'
      }
      className="text-[13px] text-[#98A2B3] hover:text-[#4A5567] disabled:opacity-50"
    >
      PC 알림 {state === 'on' ? '켬' : '끔'}
    </button>
  );
}
