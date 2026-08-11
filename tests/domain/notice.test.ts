// =========================================================
// 놓을 위치: tests/domain/notice.test.ts
// 기준: 사용자 결정 2026-08-12 — 공지사항은 디자인센터가 씁니다
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  checkNotice,
  isVisibleTo,
  sortNotices,
  MAX_TITLE,
  MAX_BODY,
} from '@/server/domain/notice';

describe('공지 검사', () => {
  it('제목과 내용이 있으면 통과', () => {
    expect(checkNotice('배송 일정 안내', '이번 주 토요일은 쉽니다.')).toEqual({ ok: true });
  });

  // 스페이스로 채운 제목은 목록에서 빈 줄로 보입니다
  it('공백만 있는 것은 빈 것으로 봅니다', () => {
    expect(checkNotice('   ', '내용')).toEqual({ ok: false, reason: '제목을 적어 주세요' });
    expect(checkNotice('제목', '  \n ')).toEqual({ ok: false, reason: '내용을 적어 주세요' });
  });

  it('제목 길이를 막습니다', () => {
    expect(checkNotice('가'.repeat(MAX_TITLE), '내용').ok).toBe(true);
    expect(checkNotice('가'.repeat(MAX_TITLE + 1), '내용').ok).toBe(false);
  });

  it('내용 길이를 막습니다', () => {
    expect(checkNotice('제목', '가'.repeat(MAX_BODY + 1)).ok).toBe(false);
  });
});

describe('누구에게 보이는가', () => {
  const published = { audience: 'all' as const, publishedAt: '2026-08-12T00:00:00Z' };

  it('전체 공지는 치과도 기공소도 봅니다', () => {
    expect(isVisibleTo(published, 'clinic', false)).toBe(true);
    expect(isVisibleTo(published, 'lab', false)).toBe(true);
  });

  it('치과 공지는 기공소에 안 보입니다', () => {
    const notice = { ...published, audience: 'clinic' as const };

    expect(isVisibleTo(notice, 'clinic', false)).toBe(true);
    expect(isVisibleTo(notice, 'lab', false)).toBe(false);
  });

  // ★ 쓰다 만 글이 치과 화면에 떠 있으면 그것이 곧 사고입니다
  it('★ 임시저장은 읽는 쪽에 안 보입니다', () => {
    expect(isVisibleTo({ audience: 'all', publishedAt: null }, 'clinic', false)).toBe(false);
  });

  it('쓴 조직은 임시저장도 봅니다', () => {
    expect(isVisibleTo({ audience: 'clinic', publishedAt: null }, 'design_center', true)).toBe(true);
  });

  it('지운 글은 읽는 쪽에 안 보입니다', () => {
    expect(
      isVisibleTo({ ...published, deletedAt: '2026-08-12T01:00:00Z' }, 'clinic', false),
    ).toBe(false);
  });
});

describe('공지 차례', () => {
  const row = (over: Partial<{ id: string; isPinned: boolean; publishedAt: string | null; createdAt: string }>) => ({
    id: 'x',
    isPinned: false,
    publishedAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-08-01T00:00:00Z',
    ...over,
  });

  it('고정이 맨 위', () => {
    const sorted = sortNotices([
      row({ id: 'a', publishedAt: '2026-08-10T00:00:00Z' }),
      row({ id: 'b', isPinned: true, publishedAt: '2026-08-01T00:00:00Z' }),
    ]);

    expect(sorted.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('그 다음은 최근 먼저', () => {
    const sorted = sortNotices([
      row({ id: 'old', publishedAt: '2026-07-01T00:00:00Z' }),
      row({ id: 'new', publishedAt: '2026-08-10T00:00:00Z' }),
    ]);

    expect(sorted.map((r) => r.id)).toEqual(['new', 'old']);
  });

  // ★ 쓰다 만 글이 아래로 가라앉으면 영영 안 끝납니다
  it('★ 임시저장이 게시된 글보다 위', () => {
    const sorted = sortNotices([
      row({ id: 'done', publishedAt: '2026-08-10T00:00:00Z' }),
      row({ id: 'draft', publishedAt: null, createdAt: '2026-07-01T00:00:00Z' }),
    ]);

    expect(sorted.map((r) => r.id)).toEqual(['draft', 'done']);
  });

  it('고정이 임시저장보다도 위', () => {
    const sorted = sortNotices([
      row({ id: 'draft', publishedAt: null }),
      row({ id: 'pin', isPinned: true }),
    ]);

    expect(sorted.map((r) => r.id)).toEqual(['pin', 'draft']);
  });

  it('원래 배열을 안 건드립니다', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b', isPinned: true })];
    sortNotices(rows);

    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
