// =========================================================
// 놓을 위치: src/server/domain/holiday/index.ts
//
// 공휴일. (사용자 요청 2026-08-12 — "매해마다 빨간날은 자동기입",
// "임시공휴일 같은 휴일을 추가 입력할수 있는 칸")
//
// ★ 자동으로 채우는 것은 **제안**입니다. 마지막 말은 사람이 합니다.
//   양력 공휴일은 규칙이라 어느 해든 셀 수 있지만,
//   설날·부처님오신날·추석은 **음력**이라 셈으로 안 나옵니다 —
//   음력 달력 표가 통째로 있어야 합니다. 아래 LUNAR 에 아는 해만
//   적어 두고, 모르는 해는 '모른다' 고 말합니다.
//   **없는 날짜를 지어내면 그 해 요청시한이 전부 어긋납니다.**
//
// ★ 임시공휴일은 애초에 셈으로 안 나옵니다.
//   선거일·국가장·기념일은 그때 정해집니다. 손으로 넣는 칸이 규칙보다
//   먼저입니다 — 자동 채우기는 그 위에 얹는 편의일 뿐입니다.
//
// ★ 여기서 만든 날은 전부 고치고 지울 수 있어야 합니다.
//   대체공휴일 규칙은 법이 바뀌고, 음력 표는 제가 틀릴 수 있습니다.
//   화면이 '자동' 딱지를 달아 두는 이유입니다.
// =========================================================

import { addDays, getWeekday, type IsoDate } from '../week';

/** 날짜 → 이름. 요청시한 계산이 이 모양으로 받습니다 */
export type HolidayMap = Record<string, string>;

export interface HolidaySeed {
  date: IsoDate;
  name: string;
}

/** 대체공휴일을 어떻게 붙이는가 */
type SubstituteRule =
  | 'none' // 신정 · 현충일
  | 'weekend' // 토·일과 겹치면
  | 'sunday_or_overlap'; // 설날 · 추석 · 어린이날 — 일요일이거나 다른 공휴일과 겹치면

interface FixedHoliday {
  month: number;
  day: number;
  name: string;
  rule: SubstituteRule;
}

/** 해마다 같은 날 — 셈이 필요 없습니다 */
const FIXED: FixedHoliday[] = [
  { month: 1, day: 1, name: '신정', rule: 'none' },
  { month: 3, day: 1, name: '삼일절', rule: 'weekend' },
  { month: 5, day: 5, name: '어린이날', rule: 'sunday_or_overlap' },
  { month: 6, day: 6, name: '현충일', rule: 'none' },
  { month: 8, day: 15, name: '광복절', rule: 'weekend' },
  { month: 10, day: 3, name: '개천절', rule: 'weekend' },
  { month: 10, day: 9, name: '한글날', rule: 'weekend' },
  { month: 12, day: 25, name: '성탄절', rule: 'weekend' },
];

/**
 * 음력에서 오는 날들. **셈이 아니라 표입니다.**
 *
 *   seollal — 설날 당일(음력 1월 1일). 연휴는 그 앞뒤 하루씩 사흘
 *   buddha  — 부처님오신날(음력 4월 8일)
 *   chuseok — 추석 당일(음력 8월 15일). 연휴는 그 앞뒤 하루씩 사흘
 *
 * ★ 여기 없는 해는 자동으로 못 채웁니다. 화면이 그렇게 말합니다.
 *   해를 늘리려면 이 표에 줄을 더하면 됩니다 (코드는 안 고쳐도 됩니다).
 */
const LUNAR: Record<number, { seollal: IsoDate; buddha: IsoDate; chuseok: IsoDate }> = {
  2025: { seollal: '2025-01-29', buddha: '2025-05-05', chuseok: '2025-10-06' },
  2026: { seollal: '2026-02-17', buddha: '2026-05-24', chuseok: '2026-09-25' },
  2027: { seollal: '2027-02-07', buddha: '2027-05-13', chuseok: '2027-09-15' },
  2028: { seollal: '2028-01-27', buddha: '2028-05-02', chuseok: '2028-10-03' },
  2029: { seollal: '2029-02-13', buddha: '2029-05-20', chuseok: '2029-09-22' },
  2030: { seollal: '2030-02-03', buddha: '2030-05-09', chuseok: '2030-09-12' },
};

/** 음력 명절을 아는 해 */
export const LUNAR_YEARS = Object.keys(LUNAR).map(Number).sort();

export function knowsLunar(year: number): boolean {
  return year in LUNAR;
}

export interface GeneratedHolidays {
  rows: HolidaySeed[];
  /** 설날·추석·부처님오신날을 채웠는가. false 면 양력만 나옵니다 */
  lunarKnown: boolean;
}

