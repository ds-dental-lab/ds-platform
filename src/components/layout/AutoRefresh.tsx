// =========================================================
// 놓을 위치: src/components/layout/AutoRefresh.tsx
//
// 새로고침을 안 눌러도 화면이 따라옵니다. (사용자 요청 2026-08-13)
//
// ★ 화면을 주기적으로 새로 그리는 것이 아닙니다.
//   가벼운 자국(actions/pulse)만 물어보고, **달라졌을 때만**
//   router.refresh() 를 부릅니다. 안 달라졌으면 아무 일도 없습니다 —
//   화면이 깜빡이지 않고, 스크롤도 입력 중인 글자도 그대로입니다.
//
// ★ 안 보고 있는 탭에서는 묻지 않습니다.
//   창을 열어 둔 채 퇴근한 브라우저가 밤새 서버를 두드리면 안 됩니다.
//   대신 **돌아오는 순간** 한 번 묻습니다. 자리를 비웠다 온 사람에게는
//   그게 제일 중요한 순간입니다.
//
// ★ 저장 중인 것을 덮지 않습니다.
//   refresh 는 서버 컴포넌트만 다시 그리고, 화면에 이미 떠 있는
//   입력값(useState)은 건드리지 않습니다.
// =========================================================

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sectorPulse } from '@/server/actions/pulse';

export interface AutoRefreshProps {
  /**
   * 몇 초마다 물어볼까. 기본 20초.
   *
   * 접수는 하루에 수십 건이라 1초를 다투지 않습니다. 짧게 잡을수록
   * 서버를 자주 두드리는데, 사람이 느끼는 차이는 크지 않습니다.
   */
  everySec?: number;
}

export default function AutoRefresh({ everySec = 20 }: AutoRefreshProps) {
  const router = useRouter();

  /*
    ★ 첫 답은 기준으로만 씁니다.
      처음 물어본 값을 '지금 화면' 으로 삼고, 그 다음부터 비교합니다.
      기준 없이 시작하면 화면을 열자마자 한 번 새로 그립니다.
  */
  const stamp = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      // 안 보고 있으면 묻지 않습니다
      if (document.visibilityState !== 'visible') return;
      if (busy.current) return;

      busy.current = true;

      try {
        const next = await sectorPulse();
        if (!alive) return;

        if (stamp.current === null) {
          stamp.current = next;
          return;
        }

        if (next !== stamp.current) {
          stamp.current = next;
          router.refresh();
        }
      } catch {
        /*
          ★ 조용히 넘어갑니다.
            네트워크가 잠깐 끊긴 것을 화면에 띄우면, 아무 문제 없는
            사람에게 겁을 줍니다. 다음 차례에 다시 묻습니다.
        */
      } finally {
        busy.current = false;
      }
    }

    const timer = setInterval(check, everySec * 1000);

    // 탭으로 돌아오면 기다리지 않고 바로 봅니다
    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }

    document.addEventListener('visibilitychange', onVisible);
    check();

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everySec, router]);

  return null;
}
