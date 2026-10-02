// =========================================================
// 놓을 위치: src/server/actions/incoming-scan.ts
//
// 치과 PC 가 올려 둔 스캔을 주문에 붙입니다 (사용자 요청 2026-10-02).
//
// ★ 파일을 다시 올리지 않습니다. 저장소 안에서 주문 폴더로 **옮깁니다** —
//   150MB 를 두 번 보내지 않습니다.
// ★ 붙인 뒤에는 '들어온 스캔' 목록에서 사라집니다 (order_id 가 채워집니다).
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/server/policies/session';

const BUCKET = 'order-files';

export async function submitAttachIncomingScan(
  orderId: string,
  scanId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.orgId) return { ok: false, error: '로그인이 필요합니다' };

  const supabase = await createClient();

  // ★ 내 주문인지·내 스캔인지는 RLS 가 봅니다. 안 보이면 없는 것입니다
  const [{ data: order }, { data: scan }] = await Promise.all([
    supabase.from('orders').select('id').eq('id', orderId).maybeSingle(),
    supabase
      .from('incoming_scans')
      .select('id, file_name, file_size, storage_path, upload_status, order_id')
      .eq('id', scanId)
      .maybeSingle(),
  ]);

  const row = scan as {
    id: string;
    file_name: string;
    file_size: number | null;
    storage_path: string;
    upload_status: string;
    order_id: string | null;
  } | null;

  if (!order) return { ok: false, error: '주문을 찾을 수 없습니다' };
  if (!row) return { ok: false, error: '스캔을 찾을 수 없습니다' };
  if (row.order_id) return { ok: false, error: '이미 다른 주문에 붙은 스캔입니다' };
  if (row.upload_status !== 'uploaded') return { ok: false, error: '아직 올라오는 중입니다' };

  const admin = createAdminClient();
  const target = `orders/${orderId}/${randomUUID()}_file.dxd`;

  const moved = await admin.storage.from(BUCKET).move(row.storage_path, target);
  if (moved.error) return { ok: false, error: `파일을 옮기지 못했습니다: ${moved.error.message}` };

  const { error: fileError } = await admin.from('order_files').insert({
    order_id: orderId,
    kind: 'scan',
    storage_path: target,
    file_name: row.file_name,
    file_size: row.file_size,
    mime_type: null,
    uploaded_by: session.user.id,
    upload_status: 'uploaded',
  });

  if (fileError) {
    // 되돌려 둡니다 — 표에 없는 덩어리를 남기지 않습니다
    await admin.storage.from(BUCKET).move(target, row.storage_path);
    return { ok: false, error: `주문에 붙이지 못했습니다: ${fileError.message}` };
  }

  await admin
    .from('incoming_scans')
    .update({ order_id: orderId, storage_path: target, attached_at: new Date().toISOString() })
    .eq('id', scanId);

  revalidatePath('/clinic/scans');
  revalidatePath(`/clinic/orders/${orderId}`);
  return { ok: true };
}

export async function submitDeleteIncomingScan(scanId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (session?.orgType !== 'clinic') return { ok: false, error: '치과만 지울 수 있습니다' };

  const supabase = await createClient();
  const { data } = await supabase
    .from('incoming_scans')
    .select('id, storage_path, order_id')
    .eq('id', scanId)
    .maybeSingle();

  const row = data as { id: string; storage_path: string; order_id: string | null } | null;
  if (!row) return { ok: false, error: '없는 스캔입니다' };
  if (row.order_id) return { ok: false, error: '이미 주문에 붙은 스캔입니다' };

  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([row.storage_path]);
  await admin.from('incoming_scans').update({ deleted_at: new Date().toISOString() }).eq('id', scanId);

  revalidatePath('/clinic/scans');
  return { ok: true };
}

/**
 * 올라온 스캔을 **걸려 있던 재스캔 주문**에 붙입니다 (사용자 요청 2026-10-02).
 *
 * ★ 같은 환자가 두 줄이 되는 것을 막습니다. 재스캔이 걸린 주문을 그대로 두고
 *   새 주문을 쓰면, 디자인센터는 어느 쪽을 봐야 하는지 알 수 없습니다.
 * ★ 붙이기를 먼저 하고 상태를 되돌립니다 — 순서를 뒤집으면 스캔 없는 주문이
 *   접수로 올라갑니다 (RescanBar 와 같은 이유).
 */
export async function submitRescanWithIncomingScan(
  orderId: string,
  scanId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (session?.orgType !== 'clinic') return { ok: false, error: '치과 계정만 할 수 있습니다' };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!order) return { ok: false, error: '주문을 찾을 수 없습니다' };
  if ((order as { status: string }).status !== 'rescan') {
    return { ok: false, error: '재스캔 상태인 주문에만 붙일 수 있습니다' };
  }

  // ★ 붙이기 전에 적어 둡니다. 붙인 뒤에 긁으면 새 파일까지 치워 버립니다
  const { data: old } = await supabase
    .from('order_files')
    .select('id')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .neq('kind', 'design');

  const replaceFileIds = ((old ?? []) as { id: string }[]).map((f) => f.id);

  const attached = await submitAttachIncomingScan(orderId, scanId);
  if (!attached.ok) return attached;

  const { resubmitScan } = await import('@/server/services/rescan');
  const result = await resubmitScan({ orderId, reuse: false, replaceFileIds, uploadedCount: 1 });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/clinic/scans');
  revalidatePath(`/clinic/orders/${orderId}`);
  return { ok: true };
}
