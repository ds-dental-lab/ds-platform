// =========================================================
// 놓을 위치: src/components/layout/PushToggle.tsx
//
// 웹푸시 켬/끔. 두 얼굴이 있습니다 —
//   PushToggle  PC 종 안의 작은 스위치 (소리 스위치 옆)
//   PushCard    폰 홈의 카드 (종 아이콘 · 제목 · 무엇이 오는지 · 스위치)
// 둘은 같은 usePush 를 쓰므로 켜고 끄는 규칙이 한 벌입니다.
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

function usePush(vapidKey: string | null) {
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

  const toggle = () => (state === 'on' ? turnOff() : turnOn());

  return { state, busy, error, toggle };
}

const DENIED_HINT = '브라우저가 알림을 차단하고 있습니다. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 다시 눌러 주세요.';

// ---------- PC 종 안의 작은 스위치 ----------

export default function PushToggle({
  vapidKey,
  label = 'PC 알림',
}: {
  vapidKey: string | null;
  label?: string;
}) {
  const { state, busy, error, toggle } = usePush(vapidKey);

  if (state === 'loading' || state === 'unsupported') return null;

  /*
    ★ 스위치 모양입니다 (사용자 지적 2026-09-06 — "켠 상태인지 헷갈려").
      'PC 알림 끔' 이라는 글자는 "꺼져 있다" 와 "누르면 끈다" 로 둘 다
      읽혀서, 켜 놓고도 꺼진 줄 알거나 그 반대가 됩니다. 초록 손잡이가
      오른쪽에 붙어 있으면 누구나 켜짐으로 읽습니다.
  */
  if (state === 'denied') {
    return <SwitchPill label={label} on={false} onToggle={() => undefined} disabled title={DENIED_HINT} />;
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <SwitchPill
        label={label}
        on={state === 'on'}
        busy={busy}
        onToggle={toggle}
        title={
          state === 'on'
            ? '이 기기를 안 보고 있어도 새 알림이 뜹니다'
            : '켜면 이 기기를 안 보고 있어도 새 알림이 뜹니다'
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

// ---------- 폰 홈 머리줄의 종 ----------

/**
 * 폰 홈 오른쪽 위의 종. (사용자 지적 2026-09-07 — "너무 복잡해 보여")
 *
 * ★ 알림 카드를 홈 본문에서 뺐습니다. 촬영·전화 응대하러 들어온 화면에
 *   설정 카드가 서 있으면 매번 눈이 걸립니다. 종 하나만 두고 누르면
 *   그 카드가 머리줄 아래로 펼쳐집니다.
 * ★ 색이 상태입니다 — 켜짐은 초록, 꺼짐·차단·못 켬은 회색에 빨간 점.
 *   빨간 점이 "아직 안 켰다" 를 말하므로 글자가 필요 없습니다.
 */
export function PushBell({ vapidKey, description }: { vapidKey: string | null; description: string }) {
  const { state } = usePush(vapidKey);
  const [open, setOpen] = useState(false);

  if (state === 'loading') return null;
  const on = state === 'on';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={on ? '알림 켜짐' : '알림 설정'}
        aria-expanded={open}
        className={
          'relative grid h-9 w-9 place-items-center rounded-full border transition-colors ' +
          (on
            ? 'border-[var(--mist)] bg-[var(--mist)] text-[#0E9384]'
            : 'border-[var(--line)] bg-white text-[var(--muted)]') +
          (open ? ' ring-2 ring-[var(--teal)]/40' : '')
        }
      >
        <BellIcon />
        {!on && <span className="absolute right-[7px] top-[7px] h-2 w-2 rounded-full bg-[#D8453F]" aria-hidden="true" />}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20">
          <PushCard vapidKey={vapidKey} description={description} className="mt-2 border border-[var(--line)] shadow-[0_8px_24px_rgba(22,50,79,0.12)]" />
        </div>
      )}
    </>
  );
}

// ---------- 폰 홈의 카드 ----------

/**
 * 폰 홈에 서는 알림 카드. (사용자 지적 2026-09-07 — "멘트가 연계성이
 * 떨어진다, 이쁘게 구성해 줘")
 *
 * ★ 한 카드에 한 문장입니다 — 제목 '알림 받기', 그 아래 **무엇이 오는지**
 *   (치과: 센터의 답과 도착 안내 / 센터: 치과의 대화와 신청), 오른쪽에
 *   스위치. 켜지면 그 줄이 "켜져 있습니다" 로 바뀝니다.
 * ★ 못 켜는 상태(차단·앱 안 브라우저)는 스위치 대신 카드 아래에 **할 일**을
 *   적습니다. 폰에는 마우스 올림이 없어 title 로는 아무것도 못 전합니다.
 */
