// =========================================================
// 놓을 위치: tests/domain/contact.test.ts
// 기준: 홈페이지 수가표·상담 요청 폼 (2026-08-12)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  checkContact,
  digits,
  isContactKind,
  isScanner,
  isPainPoint,
  type ContactForm,
} from '@/server/domain/contact';

const form = (over: Partial<ContactForm> = {}): ContactForm => ({
  clinicName: '행복치과',
  tel: '010-1234-5678',
  email: 'won@clinic.co.kr',
  kind: 'price_list',
  message: '',
  agreed: true,
  scanner: 'owned',
  painPoints: [],
  ...over,
});

describe('전화번호 다듬기', () => {
  // ★ 모양을 강요하면 맞는 번호를 들고도 못 보냅니다
  it('★ 하이픈·공백이 있어도 받습니다', () => {
    expect(digits('010-1234-5678')).toBe('01012345678');
    expect(digits('010 1234 5678')).toBe('01012345678');
    expect(digits('01012345678')).toBe('01012345678');
  });

  it('지역번호도 됩니다', () => {
    expect(checkContact(form({ tel: '02-555-1234' })).ok).toBe(true);
  });

  it('너무 짧으면 막습니다', () => {
    expect(checkContact(form({ tel: '1234' })).ok).toBe(false);
  });

  it('비어 있으면 막습니다', () => {
    expect(checkContact(form({ tel: '  ' })).ok).toBe(false);
  });
});

describe('필수 칸', () => {
  it('다 채우면 통과', () => {
    expect(checkContact(form())).toEqual({ ok: true });
  });

  it('치과명을 먼저 묻습니다', () => {
    const v = checkContact(form({ clinicName: '', tel: '' }));

    expect(v.ok === false && v.reason).toContain('치과명');
  });

  it('이메일 모양이 아니면 막습니다', () => {
    expect(checkContact(form({ email: 'won' })).ok).toBe(false);
  });

  it('문의사항은 비워도 됩니다', () => {
    expect(checkContact(form({ message: '' })).ok).toBe(true);
  });
});

describe('동의', () => {
  // ★ 동의 없이 개인정보를 받지 않습니다 (표의 제약과 이중으로)
  it('★ 동의를 안 하면 못 보냅니다', () => {
    const v = checkContact(form({ agreed: false }));

    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('동의');
  });
});

describe('요청 종류', () => {
  it('수가표·방문 둘뿐입니다', () => {
    expect(isContactKind('price_list')).toBe(true);
    expect(isContactKind('visit')).toBe(true);
    expect(isContactKind('etc')).toBe(false);
  });

  it('★ 화면이 보낸 값을 믿지 않습니다', () => {
    expect(checkContact(form({ kind: 'etc' })).ok).toBe(false);
  });
});


/*
  ★ 질문 둘을 더했습니다 (사용자 요청 2026-08-28). 네이버폼으로 옮기는
    대신 여기 넣었습니다 — 문의가 두 군데로 갈리지 않게.
*/
describe('구강스캐너 보유 여부', () => {
  it('셋 중 하나입니다', () => {
    expect(isScanner('owned')).toBe(true);
    expect(isScanner('planned')).toBe(true);
    expect(isScanner('none')).toBe(true);
    expect(isScanner('')).toBe(false);
    expect(isScanner('yes')).toBe(false);
  });

  /*
    ★ 꼭 받습니다. 셋 중 하나를 누르는 일이라 걸림돌이 아니고,
      상담 통화의 첫마디를 정합니다 — 보유중이면 모델리스, 미보유면
      인상재·수거 이야기부터입니다.
  */
  it('★ 안 고르면 못 보냅니다', () => {
    const v = checkContact(form({ scanner: '' }));
    expect(v.ok === false && v.reason).toContain('스캐너');
  });
});

describe('불만족점', () => {
  it('넷 중에서 고릅니다', () => {
    for (const p of ['price', 'lead_time', 'quality', 'other']) expect(isPainPoint(p)).toBe(true);
    expect(isPainPoint('etc')).toBe(false);
  });

  // ★ 만족하는 사람에게 억지로 고르게 하지 않습니다
  it('★ 비워도 됩니다', () => {
    expect(checkContact(form({ painPoints: [] })).ok).toBe(true);
  });

  it('여러 개 됩니다', () => {
    expect(checkContact(form({ painPoints: ['price', 'quality'] })).ok).toBe(true);
  });

  // ★ 화면이 보낸 값을 믿지 않습니다 — 목록에 없는 값은 막습니다
  it('★ 엉뚱한 값은 막습니다', () => {
    expect(checkContact(form({ painPoints: ['price', 'hack'] })).ok).toBe(false);
  });
});
