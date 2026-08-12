// =========================================================
// 놓을 위치: tests/domain/designer.test.ts
// 기준: 사용자 결정 2026-08-12 —
//   "배정된 주문서에 대해선 다른 디자이너가 디자인을 잡아서는 안되게"
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  needsSeat,
  checkSeat,
  checkAssign,
  assignable,
  seatLabel,
} from '@/server/domain/designer';

const 나 = { userId: '나', isManager: false };
const 관리자 = { userId: '관리자', isManager: true };

const 빈자리 = { designerId: null };
const 내자리 = { designerId: '나', designerName: '김디자' };
const 남의자리 = { designerId: '남', designerName: '박디자' };

describe('어떤 전이가 자리를 따지는가', () => {
  it('★ 디자인을 잡는 순간 — 접수·재스캔에서 디자인으로', () => {
    expect(needsSeat('received', 'designing')).toBe(true);
    expect(needsSeat('rescan', 'designing')).toBe(true);
  });

  it('★ 디자인 중인 건을 내보내는 것 — 제작대기·재스캔으로', () => {
    expect(needsSeat('designing', 'production_wait')).toBe(true);
    expect(needsSeat('designing', 'rescan')).toBe(true);
  });

  // ★ 뺏는 것이 아니라 돌려주는 것입니다.
  //   여기까지 막으면 담당자가 자리를 비운 사이 기공소의 수정 요청이 갈 곳을 잃습니다.
  it('★ 되돌아오는 것은 안 막습니다', () => {
    expect(needsSeat('production_wait', 'designing')).toBe(false);
    expect(needsSeat('production', 'designing')).toBe(false);
  });

  it('디자인과 상관없는 전이는 따지지 않습니다', () => {
    expect(needsSeat('production', 'shipping')).toBe(false);
    expect(needsSeat('received', 'cancelled')).toBe(false);
    expect(needsSeat('shipping', 'completed')).toBe(false);
  });
});

describe('디자인을 만져도 되는가', () => {
  // ★ 배정 화면을 먼저 거치게 하면 주문마다 일이 하나 더 생깁니다
  it('★ 아무도 안 잡았으면 지금 누른 사람이 잡습니다', () => {
    expect(checkSeat(빈자리, 나)).toEqual({ ok: true, claim: true });
  });

  it('내가 잡은 것은 그대로 진행합니다 — 다시 잡지 않습니다', () => {
    expect(checkSeat(내자리, 나)).toEqual({ ok: true, claim: false });
  });

  // ★ 이 한 줄이 사용자가 부탁한 전부입니다
  it('★ 남이 잡은 것은 못 만집니다', () => {
    const verdict = checkSeat(남의자리, 나);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('박디자');
  });

  // ★ 관리자만 예외를 두면 두 명이 한 주문을 만지는 일이 결국 생깁니다
  it('★ 관리자도 그냥은 못 만집니다 — 대신 길을 알려 줍니다', () => {
    const verdict = checkSeat(남의자리, 관리자);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('담당을 바꾼 뒤');
  });

  it('이름을 모르면 그래도 막습니다', () => {
    expect(checkSeat({ designerId: '남' }, 나).ok).toBe(false);
  });
});

describe('담당을 바꿔도 되는가', () => {
  it('빈자리는 내가 가져옵니다', () => {
    expect(checkAssign(빈자리, 나, '나')).toEqual({ ok: true, claim: true });
  });

  // ★ 막으면 잘못 잡은 주문이 아무도 못 건드리는 상태로 굳습니다
  it('★ 내가 잡은 것은 내가 내려놓습니다', () => {
    expect(checkAssign(내자리, 나, null)).toEqual({ ok: true, claim: false });
  });

  it('★ 사용자는 남에게 넘기지 못합니다', () => {
    const verdict = checkAssign(빈자리, 나, '남');

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('관리자');
  });

  it('★ 사용자는 남이 잡은 것을 뺏지 못합니다', () => {
    expect(checkAssign(남의자리, 나, '나').ok).toBe(false);
  });

  // ★ 아프거나 그만두면 누군가는 이어받아야 합니다
  it('★ 관리자는 남의 것을 다른 사람에게 넘깁니다', () => {
    expect(checkAssign(남의자리, 관리자, '나')).toEqual({ ok: true, claim: false });
  });

  it('관리자가 자기에게 가져오면 claim 입니다', () => {
    expect(checkAssign(남의자리, 관리자, '관리자')).toEqual({ ok: true, claim: true });
  });

  it('같은 값으로 바꾸는 것은 아무 일도 아닙니다', () => {
    expect(checkAssign(남의자리, 나, '남')).toEqual({ ok: true, claim: false });
    expect(checkAssign(빈자리, 나, null)).toEqual({ ok: true, claim: false });
  });
});

describe('언제 고칠 수 있는가', () => {
  it('진행 중인 건은 고칩니다', () => {
    expect(assignable('received')).toBe(true);
    expect(assignable('designing')).toBe(true);
    expect(assignable('production')).toBe(true);
  });

  // ★ 끝난 건의 담당을 바꾸면 통계가 뒤에서 흔들립니다
  it('★ 완료·취소된 건은 못 고칩니다', () => {
    expect(assignable('completed')).toBe(false);
    expect(assignable('cancelled')).toBe(false);
  });
});

describe('화면에 쓰는 이름', () => {
  it('빈자리는 미지정', () => {
    expect(seatLabel(빈자리)).toBe('미지정');
  });

  it('이름이 있으면 이름', () => {
    expect(seatLabel(내자리)).toBe('김디자');
  });

  // ★ 사람은 있는데 이름을 못 찾은 것과, 아무도 없는 것은 다릅니다
  it('★ 잡혀는 있는데 이름을 못 찾으면 미지정이 아닙니다', () => {
    expect(seatLabel({ designerId: '남' })).toBe('이름 없음');
  });
});
