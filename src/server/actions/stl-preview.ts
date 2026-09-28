// =========================================================
// 놓을 위치: src/server/actions/stl-preview.ts
//
// 디자인 STL 의 여섯 방향 미리보기 (2026-09-28, 사용자 요청).
// 그림은 **브라우저가** 만들고, 이 액션은 두 가지만 합니다 —
//   ① 그릴 원본을 읽을 주소를 내주고(prepare)
//   ② 다 만든 그림의 자리를 표에 적습니다(save).
//
// ★ 표에 적는 것을 관리자 연결로 합니다. order_files 의 update 정책은
//   '접수·재스캔·디자인' 안에서만 열려 있어서, 제작·배송으로 넘어간 지난
//   주문에는 미리보기를 붙일 수 없습니다. 미리보기는 금액도 사양도 아닌
//   **거드는 그림**이라 그 잠금의 대상이 아닙니다. 대신 여기서 직접 봅니다:
//   디자인센터만, 디자인 파일만, 경로는 원본 옆으로 못 박습니다.
// =========================================================

'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/server/policies/session';

const BUCKET = 'order-files';
const TTL_SECONDS = 60 * 10;

export type PrepareResult =
  | { ok: true; url: string; previewPath: string }
  | { ok: false; error: string };

interface Row {
  id: string;
  kind: string;
  file_name: string;
  storage_path: string;
  preview_path: string | null;
  order: { design_org_id: string | null } | null;
}

/** 미리보기를 만들 수 있는 파일인가 — 디자인센터의 디자인 STL 만 */
async function findFile(fileId: string): Promise<Row | { error: string }> {
  const session = await getSession();
  if (session?.orgType !== 'design_center') return { error: '디자인센터만 만들 수 있습니다' };

  const supabase = await createClient();
  const { data } = await supabase
    .from('order_files')
    .select('id, kind, file_name, storage_path, preview_path, order:orders!inner(design_org_id)')
    .eq('id', fileId)
    .maybeSingle();

  const row = data as unknown as Row | null;
  if (!row) return { error: '파일을 찾을 수 없습니다' };
  if (row.order?.design_org_id !== session.orgId) return { error: '이 주문의 파일이 아닙니다' };
  if (row.kind !== 'design') return { error: '디자인 파일만 됩니다' };
  if (!row.file_name.toLowerCase().endsWith('.stl')) return { error: 'STL 만 그릴 수 있습니다' };

  return row;
}

export async function prepareStlPreview(fileId: string): Promise<PrepareResult> {
  const found = await findFile(fileId);
  if ('error' in found) return { ok: false, error: found.error };

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(found.storage_path, TTL_SECONDS);
  if (error || !data) return { ok: false, error: '원본을 읽지 못했습니다' };

  return { ok: true, url: data.signedUrl, previewPath: `${found.storage_path}.preview.png` };
}

export async function saveStlPreview(fileId: string, previewPath: string): Promise<{ ok: boolean; error?: string }> {
  const found = await findFile(fileId);
  if ('error' in found) return { ok: false, error: found.error };

  // ★ 경로를 못 박습니다 — 남의 덩어리를 가리키게 만들 수 없습니다
  if (previewPath !== `${found.storage_path}.preview.png`) {
    return { ok: false, error: '미리보기 경로가 올바르지 않습니다' };
  }

  const { error } = await createAdminClient()
    .from('order_files')
    .update({ preview_path: previewPath })
    .eq('id', fileId);

  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface OrderPreview {
  fileId: string;
  fileName: string;
  url: string;
}

/**
 * 주문 하나의 디자인 미리보기들 — **주문목록에서 눌렀을 때** 그 자리에서 보여 주려고 (2026-09-28).
 *
 * ★ 치과에는 안 줍니다(주문상세와 같은 규칙).
 * ★ 남의 주문은 RLS 가 막습니다 — 여기서는 소속 종류만 봅니다.
 */
export async function listOrderPreviews(orderId: string): Promise<{ ok: true; items: OrderPreview[] } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.orgId || session.orgType === 'clinic') return { ok: false, error: '볼 수 있는 자리가 아닙니다' };

  const supabase = await createClient();
  const { data } = await supabase
    .from('order_files')
    .select('id, file_name, preview_path')
    .eq('order_id', orderId)
    .eq('kind', 'design')
    .not('preview_path', 'is', null)
    .order('created_at');

  const rows = (data ?? []) as { id: string; file_name: string; preview_path: string }[];
  if (rows.length === 0) return { ok: true, items: [] };

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.preview_path), 60 * 30);

  const byPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl]));

  return {
    ok: true,
    items: rows
      .map((r) => ({ fileId: r.id, fileName: r.file_name, url: byPath.get(r.preview_path) ?? '' }))
      .filter((i) => i.url),
  };
}
