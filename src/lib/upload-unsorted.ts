// =========================================================
// 놓을 위치: src/lib/upload-unsorted.ts
//
// 미분류 사진 올리기. (명세서 SPEC_shade-photo 2-B)
//
// ★ order_files 로 가는 길(lib/upload)과 나란한 형제입니다. 다른 것은
//   **주문이 아직 없다**는 것뿐입니다.
//
// ★★ **안 줄입니다.** 쉐이드 사진이라 원본 그대로입니다
//   (사용자 결정 2026-08-21).
//
// ★ 줄을 먼저 만들고(pending) 저장소에 올립니다. 순서를 뒤집으면
//   올리다 끊긴 사진이 아무 흔적 없이 사라집니다 — 그러면 미분류함이
//   비어 보이는데 저장소에는 덩어리가 남습니다.
// =========================================================

import { createClient } from '@/lib/supabase/client';

const BUCKET = 'order-files';

export interface UnsortedResult {
  ok: boolean;
  sessionId: string;
  uploaded: number;
  failed: string[];
  reason?: string;
}

/** 저장소 경로. 두 번째 칸이 치과 조직 id 라 정책이 그것으로 가릅니다 */
function pathOf(clinicOrgId: string, sessionId: string, file: File): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const safe = 'file.' + (ext ?? 'jpg').replace(/[^a-zA-Z0-9]/g, '');

  return `unsorted/${clinicOrgId}/${sessionId}/${crypto.randomUUID()}_${safe}`;
}

export async function uploadUnsortedPhotos(
  clinicOrgId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<UnsortedResult> {
  const supabase = createClient();
  const sessionId = crypto.randomUUID();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const plan = files.map((file) => ({ file, path: pathOf(clinicOrgId, sessionId, file), rowId: '' }));

  const { data: rows, error: rowError } = await supabase
    .from('unsorted_photos')
    .insert(
      plan.map(({ file, path }) => ({
        clinic_org_id: clinicOrgId,
        session_id: sessionId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        taken_by: user?.id ?? null,
        upload_status: 'pending',
      })),
    )
    .select('id, storage_path');

  if (rowError) {
    return { ok: false, sessionId, uploaded: 0, failed: files.map((f) => f.name), reason: rowError.message };
  }

  for (const row of (rows ?? []) as { id: string; storage_path: string }[]) {
    const found = plan.find((p) => p.path === row.storage_path);
    if (found) found.rowId = row.id;
  }

  const failed: string[] = [];
  let done = 0;

  for (const { file, path, rowId } of plan) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      // ★ 재압축 없이 그대로. contentType 을 붙여야 나중에 열 때 사진으로 뜹니다
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

    if (error) {
      failed.push(file.name);
      if (rowId) await supabase.from('unsorted_photos').update({ upload_status: 'failed' }).eq('id', rowId);
    } else if (rowId) {
      /*
        ★ 몇 줄이 고쳐졌는지 봅니다. 정책이 막으면 오류가 아니라
          0줄이고, 라이브러리는 그것을 성공으로 돌려줍니다
          (2026-08-21 에 order_files 에서 그렇게 데였습니다).
      */
      const { data: marked } = await supabase
        .from('unsorted_photos')
        .update({ upload_status: 'uploaded' })
        .eq('id', rowId)
        .select('id');

      if (!marked || marked.length === 0) failed.push(file.name);
    }

    done += 1;
    onProgress?.(done, plan.length);
  }

  return { ok: failed.length === 0, sessionId, uploaded: plan.length - failed.length, failed };
}
