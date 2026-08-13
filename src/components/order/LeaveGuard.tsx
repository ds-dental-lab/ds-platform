// =========================================================
// 놓을 위치: src/components/order/LeaveGuard.tsx
//
// 작성 중인 주문을 두고 나가려 할 때 한 번 더 묻습니다.
//
// ★ Next 의 <Link> 는 가로챌 방법이 따로 없습니다.
//   그래서 문서 전체에서 클릭을 캡처 단계로 먼저 받아,
//   앱 안으로 가는 링크면 멈춰 세우고 물어봅니다.
//   캡처 단계라 Link 의 제 동작보다 먼저 잡힙니다.
//
// ★ 브라우저를 닫거나 새로고침하는 것은 beforeunload 가 맡습니다.
//   이쪽은 우리 문구를 못 씁니다 — 브라우저가 제 문구로 묻습니다.
//   막을 수 없는 부분이라 그대로 둡니다.
// =========================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface LeaveGuardProps {
  /** 지킬 것이 있는가. 빈 폼이면 묻지 않습니다 */
  dirty: boolean;
  title?: string;
  description?: string;
  /**
   * 지금 있는 주소를 다시 눌렀을 때. (사이드바에서 주문등록 재클릭)
   *
   * ★ 같은 주소는 리액트가 컴포넌트를 죽이지 않아 지난 입력이 남습니다.
   *   주면 '새로 작성' 을 묻고, 안 주면 그냥 무시합니다.
   */
  onStartOver?: () => void;
}

/** 나가려는 것인가, 이 자리에서 새로 시작하려는 것인가 */
type Ask = { kind: 'leave'; href: string } | { kind: 'restart' };

export default function LeaveGuard({
  dirty,
  title = '작성 중인 주문이 있습니다. 이동할까요?',
  description = '입력한 내용은 저장되지 않고 사라집니다.',
  onStartOver,
}: LeaveGuardProps) {
  const router = useRouter();

  /**
   * 지금 묻고 있는 것.
   *
   * ★ 빈 문자열 같은 값으로 뜻을 나누지 않습니다.
   *   'leave' 를 '' 로 표시했다가 `if (!target)` 에 걸려 창이 안 떴습니다.
   *   종류를 이름으로 적으면 그런 일이 안 생깁니다.
   */
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    if (!dirty) return;

    function onClick(event: MouseEvent) {
      // 새 탭으로 여는 클릭은 이 페이지를 떠나지 않습니다
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.target as HTMLElement | null)?.closest?.('a');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // 같은 자리를 다시 누른 경우 — 이동이 아니라 '새로 작성' 을 묻습니다
      if (url.pathname === window.location.pathname) {
        if (!onStartOver) return;
        event.preventDefault();
        event.stopPropagation();
        setAsk({ kind: 'restart' });
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setAsk({ kind: 'leave', href: url.pathname + url.search });
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty, onStartOver]);

  if (!ask) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[340px] overflow-hidden rounded-xl bg-white text-center shadow-xl">
        <div className="px-7 pb-6 pt-7">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FDF0E0]">
            <b className="text-[22px] font-extrabold leading-none text-[#E09A1B]">!</b>
          </span>

          <h3 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A2130]">
            {ask.kind === 'restart' ? '작성 중인 주문이 있습니다. 새로 시작할까요?' : title}
          </h3>
          <p className="mt-2 text-[13.5px] text-[#98A2B3]">{description}</p>
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => setAsk(null)}
            className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            취소
          </button>

          <button
            type="button"
            onClick={() => {
              const current = ask;
              setAsk(null);

              // 같은 자리면 이동하지 않고 폼만 새로 태웁니다
              if (current.kind === 'restart') {
                onStartOver?.();
                return;
              }

              // ★ dirty 를 끄고 나가는 것이 아니라 그냥 나갑니다.
              //   이 컴포넌트는 사라지고, beforeunload 도 함께 떨어집니다.
              router.push(current.href);
            }}
            className="h-11 flex-1 rounded-md bg-[#D8453F] text-[13.5px] font-bold text-white hover:bg-[#C13B36]"
          >
            {ask.kind === 'restart' ? '새로 작성' : '이동'}
          </button>
        </div>
      </div>
    </div>
  );
}
