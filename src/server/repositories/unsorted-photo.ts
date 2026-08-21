// =========================================================
// 놓을 위치: src/server/repositories/unsorted-photo.ts
//
// 미분류함을 읽습니다. (명세서 SPEC_shade-photo S6)
//
// ★ 묶음(session_id) 단위로 셉니다. 매칭도 묶음 단위입니다 —
//   한 환자를 세 장 찍었으면 세 장이 같이 갑니다.
// =========================================================

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { groupUnsorted, type UnsortedBox } from '@/server/domain/shade-photo';

export type { UnsortedBox };

/**
 * 아직 안 붙은 묶음들. 최근 것이 위로.
 *
 * ★ 못 올라간 장(pending·failed)은 안 셉니다. 저장소에 없는 것을
 *   "n장 있음" 이라고 하면, 붙이려 할 때 아무것도 안 옮겨집니다.
 */
export async function listUnsortedBoxes(): Promise<UnsortedBox[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('unsorted_photos')
    .select('session_id, created_at')
    .eq('upload_status', 'uploaded')
    .is('matched_order_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300);

  // ★ 묶는 규칙은 도메인에 있습니다 — 시험할 수 있어야 하니까요
  return groupUnsorted((data ?? []) as { session_id: string; created_at: string }[]);
}

/** 미분류함에 몇 장 있는가. 홈 배지에 씁니다 */
export async function countUnsortedPhotos(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('unsorted_photos')
    .select('id', { count: 'exact', head: true })
    .eq('upload_status', 'uploaded')
    .is('matched_order_id', null)
    .is('deleted_at', null);

  return count ?? 0;
}
