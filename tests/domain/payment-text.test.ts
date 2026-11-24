import { describe, expect, it } from 'vitest';
import { formatAmountText, memoAsAmount, parseAmountText } from '@/server/domain/invoice';

describe('parseAmountText', () => {
  it('쉼표와 빈칸을 떼고 읽습니다', () => {
    expect(parseAmountText('2,052,000')).toBe(2052000);
    expect(parseAmountText(' 1000000 ')).toBe(1000000);
    expect(parseAmountText('-50,000')).toBe(-50000);
  });

  it('다른 글자가 섞이면 읽지 않습니다', () => {
    expect(parseAmountText('100만')).toBeNaN();
    expect(parseAmountText('')).toBeNaN();
    expect(parseAmountText('-')).toBeNaN();
    expect(parseAmountText('1.5')).toBeNaN();
  });
});

describe('formatAmountText', () => {
  it('치는 대로 쉼표를 넣습니다', () => {
    expect(formatAmountText('2052000')).toBe('2,052,000');
    expect(formatAmountText('1,0000')).toBe('10,000');
    expect(formatAmountText('999')).toBe('999');
    expect(formatAmountText('')).toBe('');
  });

  it('숫자가 아닌 글자는 버리고, 맨 앞 - 는 남깁니다', () => {
    expect(formatAmountText('12a3원')).toBe('123');
    expect(formatAmountText('-')).toBe('-');
    expect(formatAmountText('-50000')).toBe('-50,000');
    expect(formatAmountText('007')).toBe('7');
    expect(formatAmountText('0')).toBe('0');
  });

  it('넣은 것을 다시 읽으면 같은 숫자입니다', () => {
    for (const n of [1, 999, 1000, 1052000, 2052000, -30000]) {
      expect(parseAmountText(formatAmountText(String(n)))).toBe(n);
    }
  });
});

describe('memoAsAmount', () => {
  it('11-23 의 그 일 — 금액 칸은 전액, 메모에 1000000', () => {
    expect(memoAsAmount('1000000', 2052000)).toBe(1000000);
    expect(memoAsAmount('1,000,000', 2052000)).toBe(1000000);
    expect(memoAsAmount(' 1000000원 ', 2052000)).toBe(1000000);
  });

  it('글자가 섞인 메모는 묻지 않습니다', () => {
    expect(memoAsAmount('분할납부', 1000000)).toBeNull();
    expect(memoAsAmount('8월분 합산 입금', 2052000)).toBeNull();
    expect(memoAsAmount('100만 먼저', 2052000)).toBeNull();
    expect(memoAsAmount('', 2052000)).toBeNull();
  });

  it('금액 칸과 같으면 묻지 않습니다', () => {
    expect(memoAsAmount('1000000', 1000000)).toBeNull();
  });

  it('작은 숫자는 회차나 달로 봅니다', () => {
    expect(memoAsAmount('2', 2052000)).toBeNull();
    expect(memoAsAmount('11', 2052000)).toBeNull();
    expect(memoAsAmount('999', 2052000)).toBeNull();
    expect(memoAsAmount('1000', 2052000)).toBe(1000);
  });
});
