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
import SwitchPill from '@/components/layout/SwitchPill';

type PushState =
  | 'loading'
  | 'unsupported' // 이 브라우저는 못 합니다
  | 'denied'      // 사용자가 브라우저에서 차단해 둠
  | 'off'
  | 'on';

export default function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  /*
    ★ 왜 못 켰는지를 **말합니다** (2026-09-06). 전에는 실패하면 조용히
      '끔' 으로 되돌아갔습니다 — 사장님이 켰다고 하셨는데 서버에는
      기기가 0개였고, 화면은 아무 말도 안 했습니다. 눌렀는데 아무 일도
      안 일어난 것처럼 보이면 사람은 "됐나 보다" 하고 갑니다.
  */
  const [error, setError] = useState('');

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
    setError('');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        // ★ 창을 그냥 닫으면 'default' 로 돌아옵니다 — 허용을 안 누른 것입니다
        if (permission !== 'denied') setError('브라우저 창에서 "허용" 을 눌러야 켜집니다');
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
        setError(result.error);
        return;
      }

      setState('on');
    } catch (e) {
      setState('off');
      /*
        ★ 브라우저가 뱉은 말을 그대로 붙입니다. 흔한 것 —
          applicationServerKey 형식이 틀림(열쇠 값에 공백·줄바꿈),
          서비스워커 등록 실패(https 아님), 푸시 서비스 연결 실패.
          "못 켰습니다" 만으로는 어느 쪽인지 알 수 없습니다.
      */
      setError(`켜지 못했습니다: ${(e as Error)?.message ?? '알 수 없는 오류'}`);
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

  /*
    ★ 스위치 모양입니다 (사용자 지적 2026-09-06 — "켠 상태인지 헷갈려").
      'PC 알림 끔' 이라는 글자는 "꺼져 있다" 와 "누르면 끈다" 로 둘 다
      읽혀서, 켜 놓고도 꺼진 줄 알거나 그 반대가 됩니다. 초록 손잡이가
      오른쪽에 붙어 있으면 누구나 켜짐으로 읽습니다.
  */
  if (state === 'denied') {
    return (
      <SwitchPill
        label="PC 알림"
        on={false}
        onToggle={() => undefined}
        disabled
        title="브라우저가 알림을 차단하고 있습니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 다시 눌러 주세요."
      />
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <SwitchPill
        label="PC 알림"
        on={state === 'on'}
        busy={busy}
        onToggle={() => (state === 'on' ? turnOff() : turnOn())}
        title={
          state === 'on'
            ? '탭을 안 보고 있어도 새 알림이 PC 오른쪽 아래에 뜹니다'
            : '켜면 탭을 안 보고 있어도 새 알림이 PC 오른쪽 아래에 뜹니다'
        }
      />
      {error && (
        <span className="max-w-[220px] text-[11.5px] font-semibold leading-tight text-[#D8453F]" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
