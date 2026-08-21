// =========================================================
// 놓을 위치: src/server/actions/unsorted-photo.ts
//
// 미분류 사진을 의뢰서에 붙입니다. (명세서 SPEC_shade-photo S5)
//
// ★★ **서버에서 합니다.** 저장소를 옮기고 표 두 개를 고치는 일이라,
//   화면에서 하다 중간에 끊기면 사진이 어디에도 안 속한 채 남습니다.
//
// ★ 권한은 RLS 가 봅니다 — 사용자 열쇠로 부릅니다. 여기서 조건을
//   다시 적으면 두 곳이 어긋날 때 구멍이 납니다 (설계서 §5.3 결정 2).
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { canShoot } from '@/server/domain/shade-photo';
import type { OrderStatus } from '@/server/domain/order-status';

const BUCKET = 'order-files';

export type MatchResult =
  | { ok: true; moved: number; orderNo: string }
  | { ok: false; error: string };

export async function submitMatchUnsorted(
  sessionId: string,
  orderId: string,
): Promise<MatchResult> {
  const session = await getSession();
  if (session?.orgType !== 'clinic' || !session.orgId) {
    return { ok: false, error: '치과 계정만 붙일 수 있습니다' };
  }

  const supabase = await createClient();

  // 붙일 주문 — RLS 가 남의 주문을 0행으로 막습니다
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_no, status')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  const found = order as { id: string; order_no: string; status: OrderStatus } | null;
  if (!found) return { ok: false, error: '그 의뢰서를 찾을 수 없습니다' };

  /*
    ★ 이미 넘어간 주문에는 안 붙입니다. 화면이 대기 중인 것만 보여
      주지만, 고르는 사이에 상태가 넘어갈 수 있습니다.
  */
  if (!canShoot(found.status)) {
    return { ok: false, error: '이미 작업이 넘어간 의뢰서입니다' };
  }

  const { data: photos } = await supabase
    .from('unsorted_photos')
    .select('id, storage_path, file_name, file_size, mime_type, taken_by')
    .eq('session_id', sessionId)
    .eq('upload_status', 'uploaded')
    .is('matched_order_id', null)
    .is('deleted_at', null)
    .order('created_at');

  const rows = (photos ?? []) as {
    id: string;
    storage_path: string;
    file_name: string;
    file_size: number | null;
    mime_type: string | null;
    taken_by: string | null;
  }[];

  if (rows.length === 0) return { ok: false, error: '붙일 사진이 없습니다' };

  let moved = 0;

  for (const p of rows) {
    const ext = p.storage_path.split('.').pop() ?? 'jpg';
    const to = `orders/${orderId}/${crypto.randomUUID()}_file.${ext}`;

    /*
      ★ 옮깁니다 — 복사가 아닙니다. 복사면 미분류함에 같은 사진이
        남아서, 다음 사람이 또 붙입니다.
    */
    const { error: moveError } = await supabase.storage.from(BUCKET).move(p.storage_path, to);
    if (moveError) continue;

    /*
      ★ 옮긴 **뒤에** 줄을 만듭니다. 반대로 하면 줄은 있는데 덩어리가
        없는 상태가 생깁니다 — 화면이 '안 올라감' 으로 보여 줍니다.
    */
    const { data: made } = await supabase
      .from('order_files')
      .insert({
        order_id: orderId,
        kind: 'scan',
        storage_path: to,
        file_name: p.file_name,
        file_size: p.file_size,
        mime_type: p.mime_type,
        uploaded_by: p.taken_by,
        upload_status: 'uploaded',
      })
      .select('id');

    if (!made || made.length === 0) {
      // 줄을 못 만들었으면 되돌립니다 — 사진이 어디에도 안 속하면 안 됩니다
      await supabase.storage.from(BUCKET).move(to, p.storage_path);
      continue;
    }

    await supabase
      .from('unsorted_photos')
      .update({ matched_order_id: orderId, matched_at: new Date().toISOString() })
      .eq('id', p.id);

    moved += 1;
  }

  if (moved === 0) return { ok: false, error: '사진을 옮기지 못했습니다. 잠시 뒤 다시 해 주세요' };

  revalidatePath('/m', 'layout');
  revalidatePath(`/clinic/orders/${orderId}`);
  revalidatePath('/design/orders', 'layout');

  return { ok: true, moved, orderNo: found.order_no };
}

/** 잘못 찍은 묶음을 통째로 버립니다 */
export async function submitDiscardUnsorted(sessionId: string): Promise<MatchResult> {
  const session = await getSession();
  if (session?.orgType !== 'clinic' || !session.orgId) {
    return { ok: false, error: '치과 계정만 지울 수 있습니다' };
  }

  const supabase = await createClient();

  const { data: photos } = await supabase
    .from('unsorted_photos')
    .select('id, storage_path')
    .eq('session_id', sessionId)
    .is('matched_order_id', null)
    .is('deleted_at', null);

  const rows = (photos ?? []) as { id: string; storage_path: string }[];
  if (rows.length === 0) return { ok: false, error: '지울 사진이 없습니다' };

  /*
    ★ 저장소가 먼저입니다. 표를 먼저 지우면 경로를 잃어 덩어리를
      영영 못 치웁니다 (actions/order-file 과 같은 순서).
  */
  await supabase.storage.from(BUCKET).remove(rows.map((r) => r.storage_path));

  const { data: gone } = await supabase
    .from('unsorted_photos')
    .delete()
    .in(
      'id',
      rows.map((r) => r.id),
    )
    .select('id');

  if (!gone || gone.length === 0) return { ok: false, error: '지우지 못했습니다' };

  revalidatePath('/m', 'layout');

  return { ok: true, moved: gone.length, orderNo: '' };
}
