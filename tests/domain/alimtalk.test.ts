// =========================================================
// 알림톡 — 번호 다루기와 '누가 받는가'. (사용자 요청 2026-08-14)
//
// ★ 아직 안 보냅니다. 사업자등록·카카오 채널·템플릿 심사가 먼저입니다.
//   그 전에 **누구에게 갈 뻔했는가** 를 정확히 정해 둡니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  isValidPhone,
  formatPhone,
  canReceive,
  eventFor,
  ALIMTALK_RULES,
} from '@/server/domain/alimtalk';

describe('번호 다듬기', () => {
  // ★ 사람마다 다르게 씁니다. 담을 때 한 모양으로 눕혀야
  //   같은 사람이 두 번 받거나 대행사가 거부하는 일이 없습니다
  it('★ 어떻게 써도 같은 값으로 담깁니다', () => {
    for (const raw of ['010-1234-5678', '010 1234 5678', '01012345678', '(010)1234-5678']) {
      expect(normalizePhone(raw)).toBe('01012345678');
    }
  });

  it('★ +82 는 0 으로 되돌립니다 — 국내 발송이라 0 이 있어야 합니다', () => {
    expect(normalizePhone('+82 10-1234-5678')).toBe('01012345678');
    expect(normalizePhone('+821012345678')).toBe('01012345678');
  });

  it('앞뒤가 비면 null', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  // ★ 유선번호는 저장은 되고 발송만 조용히 실패합니다.
  //   그 실패가 아무 화면에도 안 보이므로 여기서 막습니다
  it('★ 유선번호는 안 받습니다', () => {
    expect(normalizePhone('02-123-4567')).toBeNull();
    expect(normalizePhone('031-123-4567')).toBeNull();
    expect(isValidPhone('0212345678')).toBe(false);
  });

  it('자릿수가 모자라거나 넘치면 안 받습니다', () => {
    expect(normalizePhone('010-123-456')).toBeNull();
    expect(normalizePhone('010-1234-56789')).toBeNull();
  });

  it('011·016·017·018·019 도 받습니다', () => {
    for (const head of ['011', '016', '017', '018', '019']) {
      expect(normalizePhone(`${head}-123-4567`)).toBe(`${head}1234567`);
    }
  });
});

describe('화면에 보여 줄 모양', () => {
  it('열한 자리는 3-4-4', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678');
  });

  it('열 자리는 3-3-4', () => {
    expect(formatPhone('0111234567')).toBe('011-123-4567');
  });

  it('빈 값은 빈 문자열 — 화면에 null 이 찍히면 안 됩니다', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('')).toBe('');
  });
});

describe('보낼 수 있는 사람인가', () => {
  it('번호가 있고 켜져 있으면 보냅니다', () => {
    expect(canReceive({ phone: '01012345678', alimtalkOn: true })).toBe(true);
  });

  // ★ 번호를 지웠다 다시 넣게 하면 그때마다 오타가 납니다.
  //   번호는 두고 잠시 끄는 길이 있어야 합니다
  it('★ 껐으면 번호가 있어도 안 보냅니다', () => {
    expect(canReceive({ phone: '01012345678', alimtalkOn: false })).toBe(false);
  });

  it('번호가 없으면 켜져 있어도 안 보냅니다', () => {
    expect(canReceive({ phone: null, alimtalkOn: true })).toBe(false);
    expect(canReceive({ phone: '02-123-4567', alimtalkOn: true })).toBe(false);
  });
});

describe('무슨 일에 누가 받는가', () => {
  it('★ 주문이 새로 들어오면 디자인센터', () => {
    expect(eventFor(null, 'received')).toBe('order_received');
    expect(ALIMTALK_RULES.order_received.audience).toBe('design_center');
  });

  it('★ 제작대기로 넘기면 기공소', () => {
    expect(eventFor('designing', 'production_wait')).toBe('production_requested');
    expect(ALIMTALK_RULES.production_requested.audience).toBe('lab');
  });

  it('★ 재스캔으로 바꾸면 치과', () => {
    expect(eventFor('received', 'rescan')).toBe('rescan_requested');
    expect(ALIMTALK_RULES.rescan_requested.audience).toBe('clinic');
  });

  // ★ 같은 상태로 다시 저장하는 일이 있습니다. 'now 가 무엇인가' 로 보면
  //   한 건에 여러 번 나갑니다
  it('★ 상태가 안 바뀌었으면 안 보냅니다', () => {
    expect(eventFor('rescan', 'rescan')).toBeNull();
    expect(eventFor('production_wait', 'production_wait')).toBeNull();
  });

  // ★ 되돌아온 것까지 '새 주문' 이라고 알리면 안 됩니다
  it('★ 접수로 되돌아온 것은 새 주문이 아닙니다', () => {
    expect(eventFor('rescan', 'received')).toBeNull();
  });

  it('나머지 상태 변화에는 안 보냅니다', () => {
    expect(eventFor('production_wait', 'production')).toBeNull();
    expect(eventFor('production', 'shipping')).toBeNull();
    expect(eventFor('shipping', 'completed')).toBeNull();
  });
});
