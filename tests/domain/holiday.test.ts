// =========================================================
// 놓을 위치: tests/domain/holiday.test.ts
// 기준: 사용자 요청 2026-08-12 — 빨간날 자동기입 + 임시공휴일 손입력
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  generateHolidays,
  knowsLunar,
  checkHoliday,
  toHolidayMap,
  MAX_HOLIDAY_NAME,
} from '@/server/domain/holiday';

const dates = (year: number) => generateHolidays(year).rows.map((r) => r.date);
const nameOf = (year: number, date: string) =>
  generateHolidays(year).rows.find((r) => r.date === date)?.name;

describe('양력 공휴일', () => {
  it('어느 해든 여덟 개는 나옵니다', () => {
    for (const year of [2026, 2031, 2044]) {
      for (const md of ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25']) {
        expect(dates(year)).toContain(`${year}-${md}`);
      }
    }
  });

  // ★ 전부 아니면 전무로 두면 2031년에 삼일절까지 손으로 넣게 됩니다
  it('★ 음력을 모르는 해도 양력은 채웁니다', () => {
    const { rows, lunarKnown } = generateHolidays(2031);

    expect(lunarKnown).toBe(false);
    expect(knowsLunar(2031)).toBe(false);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.name)).toContain('신정');
    expect(rows.map((r) => r.name)).not.toContain('설날');
  });
});

describe('음력 명절', () => {
  it('설날·추석은 사흘입니다', () => {
    const seollal = generateHolidays(2026).rows.filter((r) => r.name === '설날');
    const chuseok = generateHolidays(2026).rows.filter((r) => r.name === '추석');

    expect(seollal.map((r) => r.date)).toEqual(['2026-02-16', '2026-02-17', '2026-02-18']);
    expect(chuseok.map((r) => r.date)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26']);
  });

  it('부처님오신날이 들어갑니다', () => {
    expect(nameOf(2026, '2026-05-24')).toBe('부처님오신날');
  });
});

describe('대체공휴일', () => {
  it('토·일과 겹치면 다음 평일로 밉니다', () => {
    // 2026-03-01 은 일요일
    expect(nameOf(2026, '2026-03-02')).toBe('대체공휴일 (삼일절)');
    // 2026-08-15 는 토요일
    expect(nameOf(2026, '2026-08-17')).toBe('대체공휴일 (광복절)');
  });

  // 2026-10-03(토) → 10-04 는 일요일이라 건너뜁니다
  it('밀린 자리가 일요일이면 더 밉니다', () => {
    expect(dates(2026)).not.toContain('2026-10-04');
    expect(nameOf(2026, '2026-10-05')).toBe('대체공휴일 (개천절)');
  });

  // ★ 연휴 사흘에 대체휴일이 둘 생기면 실제와 달라집니다
  it('★ 설 연휴에는 대체휴일이 하나만 붙습니다', () => {
    // 2027 설날 02-06(토) · 02-07(일) · 02-08(월)
    const extra = generateHolidays(2027).rows.filter((r) => r.name.includes('설날') && r.name.startsWith('대체'));

    expect(extra).toHaveLength(1);
    expect(extra[0].date).toBe('2027-02-09');
  });

  it('신정과 현충일에는 안 붙습니다', () => {
    // 2028-01-01 은 토요일, 2027-06-06 은 일요일
    expect(generateHolidays(2028).rows.some((r) => r.name.includes('신정') && r.name.startsWith('대체'))).toBe(false);
    expect(generateHolidays(2027).rows.some((r) => r.name.includes('현충일') && r.name.startsWith('대체'))).toBe(false);
  });

  it('같은 날에 두 공휴일이 겹치면 이름을 잇습니다', () => {
    // 2028 추석 당일이 개천절입니다
    expect(nameOf(2028, '2028-10-03')).toBe('개천절 · 추석');
  });

  it('겹친 날에는 대체휴일이 붙습니다', () => {
    expect(dates(2028)).toContain('2028-10-05');
  });
});

describe('같은 날이 두 번 안 나옵니다', () => {
  it('어느 해든 날짜가 겹치지 않습니다', () => {
    for (const year of [2025, 2026, 2027, 2028, 2029, 2030, 2031]) {
      const list = dates(year);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('차례가 날짜순입니다', () => {
    const list = dates(2027);
    expect([...list].sort()).toEqual(list);
  });
});

describe('손으로 넣는 휴일', () => {
  it('날짜와 이름이 있으면 통과', () => {
    expect(checkHoliday('2026-09-01', '임시공휴일')).toEqual({ ok: true });
  });

  // ★ 이름 없는 빨간 칸은 몇 달 뒤에 아무도 왜 쉬는지 모릅니다
  it('★ 이름을 꼭 받습니다', () => {
    expect(checkHoliday('2026-09-01', '  ')).toEqual({ ok: false, reason: '무슨 날인지 적어 주세요' });
  });

  it('날짜 모양을 봅니다', () => {
    expect(checkHoliday('2026-9-1', '임시').ok).toBe(false);
    expect(checkHoliday('', '임시').ok).toBe(false);
  });

  it('이름 길이를 막습니다', () => {
    expect(checkHoliday('2026-09-01', '가'.repeat(MAX_HOLIDAY_NAME + 1)).ok).toBe(false);
  });
});

describe('요청시한이 쓰는 모양', () => {
  it('날짜에서 이름을 찾습니다', () => {
    const map = toHolidayMap(generateHolidays(2026).rows);

    expect(map['2026-09-25']).toBe('추석');
    expect(map['2026-09-23']).toBeUndefined();
  });
});
