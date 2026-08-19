// =========================================================
// 놓을 위치: src/server/events/signal.ts
//
// "이 주문에 무언가 바뀌었다" 를 채널에 흘립니다.
//
// ★ 내용은 안 싣습니다 (domain/signal 의 약속).
//   주문 id 뿐입니다. 받은 쪽이 평소의 길(서버 → RLS)로 다시 읽습니다.
//
// ★ 실패해도 업무는 되돌리지 않습니다 (events/index 와 같은 원칙).
//   신호는 '빠른 길' 일 뿐입니다. 못 가면 폴링이 20초 안에 받쳐 줍니다.
//   글은 이미 저장됐는데 신호가 안 갔다고 에러를 돌려주면, 보낸 사람은
//   멀쩡히 저장된 글을 실패로 알고 또 보냅니다.
//
// ★ 웹소켓을 열지 않습니다 (httpSend).
//   서버 액션은 응답을 주고 끝나는 자리입니다. 연결을 세우고 참여하고
//   기다리는 대신, REST 한 발로 쏘고 끝냅니다.
//
// ★ 보낸 사람의 토큰으로 쏩니다.
//   private 채널이라 발신도 realtime.messages 의 insert 정책을 지납니다
//   (can_access_order). 방금 그 주문에 글을 쓴 사람이니 당연히 통과하고,
//   토큰을 훔치지 못한 남은 여기서도 막힙니다.
// =========================================================

import { createClient } from '@/lib/supabase/server';
import { orderTopic, ORDER_SIGNAL_EVENT } from '@/server/domain/signal';

export async function signalOrderChanged(orderId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    await supabase.realtime.setAuth(data.session.access_token);

    const channel = supabase.channel(orderTopic(orderId), {
      config: { private: true },
    });

    await channel.httpSend(ORDER_SIGNAL_EVENT, { orderId });
    await supabase.removeChannel(channel);
  } catch (error) {
    // 신호가 못 간 것은 사건이 아닙니다 — 폴링이 있습니다
    console.error('[signal] 주문 신호를 보내지 못했습니다', error);
  }
}
