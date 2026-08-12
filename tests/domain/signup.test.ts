// =========================================================
// 놓을 위치: tests/domain/signup.test.ts
// 기준: 사용자 결정 2026-08-12 —
//   "회원가입창에서 유저가 디자인 가입 못하게",
//   "치과랑 기공사 회원 가입이 완료되면 디자인 센터가 승인을 해줘야"
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  SIGNUP_SECTORS,
  isSignupSector,
  checkSignup,
  canReview,
  checkReviewable,
  checkRejectReason,
  waitingView,
  MIN_PASSWORD,
  type SignupForm,
} from '@/server/domain/signup';

const form = (over: Partial<SignupForm> = {}): SignupForm => ({
  name: '김원장',
  email: 'won@clinic.co.kr',
  password: 'goodpass1',
  orgType: 'clinic',
  orgName: '행복치과',
  ...over,
});

describe('고를 수 있는 곳', () => {
  // ★ 아무나 디자인센터로 가입하면 승인해 줄 사람이 자기 자신이 됩니다
  it('★ 치과와 기공소뿐입니다', () => {
    expect(SIGNUP_SECTORS).toEqual(['clinic', 'lab']);
  });

  it('★ 디자인센터는 값으로 보내도 안 받습니다', () => {
    expect(isSignupSector('design_center')).toBe(false);
    expect(checkSignup(form({ orgType: 'design_center' })).ok).toBe(false);
  });

  it('없는 값도 안 받습니다', () => {
    expect(isSignupSector('')).toBe(false);
    expect(isSignupSector('hospital')).toBe(false);
  });

  it('치과·기공소는 받습니다', () => {
    expect(checkSignup(form({ orgType: 'clinic' })).ok).toBe(true);
    expect(checkSignup(form({ orgType: 'lab' })).ok).toBe(true);
  });
});

describe('가입 신청 검사', () => {
  it('다 채우면 통과', () => {
    expect(checkSignup(form())).toEqual({ ok: true });
  });

  it('이름이 없으면 막습니다', () => {
    expect(checkSignup(form({ name: '  ' })).ok).toBe(false);
  });

  // ★ 기관 이름이 없으면 승인 화면에 "무엇을 승인하는지" 가 안 뜹니다
  it('★ 기관 이름이 없으면 막습니다', () => {
    const verdict = checkSignup(form({ orgName: '' }));

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('기관 이름');
  });

  it('이메일 모양이 아니면 막습니다', () => {
    expect(checkSignup(form({ email: 'won' })).ok).toBe(false);
  });

  it('비밀번호가 짧으면 길이를 알려 줍니다', () => {
    const verdict = checkSignup(form({ password: 'short' }));

    expect(verdict.ok === false && verdict.reason).toContain(String(MIN_PASSWORD));
  });

  // ★ 한 번에 다 쏟아 내면 무엇부터 고칠지 모릅니다
  it('★ 빈 칸을 먼저 말합니다', () => {
    const verdict = checkSignup(form({ name: '', password: 'x' }));

    expect(verdict.ok === false && verdict.reason).toContain('이름');
  });
});

describe('누가 승인하는가', () => {
  it('★ 디자인센터 관리자만', () => {
    expect(canReview({ orgType: 'design_center', isManager: true })).toBe(true);
  });

  // ★ 거래처가 느는 것은 단가·정산이 걸리는 일입니다
  it('★ 디자인센터 사용자는 못 합니다', () => {
    expect(canReview({ orgType: 'design_center', isManager: false })).toBe(false);
  });

  it('치과·기공소는 관리자여도 못 합니다', () => {
    expect(canReview({ orgType: 'clinic', isManager: true })).toBe(false);
    expect(canReview({ orgType: 'lab', isManager: true })).toBe(false);
  });

  it('소속이 없으면 못 합니다', () => {
    expect(canReview({ orgType: null, isManager: true })).toBe(false);
  });
});

describe('이미 처리된 신청', () => {
  it('대기 중이면 처리합니다', () => {
    expect(checkReviewable('pending')).toEqual({ ok: true });
  });

  // ★ 두 번 승인하면 조직이 둘 생깁니다
  it('★ 승인된 것은 다시 못 만집니다', () => {
    expect(checkReviewable('approved').ok).toBe(false);
  });

  it('반려한 것은 다시 가입하라고 안내합니다', () => {
    const verdict = checkReviewable('rejected');

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('다시 가입');
  });
});

describe('반려 사유', () => {
  // ★ 이유 없이 반려하면 같은 내용으로 또 신청합니다
  it('★ 사유가 없으면 반려할 수 없습니다', () => {
    expect(checkRejectReason('   ').ok).toBe(false);
  });

  it('적으면 됩니다', () => {
    expect(checkRejectReason('사업자번호가 확인되지 않습니다')).toEqual({ ok: true });
  });
});

describe('기다리는 사람에게 보여 줄 말', () => {
  // ★ 화면이 텅 비면 자기가 뭘 잘못했는지 찾다가 전화를 겁니다
  it('★ 대기 중이면 어디로 신청했는지 말해 줍니다', () => {
    const view = waitingView('pending', '행복치과', '');

    expect(view.title).toContain('기다리는');
    expect(view.body).toContain('행복치과');
    expect(view.canRetry).toBe(false);
  });

  it('★ 반려면 사유를 그대로 보여 주고 다시 가입할 길을 엽니다', () => {
    const view = waitingView('rejected', '행복치과', '사업자번호가 확인되지 않습니다');

    expect(view.body).toContain('사업자번호');
    expect(view.canRetry).toBe(true);
  });

  it('사유가 비어 있어도 안내는 합니다', () => {
    const view = waitingView('rejected', '행복치과', '   ');

    expect(view.body).toContain('문의');
    expect(view.canRetry).toBe(true);
  });

  // ★ 초대장으로 들어왔는데 자리가 안 붙은 경우 — 신청 기록이 없습니다
  it('★ 신청 기록이 없으면 초대 이메일을 확인하라고 합니다', () => {
    const view = waitingView(null, '', '');

    expect(view.body).toContain('초대');
    expect(view.canRetry).toBe(false);
  });
});
