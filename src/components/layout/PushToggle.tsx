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

/*
  ★ 이름을 받습니다 (2026-09-06). PC 종 안에서는 'PC 알림', 폰 홈에서는
    '폰 알림' — 같은 스위치인데 자리마다 사람이 부르는 말이 다릅니다.
*/
export default function PushToggle({
  vapidKey,
  label = 'PC 알림',
  explain = false,
}: {
  vapidKey: string | null;
  label?: string;
  /**
   * 이유를 **글자로** 보입니다 (사용자 지적 2026-09-07 — 폰에서 "눌러도
   * 아무 반응 없어"). PC 는 마우스를 올리면 title 이 뜨지만 폰에는 그게
   * 없어서, 차단돼 잠긴 스위치가 그냥 죽은 스위치로 보였습니다.
   * 못 켜는 폰(사파리 탭)에도 스위치 대신 무엇을 해야 하는지 적습니다.
   */
  explain?: boolean;
}) {
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

  if (state === 'loading') return null;

  if (state === 'unsupported') {
    if (!explain) return null;
    return (
      <span className="max-w-[230px] text-right text-[12px] leading-snug text-[#98A2B3]">
        이 브라우저에서는 못 켭니다. 아이폰은 사파리에서 <b className="font-bold">공유 → 홈 화면에 추가</b>
        로 설치한 앱을 열면 켤 수 있습니다.
      </span>
    );
  }

  /*
    ★ 스위치 모양입니다 (사용자 지적 2026-09-06 — "켠 상태인지 헷갈려").
      'PC 알림 끔' 이라는 글자는 "꺼져 있다" 와 "누르면 끈다" 로 둘 다
      읽혀서, 켜 놓고도 꺼진 줄 알거나 그 반대가 됩니다. 초록 손잡이가
      오른쪽에 붙어 있으면 누구나 켜짐으로 읽습니다.
  */
  if (state === 'denied') {
    const why = '브라우저가 알림을 차단하고 있습니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 다시 눌러 주세요.';
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <SwitchPill label={label} on={false} onToggle={() => undefined} disabled title={why} />
        {explain && (
          <span className="max-w-[230px] text-right text-[12px] leading-snug text-[#D8453F]">
            알림이 <b className="font-bold">차단</b>되어 있습니다. 안드로이드는 주소창 자물쇠 → 권한 → 알림 → 허용,
            설치한 앱이면 폰 설정 → 앱 → 덴플로우 → 알림 → 허용으로 바꾼 뒤 이 화면을 다시 여세요.
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={'inline-flex flex-col gap-0.5 ' + (explain ? 'items-end' : 'items-start')}>
      <SwitchPill
        label={label}
        on={state === 'on'}
        busy={busy}
        onToggle={() => (state === 'on' ? turnOff() : turnOn())}
        title={
          state === 'on'
            ? '이 기기를 안 보고 있어도 새 알림이 뜹니다'
            : '켜면 이 기기를 안 보고 있어도 새 알림이 뜹니다'
        }
      />
      {error && (
        <span
          className={
            'max-w-[230px] text-[11.5px] font-semibold leading-tight text-[#D8453F] ' + (explain ? 'text-right' : '')
          }
          title={error}
        >
          {error}
        </span>
      )}
      {/* ★ 폰에서는 켠 뒤에도 한 줄 — 켜졌다는 확인이 스위치 색 하나뿐이면 못 믿습니다 */}
      {explain && state === 'on' && !error && (
        <span className="text-[12px] text-[#0E9384]">이 폰으로 알림이 옵니다</span>
      )}
    </span>
  );
}
