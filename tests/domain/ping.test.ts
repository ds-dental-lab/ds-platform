// =========================================================
// 놓을 위치: tests/domain/ping.test.ts
//
// 탭 제목에 안 읽은 수를 붙이는 규칙. (사용자 결정 2026-08-13)
// =========================================================

import { describe, it, expect } from 'vitest';
import { titleWithUnread, baseTitle, shouldPing } from '@/server/domain/ping';

describe('탭 제목', () => {
  it('안 읽은 것이 있으면 앞에 붙는다', () => {
    expect(titleWithUnread('DS Flow', 3)).toBe('(3) DS Flow');
  });

  it('0이면 안 붙는다 — (0) 은 소음입니다', () => {
    expect(titleWithUnread('DS Flow', 0)).toBe('DS Flow');
  });

  it('★ 겹쳐 붙지 않는다 — 화면을 옮길 때마다 쌓이면 안 됩니다', () => {
    let title = titleWithUnread('DS Flow', 1);
    title = titleWithUnread(title, 2);
    title = titleWithUnread(title, 5);

    expect(title).toBe('(5) DS Flow');
  });

  it('다 읽으면 본래 제목으로 돌아온다', () => {
    expect(titleWithUnread('(7) DS Flow', 0)).toBe('DS Flow');
  });

  it('너무 많으면 줄인다', () => {
    expect(titleWithUnread('DS Flow', 250)).toBe('(99+) DS Flow');
  });

  it('본래 제목을 떼어 낼 수 있다', () => {
    expect(baseTitle('(12) 주문상세 · DS Flow')).toBe('주문상세 · DS Flow');
    expect(baseTitle('주문상세 · DS Flow')).toBe('주문상세 · DS Flow');
  });
});

describe('소리는 늘어났을 때만', () => {
  it('새 알림이 오면 낸다', () => {
    expect(shouldPing(2, 3)).toBe(true);
  });

  it('★ 화면을 열자마자는 안 낸다 — 아침마다 울리면 안 됩니다', () => {
    expect(shouldPing(null, 9)).toBe(false);
  });

  it('읽어서 줄어들 때는 안 낸다', () => {
    expect(shouldPing(5, 2)).toBe(false);
    expect(shouldPing(1, 0)).toBe(false);
  });

  it('그대로면 안 낸다', () => {
    expect(shouldPing(4, 4)).toBe(false);
  });
});
