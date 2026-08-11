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

import { createClient } from '@/lib/supabase/server';

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
