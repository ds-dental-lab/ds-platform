// =========================================================
// 놓을 위치: src/server/actions/holiday.ts
//
// 휴일 자동 채우기 · 손입력 · 고치기 · 지우기. 디자인센터만입니다.
//
// ★ 자동 채우기는 **덮어쓰지 않습니다.**
//   이미 있는 날은 건드리지 않고 빠진 날만 넣습니다. 사람이 고쳐 둔
//   이름("추석 연휴 — 배송 없음")을 자동이 도로 '추석' 으로 되돌리면,
//   두 번 다시 자동 채우기를 안 누르게 됩니다.
//
// ★ 몇 개를 넣었는지 돌려줍니다.
//   "채웠습니다" 만 뜨면 이미 다 있었는지 새로 들어갔는지 알 수 없습니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { generateHolidays, checkHoliday } from '@/server/domain/holiday';

type Guard =
  | { ok: true; orgId: string; userId: string }
  | { ok: false; error: string };

async function requireDesignCenter(): Promise<Guard> {
  const session = await getSession();

  if (!session?.orgId || session.orgType !== 'design_center') {
    return { ok: false, error: '휴일은 디자인센터만 고칠 수 있습니다' };
  }

  return { ok: true, orgId: session.orgId, userId: session.user.id };
}

export type FillResult =
  | { ok: true; added: number; skipped: number; lunarKnown: boolean }
  | { ok: false; error: string };

/** 그 해 빨간날을 채웁니다. 이미 있는 날은 그대로 둡니다 */
export async function fillYearHolidays(year: number): Promise<FillResult> {
  const guard = await requireDesignCenter();
  if (!guard.ok) return guard;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, error: '연도가 이상합니다' };
  }

  const { rows, lunarKnown } = generateHolidays(year);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('holidays')
    .select('date')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);

  const have = new Set(((existing ?? []) as { date: string }[]).map((r) => r.date));
  const fresh = rows.filter((r) => !have.has(r.date));

  if (fresh.length > 0) {
    const { error } = await supabase.from('holidays').insert(
      fresh.map((r) => ({
        org_id: guard.orgId,
        date: r.date,
        name: r.name,
        source: 'auto',
        created_by: guard.userId,
      })),
    );

    if (error) return { ok: false, error: `채우지 못했습니다: ${error.message}` };
  }

  revalidateEverywhere();

  return { ok: true, added: fresh.length, skipped: rows.length - fresh.length, lunarKnown };
}

export type HolidayResult = { ok: true } | { ok: false; error: string };

export interface HolidayInput {
  id?: string;
  date: string;
  name: string;
}

/**
 * 손으로 넣거나 고칩니다.
 *
 * ★ 고치면 source 가 'manual' 이 됩니다.
 *   사람이 손댄 줄은 더 이상 '자동이 넣은 것' 이 아닙니다. 딱지가 그대로면
 *   다음에 누가 "자동이니 지워도 되겠지" 하고 지웁니다.
 */
export async function submitHoliday(input: HolidayInput): Promise<HolidayResult> {
  const guard = await requireDesignCenter();
  if (!guard.ok) return guard;

  const verdict = checkHoliday(input.date, input.name);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createClient();
  const fields = { date: input.date, name: input.name.trim(), source: 'manual' as const };

  if (input.id) {
    const { data, error } = await supabase
      .from('holidays')
      .update(fields)
      .eq('id', input.id)
      .select('id');

    if (error) return { ok: false, error: message(error.message) };
    if (!data || data.length === 0) return { ok: false, error: '고칠 수 있는 휴일이 아닙니다' };
  } else {
    const { error } = await supabase
      .from('holidays')
      .insert({ ...fields, org_id: guard.orgId, created_by: guard.userId });

    if (error) return { ok: false, error: message(error.message) };
  }

  revalidateEverywhere();

  return { ok: true };
}

export async function removeHoliday(id: string): Promise<HolidayResult> {
  const guard = await requireDesignCenter();
  if (!guard.ok) return guard;

  const supabase = await createClient();

  /*
    ★ 여기서는 진짜로 지웁니다 (공지와 다릅니다).
      잘못 넣은 휴일이 남아 있으면 요청시한을 계속 틀리게 만듭니다.
  */
  const { data, error } = await supabase.from('holidays').delete().eq('id', id).select('id');

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '지울 수 있는 휴일이 아닙니다' };

  revalidateEverywhere();

  return { ok: true };
}

/** 하루에 한 줄이라 같은 날을 또 넣으면 DB 가 막습니다 — 사람 말로 바꿔 줍니다 */
function message(raw: string): string {
  return raw.includes('duplicate') || raw.includes('unique')
    ? '그날은 이미 휴일로 들어 있습니다'
    : `저장하지 못했습니다: ${raw}`;
}

/** 요청시한 달력이 세 섹터 모두에서 그려집니다 */
function revalidateEverywhere() {
  for (const path of ['/design', '/clinic', '/lab']) revalidatePath(path, 'layout');
}
