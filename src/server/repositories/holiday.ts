// =========================================================
// 놓을 위치: src/server/repositories/holiday.ts
//
// 쉬는 날 조회. 요청시한 달력이 이것으로 그려집니다.
//
// ★ 세 섹터가 모두 읽습니다 (RLS holiday_select).
//   치과가 못 읽으면 쉬는 날인 줄 모르고 골라 버립니다.
//
// ★ 요청시한 계산에는 **앞뒤 한 해씩** 넉넉히 실어 보냅니다.
//   12월 말에 주문하면 1월 초가 나옵니다. 올해만 실으면 그 며칠이
//   공휴일인지 모르는 채로 셈합니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { todayInKst } from '@/server/domain/week';
import type { HolidayMap } from '@/server/domain/holiday';

export interface HolidayRow {
  id: string;
  date: string;
  name: string;
  source: 'auto' | 'manual';
}

/** 요청시한이 쓰는 모양 — 올해 앞뒤로 한 해씩 */
export async function getHolidayMap(): Promise<HolidayMap> {
  const year = Number(todayInKst().slice(0, 4));

  return mapOf(await listHolidays(year - 1, year + 1));
}

/** 한 해(또는 몇 해)의 줄 전부. 관리 화면이 씁니다 */
export async function listHolidays(fromYear: number, toYear: number): Promise<HolidayRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('holidays')
    .select('id, date, name, source')
    .gte('date', `${fromYear}-01-01`)
    .lte('date', `${toYear}-12-31`)
    .order('date');

  if (error || !data) return [];

  return data as unknown as HolidayRow[];
}

export function mapOf(rows: HolidayRow[]): HolidayMap {
  const map: HolidayMap = {};
  for (const row of rows) map[row.date] = row.name;

  return map;
}

/** 어느 해에 몇 개나 들어 있는지 — 관리 화면의 연도 고르개가 씁니다 */
export async function countByYear(): Promise<Record<number, number>> {
  const supabase = await createClient();

  const { data } = await supabase.from('holidays').select('date');

  const counts: Record<number, number> = {};
  for (const row of (data ?? []) as { date: string }[]) {
    const year = Number(row.date.slice(0, 4));
    counts[year] = (counts[year] ?? 0) + 1;
  }

  return counts;
}
