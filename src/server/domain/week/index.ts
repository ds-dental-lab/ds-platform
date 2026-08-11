// =========================================================
// 놓을 위치: src/server/domain/week/index.ts
//
// 주간 보드의 날짜 계산. (설계서 §9 배송조회)
//
// ★ 이 파일은 Next.js 도 Supabase 도 모릅니다.
//   Date 객체를 쓰지 않고 'YYYY-MM-DD' 문자열만 다룹니다.
//
//   왜 문자열인가 — orders.due_date 는 시간이 없는 date 컬럼입니다.
//   Date 로 바꾸면 서버 시간대에 따라 하루가 밀립니다.
//   (UTC 서버에서 '2026-08-10' 을 Date 로 만들면 KST 로는 9일 오전이 됩니다)
// =========================================================

export type IsoDate = string; // 'YYYY-MM-DD'

export const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'] as const;

// ---------- 문자열 ↔ 일련번호 ----------
// 날짜 계산은 "1970-01-01 로부터 며칠"로 바꿔서 합니다.
// 시·분·초가 끼어들 자리가 없어 시간대 문제가 생기지 않습니다.

function toDayNumber(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromDayNumber(days: number): IsoDate {
  const ms = days * 86_400_000;
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 0 = 일요일 … 6 = 토요일 */
export function getWeekday(date: IsoDate): number {
  // 1970-01-01 은 목요일(4)이었습니다
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromDayNumber(toDayNumber(value)) === value;
}

// ---------- 주 ----------

/** 그 날짜가 속한 주의 월요일. 주는 월요일에 시작합니다 */
export function getWeekStart(date: IsoDate): IsoDate {
  const weekday = getWeekday(date);
  // 일요일(0)은 지난 월요일로 6일 되돌립니다
  const backToMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(date, -backToMonday);
}

/**
 * 배송조회에 세우는 요일. **월~토 여섯 칸**입니다. (사용자 요청)
 *
 * ★ 일요일은 뺍니다.
 *   일요일에는 물건이 안 나갑니다. 요청시한으로 고를 수도 없습니다
 *   (domain/due-date 가 막습니다). 늘 비어 있는 칸이 하나 서 있으면
 *   나머지 여섯 칸이 그만큼 좁아집니다.
 *
 * ★ 주의 시작은 그대로 월요일입니다.
 *   getWeekStart 는 일요일도 지난 월요일로 당깁니다 — 일요일에 열어도
 *   '지난 한 주' 가 보입니다.
 */
export const DELIVERY_DAYS = 6;

export function getWeekDays(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: DELIVERY_DAYS }, (_, i) => addDays(weekStart, i));
}

export function shiftWeek(weekStart: IsoDate, weeks: number): IsoDate {
  return addDays(weekStart, weeks * 7);
}

// ---------- 표시 ----------

/** '8/10 (월)' */
export function formatDayLabel(date: IsoDate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d} (${WEEKDAY_LABEL[getWeekday(date)]})`;
}

/** '2026년 8월 10일 ~ 16일' */
export function formatWeekRange(weekStart: IsoDate): string {
  const end = addDays(weekStart, 6);
  const [sy, sm, sd] = weekStart.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);

  if (sy === ey && sm === em) return `${sy}년 ${sm}월 ${sd}일 ~ ${ed}일`;
  if (sy === ey) return `${sy}년 ${sm}월 ${sd}일 ~ ${em}월 ${ed}일`;
  return `${sy}년 ${sm}월 ${sd}일 ~ ${ey}년 ${em}월 ${ed}일`;
}

/** 주말인가. 토·일은 옅게 그립니다 */
export function isWeekend(date: IsoDate): boolean {
  const weekday = getWeekday(date);
  return weekday === 0 || weekday === 6;
}

// ---------- 오늘 (KST) ----------

/**
 * 서버가 어느 시간대에 있든 한국 날짜를 돌려줍니다.
 * 화면의 '오늘'은 사용자 기준이어야 합니다. (설계서 §4.1 표시 시점에 KST 변환)
 */
export function todayInKst(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