export function PushCard({
  vapidKey,
  description,
  className = 'mt-4',
}: {
  vapidKey: string | null;
  /** 켜면 무엇이 오는가 — 한 줄 */
  description: string;
  className?: string;
}) {
  const { state, busy, error, toggle } = usePush(vapidKey);

  const on = state === 'on';
  const canToggle = state === 'on' || state === 'off';

  const line = on ? '켜져 있습니다 · 이 폰으로 알림이 옵니다' : description;

  return (
    <section className={className + ' rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(22,50,79,0.06)]'}>
      <div className="flex items-center gap-3">
        <span
          className={
            'grid h-10 w-10 shrink-0 place-items-center rounded-full ' +
            (on ? 'bg-[var(--mist)] text-[#0E9384]' : 'bg-[#F1F5F9] text-[var(--muted)]')
          }
          aria-hidden="true"
        >
          <BellIcon />
        </span>

        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px] font-bold text-[var(--ink)]">알림 받기</b>
          <span className={'mt-0.5 block text-[12.5px] leading-snug ' + (on ? 'text-[#0E9384]' : 'text-[var(--muted)]')}>
            {line}
          </span>
        </span>

        {canToggle && (
          <SwitchPill label="" size="lg" on={on} busy={busy} onToggle={toggle} title={on ? '끄기' : '켜기'} />
        )}
        {state === 'denied' && (
          <SwitchPill label="" size="lg" on={false} onToggle={() => undefined} disabled title={DENIED_HINT} />
        )}
      </div>

      {error && <p className="mt-2.5 text-[12.5px] font-semibold leading-snug text-[#D8453F]">{error}</p>}

      {state === 'denied' && (
        <p className="mt-2.5 border-t border-[var(--line)] pt-2.5 text-[12.5px] leading-snug text-[#D8453F]">
          이 브라우저가 알림을 <b className="font-bold">차단</b>하고 있습니다. 주소창 자물쇠 → 권한 → 알림 → 허용
          (설치한 앱이면 폰 설정 → 앱 → 덴플로우 → 알림)으로 바꾼 뒤 이 화면을 다시 여세요.
        </p>
      )}

      {state === 'unsupported' && <UnsupportedHint />}
    </section>
  );
}

/**
 * 못 켜는 브라우저일 때의 안내.
 *
 * ★ 어느 폰인지에 따라 다른 말을 합니다 (사용자 스크린샷 2026-09-07 —
 *   갤럭시인데 아이폰 안내가 떴음). 갤럭시에서 못 켜는 건 거의 다
 *   **네이버·카톡 앱 안의 브라우저**로 열었을 때입니다.
 * ★ 안드로이드는 **누르면 크롬이 바로 뜨는 단추**를 답니다 (사용자 요청
 *   2026-09-07 — "네이버도 되게는 못해?"). intent 주소는 안드로이드가
 *   "이 주소를 크롬으로 열어라" 로 알아듣는 형식입니다 — 크롬이 없으면
 *   스토어로 갑니다. 아이폰은 그런 길이 없어 글로만 안내합니다.
 */
function UnsupportedHint() {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const here = window.location.pathname + window.location.search;
  const chromeIntent = `intent://denflow.kr${here}#Intent;scheme=https;package=com.android.chrome;end`;

  if (ios) {
    return (
      <p className="mt-2.5 border-t border-[var(--line)] pt-2.5 text-[12.5px] leading-snug text-[var(--muted)]">
        사파리에서 <b className="font-bold text-[var(--ink)]">공유 → 홈 화면에 추가</b>로 설치한 앱을 열면 켤 수 있습니다.
      </p>
    );
  }

  return (
    <div className="mt-2.5 flex items-center gap-3 border-t border-[var(--line)] pt-2.5">
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--muted)]">
        네이버·카톡 안에서는 못 켭니다. 크롬에서 켜고 <b className="font-bold text-[var(--ink)]">홈 화면에 추가</b>로
        설치하면 앱처럼 씁니다.
      </p>
      <a
        href={chromeIntent}
        className="shrink-0 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[13px] font-bold text-white active:opacity-90"
      >
        크롬으로 열기
      </a>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}
