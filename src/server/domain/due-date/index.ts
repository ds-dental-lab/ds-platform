// =========================================================
// 놓을 위치: src/server/domain/due-date/index.ts
//
// 요청시한 선택 규칙. (기능명세서 §4.2.1, 시안 요청시한 캘린더)
//
// 규칙
//   ★ 주문한 날이 영업일 1일차입니다.
//     그날 밤 11시 59분에 넣어도 그날부터 셉니다 — 마감 시각을 따로 두지 않습니다.
//
//   최소   — 4번째 영업일
//   기본값 — 5번째 영업일. 주문등록을 열면 여기에 맞춰져 있습니다
//
//   예) 8월 3일(월)에 주문하면 — 월 1, 화 2, 수 3, 목 4, 금 5
//       기본값은 8월 7일(금), 8월 6일(목)까지 당길 수 있습니다
//
//   일요일 — 고를 수 없습니다
//   토요일 — 고를 수 있지만 배송만 됩니다 (제작은 하지 않습니다)
//
// ★ 영업일은 토·일을 뺀 날입니다. 공휴일은 아직 다루지 않습니다.
//   한국 공휴일은 대체공휴일 때문에 해마다 달라져서 목록을 따로 관리해야 합니다.
//   지금은 일요일만 막고, 공휴일 표가 생기면 isBlocked 에 조건만 더합니다.
//
// ★ 이 파일은 Next.js 도 Supabase 도 모릅니다. 문자열 날짜만 다룹니다.
// =========================================================

import { addDays, getWeekday, type IsoDate } from '../week';

/**
 * N번째 영업일. 토·일은 세지 않습니다.
 *
 * ★ 주문한 날이 1일차입니다. 주말에 주문했다면 다음 영업일이 1일차가 됩니다.
 */
export function nthBusinessDay(from: IsoDate, n: number): IsoDate {
  let date = from;
  let count = isWeekend(date) ? 0 : 1;

  while (count < n) {
    date = addDays(date, 1);
    if (!isWeekend(date)) count++;
  }

  return date;
}

function isWeekend(date: IsoDate): boolean {
  const day = getWeekday(date);
  return day === 0 || day === 6;
}

export function isSunday(date: IsoDate): boolean {
  return getWeekday(date) === 0;
}

export function isSaturday(date: IsoDate): boolean {
  return getWeekday(date) === 6;
}

/** 고를 수 있는 가장 이른 날 — 4번째 영업일 */
export function minimumDueDate(today: IsoDate): IsoDate {
  return nthBusinessDay(today, 4);
}

/** 주문등록을 열었을 때 미리 맞춰져 있는 날 — 5번째 영업일 */
export function defaultDueDate(today: IsoDate): IsoDate {
  return nthBusinessDay(today, 5);
}

export interface DueDateVerdict {
  selectable: boolean;
  /** 왜 못 고르는지. 고를 수 있으면 없습니다 */
  reason?: string;
  /** 고를 수는 있지만 알려 줄 것이 있으면 */
  note?: string;
}

/**
 * 이 날짜를 요청시한으로 쓸 수 있는가.
 *
 * ★ 화면에서 흐리게 만드는 것만으로는 부족합니다.
 *   저장할 때도 같은 함수로 다시 검사합니다. (설계서 §5.3 결정 2)
 */
export function checkDueDate(date: IsoDate, today: IsoDate): DueDateVerdict {
  if (isSunday(date)) {
    return { selectable: false, reason: '일요일은 고를 수 없습니다' };
  }

  const minimum = minimumDueDate(today);
  if (date < minimum) {
    return {
      selectable: false,
      reason: `최소 납기는 ${minimum} 입니다`,
    };
  }

  if (isSaturday(date)) {
    return { selectable: true, note: '토요일은 배송만 가능합니다' };
  }

  return { selectable: true };
}

// ---------- 캘린더 ----------

export interface CalendarCell {
  date: IsoDate;
  day: number;
  /** 이번 달이 아닌 앞뒤 칸 */
  outside: boolean;
  selectable: boolean;
  reason?: string;
  note?: string;
}

/**
 * 한 달치 달력을 만듭니다. 일요일로 시작하는 7칸 × 6줄입니다.
 * 앞뒤로 남는 칸은 이웃 달 날짜로 채워 격자가 깨지지 않게 합니다.
 */
export function buildCalendar(year: number, month: number, today: IsoDate): CalendarCell[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const start = addDays(first, -getWeekday(first)); // 그 주 일요일까지 되돌립니다

  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    const verdict = checkDueDate(date, today);

    return {
      date,
      day: Number(date.slice(8, 10)),
      outside: Number(date.slice(5, 7)) !== month,
      selectable: verdict.selectable,
      reason: verdict.reason,
      note: verdict.note,
    };
  });
}

/** '2026년 8월' */
export function formatMonthTitle(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

/** '2026-08-14 (금)' — 버튼에 찍는 글자 */
export function formatDueLabel(date: IsoDate): string {
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date} (${names[getWeekday(date)]})`;
}
