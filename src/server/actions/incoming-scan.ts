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
