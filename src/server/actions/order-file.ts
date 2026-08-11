// =========================================================
// 놓을 위치: src/server/actions/order-file.ts
//
// 올라온 파일 내려받기.
//
// ★ storage_path 를 화면에 내려보내지 않습니다.
//   경로를 알면 정책이 허술한 순간 바로 긁어갈 수 있습니다.
//   화면은 파일 id 만 들고, 서버가 확인한 뒤 짧게 사는 주소를 만들어 줍니다.
//
// ★ "볼 수 있는가" 를 여기서 다시 묻지 않습니다.
//   order_files 의 RLS 가 이미 그 주문을 볼 수 있는 사람에게만 행을 줍니다.
//   조건을 두 곳에 적으면 어긋날 때 구멍이 납니다. (설계서 §5.3 결정 2)
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import {
  canDeleteFile,
  type OrderStatus,
  type Sector,
} from '@/server/domain/order-status';

const BUCKET = 'order-files';

/** 주소가 살아 있는 시간. 눌러서 받는 데 넉넉하고, 흘러도 곧 죽습니다 */
const TTL_SECONDS = 60;

export type FileUrlResult =
  | { ok: true; url: string; fileName: string }
  | { ok: false; error: string };

export async function getOrderFileUrl(fileId: string): Promise<FileUrlResult> {
  const supabase = await createClient();

  const { data: file } = await supabase
    .from('order_files')
    .select('storage_path, file_name')
    .eq('id', fileId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!file) return { ok: false, error: '파일을 찾을 수 없습니다' };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, TTL_SECONDS, { download: file.file_name });

  if (error || !data) {
    return { ok: false, error: `내려받지 못했습니다: ${error?.message ?? '알 수 없는 오류'}` };
  }

  return { ok: true, url: data.signedUrl, fileName: file.file_name };
}

// ---------- 지우기 ----------

export type DeleteFileResult = { ok: true } | { ok: false; error: string };

/**
 * 올라온 파일을 지웁니다.
 *
 * ★ 저장소와 표를 함께 비웁니다.
 *   표만 지우면 저장소에 덩어리가 남아 아무도 모르게 쌓입니다.
 *   저장소만 지우면 목록에 이름이 남아 눌렀을 때 없는 파일을 찾습니다.
 *
 * ★ 저장소가 먼저입니다.
 *   표를 먼저 지우면 경로를 잃어 저장소를 못 치웁니다.
 *   반대로 저장소를 먼저 지우고 표가 실패하면, 그 줄은 'pending' 과 같은
 *   모양이 되어 화면이 '안 올라감' 으로 보여 줍니다 — 고칠 수 있는 상태입니다.
 */
export async function submitDeleteOrderFile(fileId: string): Promise<DeleteFileResult> {
  const session = await getSession();
  if (!session?.orgId) return { ok: false, error: '로그인이 필요합니다' };

  const supabase = await createClient();

  const { data: file } = await supabase
    .from('order_files')
    .select(
      'id, kind, storage_path, upload_status, ' +
        'order:orders!inner(id, status, clinic_org_id, design_org_id, lab_org_id)',
    )
    .eq('id', fileId)
    .maybeSingle();

  const found = file as unknown as {
    kind: string;
    storage_path: string;
    upload_status: string;
    order: {
      id: string;
      status: OrderStatus;
      clinic_org_id: string;
      design_org_id: string | null;
      lab_org_id: string | null;
    };
  } | null;

  // RLS 는 남의 주문 파일을 0행으로 막습니다
  if (!found) return { ok: false, error: '파일을 찾을 수 없습니다' };

  // 한 조직이 두 자리를 겸할 수 있습니다 (자사 제작)
  const roles: Sector[] = [];
  if (found.order.clinic_org_id === session.orgId) roles.push('clinic');
  if (found.order.design_org_id === session.orgId) roles.push('design_center');
  if (found.order.lab_org_id === session.orgId) roles.push('lab');

  if (!canDeleteFile(found.kind, found.order.status, roles)) {
    return { ok: false, error: '이 파일을 지울 수 없습니다' };
  }

  // 안 올라간 줄은 저장소에 덩어리가 없습니다
  if (found.upload_status === 'uploaded') {
    const { error } = await supabase.storage.from(BUCKET).remove([found.storage_path]);
    if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  }

  const { data, error } = await supabase
    .from('order_files')
    .delete()
    .eq('id', fileId)
    .select('id');

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '지울 수 있는 파일이 아닙니다' };

  revalidatePath(`/clinic/orders/${found.order.id}`);
  revalidatePath(`/design/orders/${found.order.id}`);
  revalidatePath(`/lab/orders/${found.order.id}`);

  return { ok: true };
}
