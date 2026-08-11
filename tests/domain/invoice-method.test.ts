// =========================================================
// 놓을 위치: tests/domain/invoice-method.test.ts
// 기준: 사용자 요청 2026-08-12 — 정산서를 이메일로 받을지 팩스로 받을지
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  wantsEmail,
  wantsFax,
  missingContact,
  INVOICE_METHOD_LABEL,
  INVOICE_METHODS,
} from '@/server/domain/invoice-method';

describe('어디로 보내는가', () => {
  it('둘 다면 양쪽 모두', () => {
    expect(wantsEmail('all')).toBe(true);
    expect(wantsFax('all')).toBe(true);
  });

  it('이메일만 고르면 팩스는 안 봅니다', () => {
    expect(wantsEmail('email')).toBe(true);
    expect(wantsFax('email')).toBe(false);
  });

  it('팩스만 고르면 이메일은 안 봅니다', () => {
    expect(wantsEmail('fax')).toBe(false);
    expect(wantsFax('fax')).toBe(true);
  });

  it('세 가지 모두 이름이 있습니다', () => {
    for (const m of INVOICE_METHODS) expect(INVOICE_METHOD_LABEL[m]).toBeTruthy();
  });
});

describe('보낼 수 있는가', () => {
  it('고른 곳이 다 차 있으면 빠진 것이 없습니다', () => {
    expect(missingContact({ method: 'email', email: 'a@b.com', fax: null })).toEqual([]);
    expect(missingContact({ method: 'fax', email: null, fax: '02-000-0000' })).toEqual([]);
  });

  // ★ 이게 이 파일의 이유입니다 — 갈 데 없는 정산서를 마감해 버리는 일
  it('★ 고른 곳이 비어 있으면 짚어 줍니다', () => {
    expect(missingContact({ method: 'email', email: null, fax: '02-000-0000' })).toEqual(['email']);
    expect(missingContact({ method: 'all', email: null, fax: null })).toEqual(['email', 'fax']);
  });

  // ★ 고칠 것이 없는데 빨간 글씨만 남으면 아무도 안 봅니다
  it('★ 안 고른 곳이 비어 있는 것은 문제가 아닙니다', () => {
    expect(missingContact({ method: 'fax', email: null, fax: '02-000-0000' })).toEqual([]);
    expect(missingContact({ method: 'email', email: 'a@b.com', fax: null })).toEqual([]);
  });

  it('공백만 있는 것은 빈 것으로 봅니다', () => {
    expect(missingContact({ method: 'email', email: '   ', fax: null })).toEqual(['email']);
  });
});
