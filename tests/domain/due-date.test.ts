// =========================================================
// 놓을 위치: tests/domain/due-date.test.ts
// 기준: 기능명세서 §4.2.1, 요청시한 규칙 (영업일 +4 최소 / +5 기본)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  nthBusinessDay,
  minimumDueDate,
  defaultDueDate,
  checkDueDate,
  buildCalendar,
  formatDueLabel,
  isSaturday,
  isSunday,
} from '@/server/domain/due-date';

// 2026-08-10 은 월요일입니다
const MONDAY = '2026-08-10';

describe('영업일 세기', () => {
  it('★ 주문한 날이 1일차다', () => {
    expect(nthBusinessDay(MONDAY, 1)).toBe('2026-08-10');
  });

  it('★ 토·일은 세지 않는다', () => {
    // 월 1, 화 2, 수 3, 목 4, 금 5
    expect(nthBusinessDay(MONDAY, 4)).toBe('2026-08-13'); // 목
    expect(nthBusinessDay(MONDAY, 5)).toBe('2026-08-14'); // 금
    expect(nthBusinessDay(MONDAY, 6)).toBe('2026-08-17'); // 주말을 건너뛴 월
  });

  it('★ 주말에 주문하면 다음 영업일이 1일차다', () => {
    expect(nthBusinessDay('2026-08-15', 1)).toBe('2026-08-17'); // 토 → 월
    expect(nthBusinessDay('2026-08-16', 1)).toBe('2026-08-17'); // 일 → 월
  });

  it('여러 주를 넘어간다', () => {
    expect(nthBusinessDay(MONDAY, 11)).toBe('2026-08-24');
  });
});

// ★ 사용자가 준 기준 예시입니다.
//   "8월 3일 오후 11:59분까지 주문을 넣으면 디폴트는 7일, 6일도 선택 가능"
describe('기준 예시 — 2026-08-03(월) 주문', () => {
  const ORDER_DAY = '2026-08-03';

  it('★ 기본값은 8월 7일(금)', () => {
    expect(defaultDueDate(ORDER_DAY)).toBe('2026-08-07');
  });

  it('★ 8월 6일(목)까지 당길 수 있다', () => {
    expect(minimumDueDate(ORDER_DAY)).toBe('2026-08-06');
    expect(checkDueDate('2026-08-06', ORDER_DAY).selectable).toBe(true);
  });

  it('8월 5일은 너무 이르다', () => {
    expect(checkDueDate('2026-08-05', ORDER_DAY).selectable).toBe(false);
  });

  it('★ 밤늦게 넣어도 그날부터 센다 — 마감 시각이 따로 없다', () => {
    // 같은 날짜면 몇 시에 넣든 결과가 같습니다
    expect(defaultDueDate(ORDER_DAY)).toBe(defaultDueDate(ORDER_DAY));
  });
});

describe('최소 · 기본값', () => {
  it('★ 최소는 4번째 영업일', () => {
    expect(minimumDueDate(MONDAY)).toBe('2026-08-13');
  });

  it('★ 기본값은 5번째 영업일', () => {
    expect(defaultDueDate(MONDAY)).toBe('2026-08-14');
  });

  it('★ 기본값은 최소보다 뒤다 — 열자마자 경고가 뜨면 안 된다', () => {
    for (const today of ['2026-08-10', '2026-08-13', '2026-08-15', '2026-08-16']) {
      expect(defaultDueDate(today) > minimumDueDate(today)).toBe(true);
      expect(checkDueDate(defaultDueDate(today), today).selectable).toBe(true);
    }
  });
});

describe('고를 수 있는가', () => {
  it('★ 일요일은 못 고른다', () => {
    // 2026-08-23 은 일요일. 최소 납기(8/14)보다 뒤인데도 막힙니다
    expect(isSunday('2026-08-23')).toBe(true);

    const verdict = checkDueDate('2026-08-23', MONDAY);
    expect(verdict.selectable).toBe(false);
    expect(verdict.reason).toContain('일요일');
  });

  it('★ 토요일은 고를 수 있고 배송만 된다고 알려 준다', () => {
    expect(isSaturday('2026-08-22')).toBe(true);

    const verdict = checkDueDate('2026-08-22', MONDAY);
    expect(verdict.selectable).toBe(true);
    expect(verdict.note).toContain('배송만');
  });

  it('★ 최소 납기 이전은 못 고른다', () => {
    const verdict = checkDueDate('2026-08-12', MONDAY); // 수, 3일차
    expect(verdict.selectable).toBe(false);
    expect(verdict.reason).toContain('최소 납기');
  });

  it('최소 납기 당일은 고를 수 있다', () => {
    expect(checkDueDate('2026-08-13', MONDAY).selectable).toBe(true);
  });

  it('오늘도 못 고른다', () => {
    expect(checkDueDate(MONDAY, MONDAY).selectable).toBe(false);
  });
});

describe('달력', () => {
  it('언제나 42칸이다 — 격자가 흔들리지 않는다', () => {
    expect(buildCalendar(2026, 8, MONDAY)).toHaveLength(42);
    expect(buildCalendar(2026, 2, MONDAY)).toHaveLength(42);
  });

  it('★ 첫 칸은 일요일이다', () => {
    const cells = buildCalendar(2026, 8, MONDAY);
    expect(isSunday(cells[0].date)).toBe(true);
  });

  it('이번 달이 아닌 칸은 표시된다', () => {
    const cells = buildCalendar(2026, 8, MONDAY);
    const inMonth = cells.filter((c) => !c.outside);

    expect(inMonth).toHaveLength(31); // 8월은 31일
    expect(inMonth[0].day).toBe(1);
    expect(inMonth[30].day).toBe(31);
  });

  it('★ 달력 안의 일요일은 전부 막혀 있다', () => {
    const sundays = buildCalendar(2026, 9, MONDAY).filter((c) => isSunday(c.date));

    expect(sundays.length).toBeGreaterThan(0);
    expect(sundays.every((c) => !c.selectable)).toBe(true);
  });
});

describe('표시', () => {
  it('요일을 붙여 적는다', () => {
    expect(formatDueLabel('2026-08-14')).toBe('2026-08-14 (금)');
    expect(formatDueLabel('2026-08-17')).toBe('2026-08-17 (월)');
  });
});
