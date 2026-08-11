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
  /** 이 파일을 몇 번째로 시도하고 있는가. 1이면 처음입니다 */
  attempt: number;
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

    let attempt = 1;

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
        attempt,
      });
    };

    report(0);

    const ok = token
      ? await putWithRetry(path, file, token, report, (n) => {
          attempt = n;
        })
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

/** 몇 번까지 다시 해 보는가. 처음 1번 + 다시 2번 */
const MAX_ATTEMPTS = 3;

/**
 * 실패하면 잠깐 쉬었다 다시 올립니다.
 *
 * ★ (2/3) 이 생기는 흔한 원인 둘 중 하나가 순간적인 네트워크 끊김입니다.
 *   (다른 하나는 사람이 중간에 나가는 것 — 그건 화면이 막습니다)
 *   와이파이가 잠깐 끊기거나 서버가 순간 밀린 것이라면, 한 번 더 하면
 *   그냥 됩니다. 사람에게 "다시 올려 주세요" 라고 말할 이유가 없습니다.
 *
 * ★ 되돌릴 수 없는 실패는 다시 하지 않습니다.
 *   권한 없음·파일 너무 큼(4xx)은 열 번을 해도 같습니다.
 *   끊김(status 0)과 서버 오류(5xx)만 다시 합니다.
 */
async function putWithRetry(
  path: string,
  file: File,
  token: string,
  onPercent: (percent: number) => void,
  onAttempt: (attempt: number) => void,
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onAttempt(attempt);

    const result = await putWithProgress(path, file, token, onPercent);
    if (result.ok) return true;

    // 다시 해도 소용없는 실패면 여기서 접습니다
    if (!result.retryable || attempt === MAX_ATTEMPTS) return false;

    // 1초 · 2초 — 끊김이 지나가기를 잠깐 기다립니다
    await new Promise((r) => setTimeout(r, attempt * 1000));
    onPercent(0);
  }

  return false;
}

interface PutResult {
  ok: boolean;
  /** 다시 해 볼 만한 실패인가 */
  retryable: boolean;
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
): Promise<PutResult> {
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

    xhr.onload = () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        // 서버가 밀린 것(5xx)은 다시 해 볼 만합니다. 4xx 는 아닙니다
        retryable: xhr.status >= 500,
      });

    // 네트워크가 끊긴 것 — 가장 흔하고, 가장 다시 해 볼 만합니다
    xhr.onerror = () => resolve({ ok: false, retryable: true });
    xhr.ontimeout = () => resolve({ ok: false, retryable: true });
    xhr.onabort = () => resolve({ ok: false, retryable: false });

    xhr.send(file);
  });
}
