// =========================================================
// 놓을 위치: tests/domain/hangul.test.ts
//
// 초성 검색. (명세서 SPEC_shade-photo S1 — "ㄱㅁㅅ → 김민서")
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  initialOf,
  initials,
  isChosungQuery,
  matchesKorean,
  matchesAny,
} from '@/server/domain/hangul';

describe('첫소리 뽑기', () => {
  it('김민서 → ㄱㅁㅅ', () => {
    expect(initials('김민서')).toBe('ㄱㅁㅅ');
  });

  it('받침이 있어도 첫소리는 같습니다', () => {
    expect(initialOf('강')).toBe('ㄱ');
    expect(initialOf('가')).toBe('ㄱ');
    expect(initialOf('힣')).toBe('ㅎ');
    expect(initialOf('가')).toBe(initialOf('갛'));
  });

  // ★ 한글이 아니면 그대로 둡니다 — 주문번호가 섞여 들어옵니다
  it('한글이 아니면 그대로', () => {
    expect(initials('ORD-1')).toBe('ORD-1');
    expect(initials('김A박')).toBe('ㄱAㅂ');
  });
});

describe('찾는 말이 첫소리인가', () => {
  it('ㄱㅁㅅ 는 첫소리', () => {
    expect(isChosungQuery('ㄱㅁㅅ')).toBe(true);
  });

  it('글자가 섞이면 아닙니다', () => {
    expect(isChosungQuery('김ㅁㅅ')).toBe(false);
    expect(isChosungQuery('김민서')).toBe(false);
    expect(isChosungQuery('ORD')).toBe(false);
    expect(isChosungQuery('')).toBe(false);
  });
});

describe('이름 찾기', () => {
  it('★ ㄱㅁㅅ 로 김민서를 찾습니다', () => {
    expect(matchesKorean('김민서', 'ㄱㅁㅅ')).toBe(true);
  });

  it('글자로도 찾습니다', () => {
    expect(matchesKorean('김민서', '민서')).toBe(true);
    expect(matchesKorean('김민서', '김')).toBe(true);
  });

  it('앞부분 첫소리만으로도', () => {
    expect(matchesKorean('김민서', 'ㄱㅁ')).toBe(true);
    expect(matchesKorean('김민서', 'ㅁㅅ')).toBe(true);
  });

  /*
    ★★ 첫소리는 **이어져 있어야** 합니다. 'ㄱㅅ' 가 김민서에 걸리면
      좁히려던 것이 도리어 넓어집니다.
  */
  it('★ 띄엄띄엄은 안 걸립니다', () => {
    expect(matchesKorean('김민서', 'ㄱㅅ')).toBe(false);
  });

  it('다른 이름은 안 걸립니다', () => {
    expect(matchesKorean('박정호', 'ㄱㅁㅅ')).toBe(false);
    expect(matchesKorean('이수아', '민서')).toBe(false);
  });

  /*
    ★ 자판에서 ㄲ 을 치려면 시프트를 눌러야 합니다. 급한 사람은
      ㄱ 만 칩니다.
  */
  it('★ ㄱ 으로 까치를 찾습니다 (된소리 봐주기)', () => {
    expect(matchesKorean('까치', 'ㄱㅊ')).toBe(true);
    expect(matchesKorean('쌍용', 'ㅅㅇ')).toBe(true);
  });

  // ★ 반대는 안 봐줍니다 — ㄲ 을 친 사람은 ㄲ 을 찾는 것입니다
  it('ㄲ 로 가치를 찾지는 않습니다', () => {
    expect(matchesKorean('가치', 'ㄲㅊ')).toBe(false);
  });

  // ★ 검색칸이 비었을 때 목록이 사라지면 안 됩니다
  it('빈 말이면 다 통과', () => {
    expect(matchesKorean('아무개', '')).toBe(true);
    expect(matchesKorean('아무개', '   ')).toBe(true);
  });

  it('주문번호는 대소문자를 안 가립니다', () => {
    expect(matchesKorean('ORD-260821-001', 'ord-2608')).toBe(true);
  });
});

describe('여러 칸 함께 보기', () => {
  const row = ['김민서', 'ORD-260821-001'];

  it('이름으로도 번호로도', () => {
    expect(matchesAny(row, 'ㄱㅁㅅ')).toBe(true);
    expect(matchesAny(row, '260821')).toBe(true);
  });

  it('둘 다 아니면 안 걸립니다', () => {
    expect(matchesAny(row, 'ㅂㅈㅎ')).toBe(false);
  });

  it('빈 칸이 섞여도 터지지 않습니다', () => {
    expect(matchesAny([null, undefined, '김민서'], 'ㄱㅁㅅ')).toBe(true);
    expect(matchesAny([null, undefined], 'ㄱ')).toBe(false);
  });
});
