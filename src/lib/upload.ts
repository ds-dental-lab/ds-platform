import { createClient } from '@/lib/supabase/client';
/** 올라간 파일 한 건. 화면이 진행 상황을 그리는 데 씁니다 */
export interface UploadedFile {
  path: string;
  name: string;
  size: number;
  type: string;
}

const BUCKET = 'order-files';

export interface UploadResult {
  ok: boolean;
  uploaded: UploadedFile[];
  failed: string[];
}

/** 스캔은 치과가, 디자인은 디자인센터가 올립니다 (설계서 §8.3) */
export type UploadKind = 'scan' | 'design';

/** 주문이 만들어진 뒤에 부릅니다. 실패한 파일 이름을 돌려줍니다. */
export async function uploadOrderFiles(
  orderId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
  kind: UploadKind = 'scan',
): Promise<UploadResult> {
  const supabase = createClient();
  const uploaded: UploadedFile[] = [];
  const failed: string[] = [];

  const { data: { user } } = await supabase.auth.getUser();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
    const safeName = ext ? 'file.' + ext.replace(/[^a-zA-Z0-9]/g, '') : 'file';
    const path = 'orders/' + orderId + '/' + crypto.randomUUID() + '_' + safeName;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file);

    if (error) {
      failed.push(file.name);
    } else {
      await supabase.from('order_files').insert({
        order_id: orderId,
        kind,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      });

      uploaded.push({ path, name: file.name, size: file.size, type: file.type });
    }

    onProgress?.(i + 1, files.length);
  }

  return { ok: failed.length === 0, uploaded, failed };
}

