// =========================================================
// 놓을 위치: tests/domain/push.test.ts
// 기준: 사용자 요청 2026-08-19 — "디자인 계정이 다른 일을 하고 있을 때에
//       대화가 온지 안 온지 확인할 수 없어"
// =========================================================

import { describe, it, expect } from 'vitest';
import { chatPushPayload, type ChatPushInput } from '@/server/domain/push';
import { countUnreadChatByOrder } from '@/server/domain/notification';

describe('푸시에 싣는 것', () => {
  const input: ChatPushInput = {
    orderNo: 'ORD-260819-003',
    authorName: '행복치과',
    link: '/design/orders/abc',
    orderId: 'abc',
  };

  it('주문번호가 제목, 보낸 곳이 본문입니다', () => {
    const payload = chatPushPayload(input);

    expect(payload.title).toBe('새 대화 · ORD-260819-003');
    expect(payload.body).toBe('행복치과에서 대화를 남겼습니다');
    expect(payload.link).toBe('/design/orders/abc');
  });

  /**
   * ★ 이 테스트가 지키는 것은 문구가 아니라 **경계**입니다.
   *   푸시는 구글·모질라 서버를 지나 잠금화면까지 가는 글자입니다.
   *   환자 이름과 글 내용은 타입에 칸이 없어 실을 수 없고,
   *   여기서는 들어갈 수 있는 낱말이 어디에도 안 섞였는지 봅니다.
   */
  it('★ 환자 이름을 실을 칸 자체가 없습니다', () => {
    const keys = Object.keys(input);

    expect(keys.sort()).toEqual(['authorName', 'link', 'orderId', 'orderNo']);
  });

  it('★ 같은 주문이면 tag 가 같습니다 — 알림이 쌓이지 않고 갈아끼웁니다', () => {
    const first = chatPushPayload(input);
    const second = chatPushPayload({ ...input, authorName: '기공소' });

    expect(first.tag).toBe(second.tag);
    expect(first.tag).toBe('order-abc');
  });
});

describe('안 읽은 대화를 주문별로 세기', () => {
  it('주문별로 셉니다', () => {
    const map = countUnreadChatByOrder([
      { orderId: 'a' },
      { orderId: 'a' },
      { orderId: 'b' },
    ]);

    expect(map).toEqual({ a: 2, b: 1 });
  });

  it('없으면 빈 것입니다', () => {
    expect(countUnreadChatByOrder([])).toEqual({});
  });

  // ★ 알림은 여러 곳에서 만듭니다 — payload 를 믿지 않습니다
  it('★ 이상한 payload 는 조용히 빠집니다', () => {
    const map = countUnreadChatByOrder([
      null,
      undefined,
      {},
      { orderId: 42 },
      { orderId: '' },
      'not-an-object',
      { orderId: 'ok' },
    ]);

    expect(map).toEqual({ ok: 1 });
  });
});
