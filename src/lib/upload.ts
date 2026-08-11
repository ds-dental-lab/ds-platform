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

/**
 * 지금 어디까지 갔는가. 화면이 이대로 그립니다.
 *
 * ★ '몇 개 중 몇 개' 만으로는 부족합니다.
 *   스캔 데이터는 한 개가 수백 MB 입니다. 1/1 에 멈춰 있으면
 *   되고 있는 건지 멈춘 건지 알 수 없어 사람이 창을 닫아 버립니다.
 */
export interface UploadProgress {
  /** 지금 올리는 파일 (1부터) */
  index: number;
  total: number;
  fileName: string;
  /** 이 파일의 % */
  percent: number;
  /** 전체 바이트 기준 % */
  overallPercent: number;
  /** 다 올린 파일 수 */
  done: number;
  failed: number;
}

export type UploadProgressHandler = (progress: UploadProgress) => void;

/**
 * 주문이 만들어진 뒤에 부릅니다. 실패한 파일 이름을 돌려줍니다.
 *
 * ★ supabase-js 의 upload() 를 쓰지 않고 XHR 로 직접 올립니다.
 *   fetch 는 보내는 쪽 진행률을 알려주지 않습니다. 큰 파일에서
 *   "몇 %" 를 보여주려면 XMLHttpRequest 의 upload.onprogress 가 필요합니다.
 *   그것 말고는 supabase-js 가 하는 일과 같습니다 (같은 REST 끝점).
 */
export async function uploadOrderFiles(
  orderId: string,
  files: File[],
  onProgress?: UploadProgressHandler,
  kind: UploadKind = 'scan',
): Promise<UploadResult> {
  const supabase = createClient();
  const uploaded: UploadedFile[] = [];
  const failed: string[] = [];

  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const token = session?.access_token;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
  let sentBytes = 0;

  // ★ 올리기 **전에** 몇 개를 보낼 참인지 남깁니다.
  //   끝난 뒤에 적으면, 올리다 끊겼을 때 아무 흔적도 안 남습니다 —
  //   그러면 디자인센터는 "원래 파일이 없는 주문" 으로 봅니다.
  //   실패해도 이 숫자는 남아 (1/3) 처럼 어긋남이 보입니다.
  if (kind === 'scan' && files.length > 0) {
    await supabase.rpc('note_planned_scan_files', {
      p_order_id: orderId,
      p_count: files.length,
    });
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
    const safeName = ext ? 'file.' + ext.replace(/[^a-zA-Z0-9]/g, '') : 'file';
    const path = 'orders/' + orderId + '/' + crypto.randomUUID() + '_' + safeName;

    const report = (percent: number) => {
      onProgress?.({
        index: i + 1,
        total: files.length,
        fileName: file.name,
        percent,
        overallPercent: Math.min(
          100,
          Math.round(((sentBytes + (file.size * percent) / 100) / totalBytes) * 100),
        ),
        done: uploaded.length,
        failed: failed.length,
      });
    };

    report(0);

    const ok = token
      ? await putWithProgress(path, file, token, report)
      : // 토큰을 못 읽는 드문 경우 — 진행률 없이라도 올립니다
        !(await supabase.storage.from(BUCKET).upload(path, file)).error;

    if (!ok) {
      failed.push(file.name);
      report(0);
      continue;
    }

    // ★ 저장소에 올린 뒤에야 줄을 남깁니다.
    //   먼저 남기면 '표에는 있는데 파일은 없는' 줄이 생겨,
    //   화면의 (올라간 수 / 보낸 수) 가 거짓말을 합니다.
    const { error: rowError } = await supabase.from('order_files').insert({
      order_id: orderId,
      kind,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: user?.id ?? null,
    });

    if (rowError) {
      failed.push(file.name);
    } else {
      uploaded.push({ path, name: file.name, size: file.size, type: file.type });
    }

    sentBytes += file.size;
    report(100);
  }

  return { ok: failed.length === 0, uploaded, failed };
}

/**
 * 저장소에 파일 하나를 올리며 진행률을 알립니다.
 *
 * supabase-js 가 부르는 것과 같은 주소입니다:
 *   POST /storage/v1/object/{bucket}/{path}
 */
function putWithProgress(
  path: string,
  file: File,
  token: string,
  onPercent: (percent: number) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const url =
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/` +
      `${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    // 같은 이름을 덮어쓰지 않습니다. 경로에 uuid 가 있어 겹칠 일도 없습니다
    xhr.setRequestHeader('x-upsert', 'false');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPercent(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);

    xhr.send(file);
  });
}
