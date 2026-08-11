// =========================================================
// 놓을 위치: tests/domain/week.test.ts
// 기준: 시스템설계서 §4.1 (UTC 저장 · KST 표시), §9 배송조회
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  getWeekday,
  addDays,
  getWeekStart,
  getWeekDays,
  shiftWeek,
  isWeekend,
  isValidIsoDate,
  formatDayLabel,
  formatWeekRange,
  todayInKst,
} from '@/server/domain/week';

describe('요일', () => {
  it('2026-08-10 은 월요일이다', () => {
    expect(getWeekday('2026-08-10')).toBe(1);
  });

  it('일요일은 0 이다', () => {
    expect(getWeekday('2026-08-09')).toBe(0);
  });

  it('★ 토·일만 주말이다', () => {
    expect(isWeekend('2026-08-08')).toBe(true);  // 토
    expect(isWeekend('2026-08-09')).toBe(true);  // 일
    expect(isWeekend('2026-08-10')).toBe(false); // 월
  });
});

describe('날짜 더하기', () => {
  it('달을 넘어간다', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('해를 넘어간다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('뒤로도 간다', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('★ 윤년 2월을 안다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('주의 시작', () => {
  it('★ 주는 월요일에 시작한다', () => {
    expect(getWeekStart('2026-08-12')).toBe('2026-08-10'); // 수 → 월
    expect(getWeekStart('2026-08-10')).toBe('2026-08-10'); // 월 → 그대로
  });

  it('★ 일요일은 그 주의 마지막이다 (다음 주로 넘어가지 않는다)', () => {
    // 2026-08-16 은 일요일. 월요일은 8/10 이어야 합니다.
    expect(getWeekStart('2026-08-16')).toBe('2026-08-10');
  });

  // ★ 2026-08-12 에 일곱 칸에서 여섯 칸으로 줄였습니다.
  //   일요일에는 물건이 안 나가고 요청시한으로 고를 수도 없어,
  //   늘 비어 있는 칸이 나머지를 좁히고 있었습니다.
  it('주는 월요일로 시작해 토요일로 끝난다 (여섯 칸)', () => {
    const days = getWeekDays(getWeekStart('2026-08-13'));

    expect(days).toHaveLength(6);
    expect(getWeekday(days[0])).toBe(1); // 월
    expect(getWeekday(days[5])).toBe(6); // 토
    expect(days[0]).toBe('2026-08-10');
    expect(days[5]).toBe('2026-08-15');
  });

  it('주 이동은 7일 단위다', () => {
    expect(shiftWeek('2026-08-10', 1)).toBe('2026-08-17');
    expect(shiftWeek('2026-08-10', -1)).toBe('2026-08-03');
  });
});

describe('유효성', () => {
  it('없는 날짜는 거른다', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('20260810')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('있는 날짜는 통과시킨다', () => {
    expect(isValidIsoDate('2026-08-10')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
  });
});

describe('표시', () => {
  it('하루 이름', () => {
    expect(formatDayLabel('2026-08-10')).toBe('8/10 (월)');
  });

  it('같은 달이면 달을 한 번만 적는다', () => {
    expect(formatWeekRange('2026-08-10')).toBe('2026년 8월 10일 ~ 16일');
  });

  it('달을 넘어가면 둘 다 적는다', () => {
    expect(formatWeekRange('2026-08-31')).toBe('2026년 8월 31일 ~ 9월 6일');
  });
});

// ★ 서버가 UTC 에 있어도 화면의 '오늘'은 한국 날짜여야 합니다.
//   이걸 틀리면 한국 시간 오전 9시 이전에 하루 밀린 보드가 보입니다.
describe('오늘 (KST)', () => {
  it('★ UTC 로 전날 밤이어도 한국은 다음 날이다', () => {
    // 2026-08-09 20:00 UTC = 2026-08-10 05:00 KST
    const now = new Date('2026-08-09T20:00:00Z');
    expect(todayInKst(now)).toBe('2026-08-10');
  });

  it('UTC 로 같은 날 낮이면 한국도 같은 날이다', () => {
    const now = new Date('2026-08-10T03:00:00Z'); // 12:00 KST
    expect(todayInKst(now)).toBe('2026-08-10');
  });

  it('돌려주는 값은 그대로 다시 쓸 수 있는 모양이다', () => {
    expect(isValidIsoDate(todayInKst())).toBe(true);
  });
});

// =========================================================
// 배송조회는 월~토 여섯 칸입니다 (사용자 요청 2026-08-12)
// =========================================================

describe('배송조회 요일', () => {
  it('★ 월요일부터 여섯 칸이다 — 일요일은 없다', () => {
    const days = getWeekDays('2026-08-10'); // 월요일

    expect(days).toHaveLength(6);
    expect(days[0]).toBe('2026-08-10');
    expect(days[5]).toBe('2026-08-15'); // 토요일
    expect(days).not.toContain('2026-08-16'); // 일요일
  });

  it('일요일에 열어도 지난 월요일부터 본다', () => {
    const start = getWeekStart('2026-08-16'); // 일요일

    expect(start).toBe('2026-08-10');
    expect(getWeekDays(start)).toHaveLength(6);
  });
});
