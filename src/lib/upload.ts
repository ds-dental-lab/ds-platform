import { createClient } from '@/lib/supabase/client';
import {
  maskFileNames,
  matchMissingFiles,
  nextFileSeq,
  maskFileName,
  type OrderFileKind,
} from '@/server/domain/file-name';

/** 올라간 파일 한 건. 화면이 진행 상황을 그리는 데 씁니다 */
export interface UploadedFile {
  path: string;
  /** 저장된 이름 — 원본이 아니라 우리가 지은 이름입니다 */
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
export type UploadKind = Extract<OrderFileKind, 'scan' | 'design'>;

/**
 * 이름을 지으려면 주문번호와, 이 주문에 이미 붙은 이름들이 필요합니다.
 *
 * ★ 실패해도 그냥 갑니다.
 *   여기서 멈추면 파일을 아예 못 올립니다. 이름을 못 지으면 원본이
 *   그대로 가지만, DB 트리거가 받으면서 다시 지어 줍니다 —
 *   보기 좋은 번호 대신 임의의 숫자가 붙을 뿐, 이름은 새지 않습니다.
 */
async function loadNaming(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  kind: UploadKind,
): Promise<{ orderNo: string | null; existing: string[] }> {
  const [{ data: order }, { data: rows }] = await Promise.all([
    supabase.from('orders').select('order_no').eq('id', orderId).maybeSingle(),
    supabase.from('order_files').select('file_name').eq('order_id', orderId).eq('kind', kind),
  ]);

  return {
    orderNo: (order as { order_no: string } | null)?.order_no ?? null,
    existing: ((rows ?? []) as { file_name: string }[]).map((r) => r.file_name),
  };
}

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

  // 진행률은 files 로 세지만 아래 반복은 plan 을 돕니다 — 길이가 같습니다
  const count = files.length;

  // ★ 올리기 **전에** 줄을 만듭니다 (pending).
  //   끝난 뒤에 만들면, 올리다 끊긴 파일은 아무 흔적이 없습니다 —
  //   디자인센터는 "원래 없는 파일" 로 보고, 무엇이 빠졌는지 아무도 모릅니다.
  //   미리 만들어 두면 이름·크기가 남아 그 파일만 다시 올릴 수 있습니다.
  //
  //   대신 '표에는 있는데 저장소에는 없는' 줄이 생깁니다.
  //   그것이 pending 이고, 그 줄이 곧 "이 파일이 빠졌다" 는 증거입니다.
  //
  // ★ 이름은 여기서 새로 짓습니다 — `ORD-260811-013_스캔1.obj`.
  //   원본에는 환자 이름이 들어 있고, 그 이름으로 저장하면 기공소 PC 에
  //   환자 이름이 쌓입니다. 원본은 아래 진행률 표시에만 씁니다 (올리는
  //   사람 자신의 화면이고, 자기가 방금 고른 파일입니다).
  const { orderNo, existing } = await loadNaming(supabase, orderId, kind);

  const names = orderNo
    ? maskFileNames(orderNo, kind, files.map((f) => f.name), existing)
    : files.map((f) => f.name); // 트리거가 받아서 다시 지어 줍니다

  const plan = files.map((file, i) => ({
    file,
    name: names[i],
    path: newPath(orderId, file),
    rowId: '',
  }));

  if (plan.length > 0) {
    const { data: rows } = await supabase
      .from('order_files')
      .insert(
        plan.map(({ file, name, path }) => ({
          order_id: orderId,
          kind,
          storage_path: path,
          file_name: name,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: user?.id ?? null,
          upload_status: 'pending',
        })),
      )
      .select('id, storage_path');

    for (const row of (rows ?? []) as { id: string; storage_path: string }[]) {
      const found = plan.find((p) => p.path === row.storage_path);
      if (found) found.rowId = row.id;
    }
  }

