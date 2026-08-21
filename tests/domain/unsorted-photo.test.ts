// =========================================================
// 놓을 위치: tests/domain/unsorted-photo.test.ts
//
// 미분류 사진 묶기. (명세서 SPEC_shade-photo S5·S6)
//
// ★ 저장소·정책은 진짜 계정으로 눌러 확인했습니다(스크립트).
//   여기서는 **묶는 규칙**만 봅니다 — 그건 순수한 계산이라
//   시험이 잡을 수 있습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { groupUnsorted } from '@/server/domain/shade-photo';

const row = (session: string, at: string) => ({ session_id: session, created_at: at });

describe('미분류 묶기', () => {
  /*
    ★★ 매칭은 **묶음 단위**입니다. 한 환자를 세 장 찍었으면 세 장이
      같이 갑니다 — 장마다 고르게 하면 그게 곧 카톡에서 하던 그 일입니다.
  */
  it('같은 묶음은 한 줄로 셉니다', () => {
    const boxes = groupUnsorted([
      row('a', '2026-08-21T02:00:00Z'),
      row('a', '2026-08-21T02:00:05Z'),
      row('a', '2026-08-21T02:00:09Z'),
    ]);

    expect(boxes).toHaveLength(1);
    expect(boxes[0].count).toBe(3);
  });

  // ★ 묶음의 시각은 **제일 먼저 찍은 장**입니다 — 그때 환자를 봤습니다
  it('묶음 시각은 첫 장으로', () => {
    const boxes = groupUnsorted([
      row('a', '2026-08-21T02:00:09Z'),
      row('a', '2026-08-21T02:00:00Z'),
    ]);

    expect(boxes[0].takenAt).toBe('2026-08-21T02:00:00Z');
  });

  it('최근 묶음이 위로', () => {
    const boxes = groupUnsorted([
      row('old', '2026-08-20T01:00:00Z'),
      row('new', '2026-08-21T01:00:00Z'),
    ]);

    expect(boxes.map((b) => b.sessionId)).toEqual(['new', 'old']);
  });

  it('빈 목록이면 빈 결과', () => {
    expect(groupUnsorted([])).toEqual([]);
  });
});