/**
 * 그 해의 빨간날.
 *
 * ★ 음력을 모르는 해도 **양력은 채웁니다.**
 *   전부 아니면 전무로 두면, 2031년에 삼일절·광복절까지 손으로 넣게
 *   됩니다. 아는 만큼 채우고 모르는 것만 말하는 편이 낫습니다.
 */
export function generateHolidays(year: number): GeneratedHolidays {
  const named = new Map<IsoDate, string>();
  const rules: { date: IsoDate; rule: SubstituteRule }[] = [];

  const put = (date: IsoDate, name: string, rule: SubstituteRule) => {
    // 겹치는 날은 이름을 잇습니다 (2028년 추석과 개천절이 같은 날입니다)
    const before = named.get(date);
    named.set(date, before && before !== name ? `${before} · ${name}` : name);
    rules.push({ date, rule });
  };

  for (const h of FIXED) {
    put(iso(year, h.month, h.day), h.name, h.rule);
  }

  const lunar = LUNAR[year];

  if (lunar) {
    // 설날·추석은 당일 앞뒤로 하루씩, 사흘입니다
    for (const offset of [-1, 0, 1]) {
      put(addDays(lunar.seollal, offset), '설날', 'sunday_or_overlap');
      put(addDays(lunar.chuseok, offset), '추석', 'sunday_or_overlap');
    }
    put(lunar.buddha, '부처님오신날', 'weekend');
  }

  addSubstitutes(named, rules);

  const rows = [...named.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { rows, lunarKnown: Boolean(lunar) };
}

/**
 * 대체공휴일.
 *
 *   설날·추석·어린이날 — 일요일이거나 다른 공휴일과 겹치면
 *   그 밖(삼일절·광복절·개천절·한글날·부처님오신날·성탄절) — 토·일과 겹치면
 *   신정·현충일 — 없음
 *
 * ★ 하루에 하나만 붙습니다.
 *   설 연휴 사흘 중 두 날이 각각 규칙에 걸려도, 대체휴일이 두 개 생기면
 *   실제와 달라집니다. 같은 이름은 한 번만 셉니다.
 *
 * ★ 법이 바뀝니다.
 *   성탄절·부처님오신날이 목록에 들어온 것도 2023년입니다.
 *   그래서 여기서 만든 날도 지울 수 있게 두었습니다.
 */
function addSubstitutes(
  named: Map<IsoDate, string>,
  rules: { date: IsoDate; rule: SubstituteRule }[],
) {
  const base = new Set(named.keys());
  const done = new Set<string>();
  const extra: { date: IsoDate; name: string }[] = [];

  for (const { date, rule } of rules) {
    if (rule === 'none') continue;

    const weekday = getWeekday(date);
    const name = named.get(date) ?? '';

    // 같은 이름(설 연휴 사흘)에는 대체휴일을 한 번만 붙입니다
    if (done.has(name)) continue;

    const triggered =
      rule === 'weekend'
        ? weekday === 0 || weekday === 6
        : weekday === 0 || name.includes(' · ');

    if (!triggered) continue;

    // 공휴일도 일요일도 아닌 첫 날로 밉니다
    let next = addDays(date, 1);
    let guard = 0;

    while ((base.has(next) || getWeekday(next) === 0) && guard < 14) {
      next = addDays(next, 1);
      guard++;
    }

    if (base.has(next)) continue;

    base.add(next);
    done.add(name);
    extra.push({ date: next, name: `대체공휴일 (${name.split(' · ')[0]})` });
  }

  for (const row of extra) {
    if (!named.has(row.date)) named.set(row.date, row.name);
  }
}

function iso(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ---------- 손으로 넣는 칸 ----------

export const MAX_HOLIDAY_NAME = 30;

export type HolidayVerdict = { ok: true } | { ok: false; reason: string };

/**
 * 손으로 넣는 휴일 한 줄이 쓸 만한가.
 *
 * ★ 이름을 꼭 받습니다.
 *   달력에 빨간 칸만 있고 이름이 없으면, 몇 달 뒤에 아무도 왜 쉬는지
 *   모릅니다 — 잘못 넣은 날인지 진짜 휴일인지 가릴 수가 없습니다.
 */
export function checkHoliday(date: string, name: string): HolidayVerdict {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, reason: '날짜를 골라 주세요' };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: '무슨 날인지 적어 주세요' };
  if (trimmed.length > MAX_HOLIDAY_NAME) {
    return { ok: false, reason: `이름은 ${MAX_HOLIDAY_NAME}자까지입니다` };
  }

  return { ok: true };
}

/** 표를 요청시한 계산이 쓰는 모양으로 */
export function toHolidayMap(rows: HolidaySeed[]): HolidayMap {
  const map: HolidayMap = {};
  for (const row of rows) map[row.date] = row.name;

  return map;
}
