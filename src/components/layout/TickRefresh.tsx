// =========================================================
// 놓을 위치: src/components/layout/TickRefresh.tsx
//
// 정해진 간격마다 화면을 다시 그립니다 — 기기 상태판처럼 '켜 두고 보는' 화면용 (2026-10-16).
// ★ AutoRefresh 는 주문·알림이 바뀌었을 때만 그립니다. 기기 상태는 거기에 안 걸립니다.
// ★ 안 보는 탭에서는 쉬고, 돌아오는 순간 한 번 그립니다.
// =========================================================

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TickRefresh({ everySec = 30 }: { everySec?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, everySec * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everySec, router]);
  return null;
}
