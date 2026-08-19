// =========================================================
// 놓을 위치: src/components/order/OrderSignal.tsx
//
// 주문상세를 열어 둔 동안 신호를 듣습니다. (사용자 요청 2026-08-19 —
//   "대화창이 새로고침없이 카톡처럼 실시간으로")
//
// ★ 화면을 열어 둔 동안만 삽니다.
//   이 컴포넌트가 곧 구독입니다 — 주문상세에 들어오면 붙고, 나가면
//   (unmount) 끊어집니다. "채팅 활성 시에만" 이라는 감각을 연결의
//   수명으로 옮긴 것입니다. 데이터는 껐다 켜지 않습니다.
//
// ★ 신호를 받으면 서버에 **다시 묻습니다** (router.refresh).
//   채널에는 주문 id 뿐, 내용이 없습니다. 새 글은 평소의 길
//   (서버 컴포넌트 → RLS)로 옵니다. OrderChat 의 입력칸(useState)은
//   refresh 가 건드리지 않으므로 쓰던 글자가 날아가지 않습니다.
//
// ★ 안 보는 탭에서는 그리지 않습니다 (AutoRefresh 와 같은 예절).
//   숨어 있는 동안 온 신호는 표시만 해 두고, 돌아오는 순간 한 번
//   그립니다. 밤새 열어 둔 탭이 신호마다 서버를 두드리면 안 됩니다.
//
// ★ 몰려오면 뭉칩니다 (domain/signal 의 refreshDelay).
//   서너 명이 연달아 쓰면 신호도 연달아 옵니다. 쉬는 시간 안에 온
//   것은 하나로 접어 끝나고 한 번만 그립니다.
//
// ★ 구독이 거절되거나 끊겨도 조용합니다.
//   이 채널은 private 라 주문의 세 자리가 아니면 DB 가 거절합니다.
//   거절이든 끊김이든 화면은 멀쩡해야 합니다 — 폴링이 받쳐 줍니다.
// =========================================================

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { orderTopic, ORDER_SIGNAL_EVENT, refreshDelay } from '@/server/domain/signal';

export default function OrderSignal({ orderId }: { orderId: string }) {
  const router = useRouter();

  const lastRefreshAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missed = useRef(false); // 숨어 있는 동안 신호가 왔었나

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    function draw() {
      lastRefreshAt.current = Date.now();
      router.refresh();
    }

    function onSignal() {
      if (!alive) return;

      // 안 보고 있으면 돌아올 때로 미룹니다
      if (document.visibilityState !== 'visible') {
        missed.current = true;
        return;
      }

      // 이미 예약돼 있으면 그 한 번이 이 신호까지 덮습니다
      if (timer.current) return;

      const wait = refreshDelay(lastRefreshAt.current, Date.now());
      if (wait === 0) {
        draw();
        return;
      }

      timer.current = setTimeout(() => {
        timer.current = null;
        if (alive && document.visibilityState === 'visible') draw();
        else missed.current = true;
      }, wait);
    }

    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      if (missed.current) {
        missed.current = false;
        draw();
      }
    }

    const channel = supabase
      .channel(orderTopic(orderId), { config: { private: true } })
      .on('broadcast', { event: ORDER_SIGNAL_EVENT }, onSignal);

    /*
      ★ 토큰을 실은 뒤에 구독합니다.
        private 채널은 참여할 때 DB 정책(can_access_order)을 봅니다.
        토큰이 아직 안 실린 채 구독하면 내 주문인데도 거절당합니다.
    */
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive || !data.session) return;

      await supabase.realtime.setAuth(data.session.access_token);
      if (!alive) return;

      channel.subscribe();
    })();

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [orderId, router]);

  return null;
}