  for (let i = 0; i < plan.length; i++) {
    const { file, name, path, rowId } = plan[i];

    let attempt = 1;

    const report = (percent: number) => {
      onProgress?.({
        index: i + 1,
        total: count,
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
      // 줄은 그대로 둡니다 — 무엇이 빠졌는지 알려 주는 유일한 흔적입니다
      if (rowId) {
        await supabase.from('order_files').update({ upload_status: 'failed' }).eq('id', rowId);
      }
      failed.push(file.name);
      report(0);
      continue;
    }

    const { error: rowError } = rowId
      ? await supabase.from('order_files').update({ upload_status: 'uploaded' }).eq('id', rowId)
      : // 줄을 못 만들었던 드문 경우 — 지금이라도 남깁니다
        await supabase.from('order_files').insert({
          order_id: orderId,
          kind,
          storage_path: path,
          file_name: name,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: user?.id ?? null,
          upload_status: 'uploaded',
        });

    if (rowError) {
      failed.push(file.name);
    } else {
      uploaded.push({ path, name, size: file.size, type: file.type });
    }

    sentBytes += file.size;
    report(100);
  }

  return { ok: failed.length === 0, uploaded, failed };
}

/**
 * 저장소에 쓸 경로. 이름은 버리고 확장자만 남깁니다.
 *
 * ★ 환자 이름이 파일명에 들어 있는 일이 흔합니다.
 *   경로에 그대로 쓰면 주소만 봐도 이름이 새어 나갑니다.
 */
function newPath(orderId: string, file: File): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const safeName = ext ? 'file.' + ext.replace(/[^a-zA-Z0-9]/g, '') : 'file';

  return 'orders/' + orderId + '/' + crypto.randomUUID() + '_' + safeName;
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

// ---------- 빠진 파일만 다시 올리기 ----------

/** 아직 저장소에 없는 파일 한 줄 */
export interface MissingFile {
  id: string;
  fileName: string;
  fileSize: number | null;
}

/**
 * 안 올라간 줄에 파일을 다시 붙입니다.
 *
 * ★ 크기와 확장자로 짝을 맞춥니다 (전에는 이름이었습니다).
 *   줄에 남은 이름은 우리가 지은 `ORD-…_스캔2.obj` 이고, 사람이 다시
 *   고르는 것은 자기 PC 의 `박나래-26.obj` 입니다 — 이름으로는 영영
 *   안 만납니다. 끊긴 줄에는 고를 때 적어 둔 바이트 수가 그대로 남아
 *   있고, 같은 파일이면 한 바이트도 다르지 않습니다.
 *   규칙은 domain/file-name 의 matchMissingFiles 가 갖고 있습니다.
 *
 * ★ 짝을 못 찾으면 새 줄입니다.
 *   억지로 남은 줄에 끼워 넣으면 다른 파일이 그 자리에 앉습니다.
 *   줄이 하나 더 생기는 것은 눈에 보이지만, 바꿔치기는 안 보입니다.
 *
 * ★ 저장소 경로는 새로 뽑습니다.
 *   앞서 끊긴 자리에 덩어리가 반쯤 남아 있을 수 있습니다.
 *   같은 경로로 다시 쓰면 부딪칩니다.
 */
export async function retryOrderFiles(
  orderId: string,
  missing: MissingFile[],
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

  const matched = matchMissingFiles(
    missing,
    files.map((f) => ({ name: f.name, size: f.size })),
  );

  // 짝을 못 찾은 것은 새 줄이 됩니다 — 그 줄에 붙일 이름을 미리 지어 둡니다
  const { orderNo, existing } = await loadNaming(supabase, orderId, kind);
  let seq = orderNo ? nextFileSeq(orderNo, kind, existing) : 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = newPath(orderId, file);
    const rowId = matched[i];

    // 이미 있는 줄은 이름을 그대로 둡니다 — 화면에 보이던 이름이 바뀌면
    // "내가 올린 그 파일이 맞나" 를 다시 못 맞춥니다
    const name = rowId ? null : orderNo ? maskFileName(orderNo, kind, seq++, file.name) : file.name;

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
      : !(await supabase.storage.from(BUCKET).upload(path, file)).error;

    if (!ok) {
      failed.push(file.name);
      report(0);
      continue;
    }

    const { error } = rowId
      ? await supabase
          .from('order_files')
          .update({
            storage_path: path,
            file_size: file.size,
            mime_type: file.type || null,
            uploaded_by: user?.id ?? null,
            upload_status: 'uploaded',
          })
          .eq('id', rowId)
      : await supabase.from('order_files').insert({
          order_id: orderId,
          kind,
          storage_path: path,
          file_name: name ?? file.name,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: user?.id ?? null,
          upload_status: 'uploaded',
        });

    if (error) {
      failed.push(file.name);
    } else {
      uploaded.push({ path, name: name ?? file.name, size: file.size, type: file.type });
    }

    sentBytes += file.size;
    report(100);
  }

  return { ok: failed.length === 0, uploaded, failed };
}
