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
// ★ 영업일은 토·일과 **공휴일**을 뺀 날입니다 (2026-08-12).
//   공휴일 목록은 셈으로 안 나옵니다 — 설·추석이 음력이고 임시공휴일은
//   그때 정해집니다. 그래서 표를 **받아서** 씁니다 (domain/holiday 가 만들고
//   디자인센터가 고칩니다). 이 파일은 여전히 아무것도 안 읽습니다.
//
// ★ 공휴일을 안 넘기면 예전 그대로 굴러갑니다 (기본값 {}).
//   표를 못 읽는 자리(옛 호출부)가 있어도 화면이 죽지 않습니다 —
//   대신 그 자리는 공휴일을 모릅니다.
//
// ★ 이 파일은 Next.js 도 Supabase 도 모릅니다. 문자열 날짜만 다룹니다.
// =========================================================

import { addDays, getWeekday, type IsoDate } from '../week';
import type { HolidayMap } from '../holiday';

/**
 * N번째 영업일. 토·일은 세지 않습니다.
 *
 * ★ 주문한 날이 1일차입니다. 주말에 주문했다면 다음 영업일이 1일차가 됩니다.
 */
export function nthBusinessDay(from: IsoDate, n: number, holidays: HolidayMap = {}): IsoDate {
  let date = from;
  let count = isOffDay(date, holidays) ? 0 : 1;
  let guard = 0;

  // 표가 잘못 채워져 한 해가 통째로 휴일이어도 멈추지 않게 합니다
  while (count < n && guard < 400) {
    date = addDays(date, 1);
    guard++;
    if (!isOffDay(date, holidays)) count++;
  }

  return date;
}

/** 일 못 하는 날 — 토·일과 공휴일 */
function isOffDay(date: IsoDate, holidays: HolidayMap): boolean {
  const day = getWeekday(date);
  return day === 0 || day === 6 || date in holidays;
}

export function isSunday(date: IsoDate): boolean {
  return getWeekday(date) === 0;
}

export function isSaturday(date: IsoDate): boolean {
  return getWeekday(date) === 6;
}

/**
 * 누가 고르느냐에 따라 가장 이른 날이 다릅니다. (사용자 결정 2026-08-12)
 *
 *   standard  치과 — 4번째 영업일. 만들 시간이 필요합니다
 *   free      디자인센터 — 오늘부터. 전화로 들어오는 건은 사정이 다릅니다
 *
 * ★ 디자인센터를 푸는 이유.
 *   전화로 들어오는 주문에는 이미 약속된 날짜가 있습니다.
 *   "내일까지 해 주기로 했다" 는 건을 대신 넣는데 화면이 4영업일을
 *   강요하면, 실제와 다른 날짜를 적게 됩니다 — 그러면 그 날짜로 돌아가는
 *   D-day·배송조회·정산 예상이 전부 어긋납니다.
 *   무리한 일정인지는 일정을 쥔 사람이 판단할 일입니다.
 *
 * ★ 일요일은 둘 다 막힙니다.
 *   납기가 아니라 배송의 문제입니다. 일요일에는 물건이 안 나갑니다.
 */
export type DueDatePolicy = 'standard' | 'free';

/** 고를 수 있는 가장 이른 날 */
export function minimumDueDate(
  today: IsoDate,
  policy: DueDatePolicy = 'standard',
  holidays: HolidayMap = {},
): IsoDate {
  return policy === 'free' ? today : nthBusinessDay(today, 4, holidays);
}

/**
 * 주문등록을 열었을 때 미리 맞춰져 있는 날 — 5번째 영업일.
 *
 * ★ 그날이 공휴일이면 다음 고를 수 있는 날로 넘깁니다.
 *   5영업일째가 임시공휴일일 수 있습니다 — 영업일 셈에서는 빠졌는데
 *   결과가 그 날이 되는 일은 없지만, 표가 나중에 바뀌면 생깁니다.
 */
export function defaultDueDate(today: IsoDate, holidays: HolidayMap = {}): IsoDate {
  let date = nthBusinessDay(today, 5, holidays);
  let guard = 0;

  while ((isSunday(date) || date in holidays) && guard < 30) {
    date = addDays(date, 1);
    guard++;
  }

  return date;
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
export function checkDueDate(
  date: IsoDate,
  today: IsoDate,
  policy: DueDatePolicy = 'standard',
  holidays: HolidayMap = {},
): DueDateVerdict {
  if (isSunday(date)) {
    return { selectable: false, reason: '일요일은 고를 수 없습니다' };
  }

  /*
    ★ 공휴일도 못 고릅니다. 일요일과 같은 이유입니다 — 물건이 안 나갑니다.
      이름을 함께 돌려줍니다: '고를 수 없습니다' 보다 '추석' 이 훨씬
      알아듣기 쉽습니다.
  */
  const holiday = holidays[date];
  if (holiday) {
    return { selectable: false, reason: `${holiday} — 쉬는 날입니다` };
  }

  const minimum = minimumDueDate(today, policy, holidays);
  if (date < minimum) {
    return {
      selectable: false,
      reason:
        policy === 'free' ? '지난 날짜는 고를 수 없습니다' : `최소 납기는 ${minimum} 입니다`,
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
  /** 공휴일이면 그 이름. 달력 칸에 작게 찍습니다 */
  holiday?: string;
}

/**
 * 한 달치 달력을 만듭니다. 일요일로 시작하는 7칸 × 6줄입니다.
 * 앞뒤로 남는 칸은 이웃 달 날짜로 채워 격자가 깨지지 않게 합니다.
 */
export function buildCalendar(
  year: number,
  month: number,
  today: IsoDate,
  policy: DueDatePolicy = 'standard',
  holidays: HolidayMap = {},
): CalendarCell[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const start = addDays(first, -getWeekday(first)); // 그 주 일요일까지 되돌립니다

  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    const verdict = checkDueDate(date, today, policy, holidays);

    return {
      date,
      day: Number(date.slice(8, 10)),
      outside: Number(date.slice(5, 7)) !== month,
      selectable: verdict.selectable,
      reason: verdict.reason,
      note: verdict.note,
      holiday: holidays[date],
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
