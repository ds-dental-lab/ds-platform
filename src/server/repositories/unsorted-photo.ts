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
import { groupUnsorted, thumbTransform, THUMB_TTL } from '@/server/domain/shade-photo';

export interface UnsortedBox {
  sessionId: string;
  count: number;
  takenAt: string;
  /**
   * 그 묶음의 첫 장을 줄인 것.
   *
   * ★★ 이게 없으면 미분류함이 '사진 3장' 같은 **글자만** 남습니다.
   *   무엇을 찍었는지 모르면 붙일 의뢰서도 못 고릅니다 — 결국
   *   묶음을 열어 보거나, 그냥 카톡으로 한 번 더 보냅니다.
   */
  thumbUrl: string;
}

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
    .select('session_id, created_at, storage_path')
    .eq('upload_status', 'uploaded')
    .is('matched_order_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300);

  const rows = (data ?? []) as { session_id: string; created_at: string; storage_path: string }[];

  // ★ 묶는 규칙은 도메인에 있습니다 — 시험할 수 있어야 하니까요
  const boxes = groupUnsorted(rows);

  /*
    ★ 묶음마다 **첫 장**을 겁니다. 그때 그 환자를 봤습니다 —
      마지막 장은 각도만 바꾼 자유컷일 때가 많습니다.
  */
  return Promise.all(
    boxes.map(async (box) => {
      const first = rows
        .filter((r) => r.session_id === box.sessionId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

      if (!first) return { ...box, thumbUrl: '' };

      const { data: signed } = await supabase.storage
        .from('order-files')
        .createSignedUrl(first.storage_path, THUMB_TTL, { transform: thumbTransform('grid') });

      return { ...box, thumbUrl: signed?.signedUrl ?? '' };
    }),
  );
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
