// =========================================================
// 놓을 위치: tests/domain/chat-room.test.ts
// 기준: 사용자 요청 2026-09-06 — 폰에서 카톡처럼 대화 (대화방 목록 규칙)
// =========================================================

import { describe, it, expect } from 'vitest';
import { groupChatRooms, messagePreview, roomStamp, sumUnread, type ChatMessageRow } from '@/server/domain/chat-room';

function row(over: Partial<ChatMessageRow>): ChatMessageRow {
  return {
    orderId: 'o1',
    orderNo: 'ORD-260906-001',
    patientLabel: '김민서',
    counterpart: '테스트치과',
    body: '안녕하세요',
    hasFile: false,
    authorName: '홍길동',
    mine: false,
    createdAt: '2026-09-06T05:00:00Z',
    ...over,
  };
}

describe('messagePreview', () => {
  it('글이 있으면 글, 줄바꿈은 한 칸으로', () => {
    expect(messagePreview('두 줄\n입니다', false)).toBe('두 줄 입니다');
  });
  it('파일만 보낸 글은 📎 파일', () => {
    expect(messagePreview('   ', true)).toBe('📎 파일');
  });
  it('둘 다 없으면 빈 글', () => {
    expect(messagePreview('', false)).toBe('');
  });
});

describe('groupChatRooms', () => {
  it('주문별로 첫(최신) 글만 남기고 순서를 지킵니다', () => {
    const rooms = groupChatRooms(
      [
        row({ orderId: 'o2', body: '최신 글', createdAt: '2026-09-06T06:00:00Z' }),
        row({ orderId: 'o1', body: 'o1 최신', createdAt: '2026-09-06T05:00:00Z' }),
        row({ orderId: 'o2', body: '옛 글', createdAt: '2026-09-06T04:00:00Z' }),
      ],
      { o1: 2 },
    );
    expect(rooms.map((r) => r.orderId)).toEqual(['o2', 'o1']);
    expect(rooms[0].preview).toBe('최신 글');
    expect(rooms[0].unread).toBe(0);
    expect(rooms[1].unread).toBe(2);
  });

  it('내 글은 나: 를 붙입니다', () => {
    const [room] = groupChatRooms([row({ mine: true, body: '보냈습니다' })], {});
    expect(room.preview).toBe('나: 보냈습니다');
  });
});

describe('sumUnread', () => {
  it('전부 더합니다', () => {
    expect(sumUnread({ a: 1, b: 3 })).toBe(4);
    expect(sumUnread({})).toBe(0);
  });
});

describe('roomStamp', () => {
  const now = new Date(2026, 8, 6, 15, 0); // 2026-09-06 15:00 (로컬)

  it('오늘은 시:분', () => {
    expect(roomStamp(new Date(2026, 8, 6, 9, 5).toISOString(), now)).toBe('09:05');
  });
  it('어제는 어제', () => {
    expect(roomStamp(new Date(2026, 8, 5, 23, 59).toISOString(), now)).toBe('어제');
  });
  it('그 전은 월/일', () => {
    expect(roomStamp(new Date(2026, 7, 30, 12, 0).toISOString(), now)).toBe('8/30');
  });
});
