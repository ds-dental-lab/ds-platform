// =========================================================
// 놓을 위치: src/lib/upload-resumable.ts
//
// 끊긴 자리에서 이어 올리기 (TUS). (작업지시서 2026-08-20 §3-2)
//
// ★★ **왜 필요한가.**
//   150MB 를 치과 인터넷으로 올리면 20Mbps 에서 1분, 5Mbps 에서 4분입니다.
//   그 사이 한 번 끊기면 지금까지는 **처음부터** 다시 올렸습니다.
//   하루 30건이면 매일 겪습니다. 이어올리기는 끊긴 자리부터 갑니다.
//
// ★ 라이브러리를 안 씁니다 (tus-js-client 30KB).
//   우리가 쓰는 것은 만들기·이어붙이기·물어보기 셋뿐이고, 진행률을
//   보여 주려면 어차피 XHR 을 직접 잡아야 합니다. 라이브러리를 넣으면
//   그 안에서 다시 XHR 을 꺼내 쓰는 모양이 됩니다.
//
// ★ 조각은 **정확히 6MB** 여야 합니다. Supabase 의 이어올리기가 그
//   크기를 요구합니다 — 다르면 통째로 거절합니다 (domain/upload).
//
// ★ 만든 자리(주소)를 브라우저에 적어 둡니다.
//   창을 닫았다 다시 열어도, 같은 파일을 다시 고르면 **그 자리부터**
//   이어집니다. 적어 둔 자리가 죽었으면 조용히 새로 시작합니다.
//
// ★ 이 파일은 브라우저에서만 돕니다.
// =========================================================

import { TUS_CHUNK_BYTES } from '@/server/domain/upload';

const BUCKET = 'order-files';

/** 만들어 둔 자리를 적어 두는 곳 */
const MEMO_PREFIX = 'denflow.upload.';

/** 자리를 적어 둔 지 이만큼 지나면 버립니다 (Supabase 쪽도 곧 치웁니다) */
const MEMO_TTL_MS = 24 * 60 * 60 * 1000;

export interface ResumableResult {
  ok: boolean;
  /** 다시 해 볼 만한 실패인가 */
  retryable: boolean;
}

interface Memo {
  url: string;
  at: number;
}

/**
 * 같은 파일을 알아보는 이름표.
 *
 * ★ 이름·크기·수정시각·올릴 자리를 함께 씁니다. 이름만 쓰면 다른
 *   환자의 같은 이름 파일이 남의 자리를 이어받습니다.
 */
function memoKey(path: string, file: File): string {
  return `${MEMO_PREFIX}${path}|${file.name}|${file.size}|${file.lastModified}`;
}

function readMemo(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const memo = JSON.parse(raw) as Memo;
    if (!memo?.url || Date.now() - memo.at > MEMO_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return memo.url;
  } catch {
    // 사생활 보호 모드에서는 localStorage 가 막힙니다 — 없는 셈 칩니다
    return null;
  }
}

function writeMemo(key: string, url: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ url, at: Date.now() } satisfies Memo));
  } catch {
    /* 적어 두지 못해도 올리는 데는 지장이 없습니다 */
  }
}

function clearMemo(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
}

/** TUS 는 메타데이터를 base64 로 받습니다 */
function encodeMetadata(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k} ${btoa(unescape(encodeURIComponent(v)))}`)
    .join(',');
}

function endpoint(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;
}

function baseHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    'tus-resumable': '1.0.0',
  };
}

/** 올릴 자리를 새로 만듭니다. 만들어진 주소를 돌려줍니다 */
async function createUpload(path: string, file: File, token: string): Promise<string | null> {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      ...baseHeaders(token),
      'upload-length': String(file.size),
      'upload-metadata': encodeMetadata({
        bucketName: BUCKET,
        objectName: path,
        contentType: file.type || 'application/octet-stream',
        // 같은 이름을 덮어쓰지 않습니다 — 경로에 uuid 가 있어 겹칠 일도 없습니다
        upsert: 'false',
      }),
    },
  });

  if (!res.ok) return null;

  const location = res.headers.get('location');
  if (!location) return null;

  // 상대 주소로 올 수도 있습니다
  return location.startsWith('http') ? location : new URL(location, endpoint()).toString();
}

/** 지금 어디까지 올라갔는지 물어봅니다. 자리가 죽었으면 null */
async function askOffset(url: string, token: string): Promise<number | null> {
  const res = await fetch(url, { method: 'HEAD', headers: baseHeaders(token) });
  if (!res.ok) return null;

  const offset = Number(res.headers.get('upload-offset'));
  return Number.isFinite(offset) ? offset : null;
}

/**
 * 조각 하나를 이어 붙입니다. 보내는 동안 진행률을 알립니다.
 *
 * ★ fetch 가 아니라 XHR 인 이유 — fetch 는 **보내는 쪽** 진행률을
 *   안 알려 줍니다. 큰 파일에서 "몇 %" 를 보여 주려면 이것뿐입니다.
 */
function patchChunk(
  url: string,
  token: string,
  offset: number,
  chunk: Blob,
  onSent: (bytes: number) => void,
): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PATCH', url, true);

    for (const [k, v] of Object.entries(baseHeaders(token))) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader('upload-offset', String(offset));
    xhr.setRequestHeader('content-type', 'application/offset+octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onSent(e.loaded);
    };

    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
    xhr.onerror = () => resolve({ ok: false, status: 0 });
    xhr.ontimeout = () => resolve({ ok: false, status: 0 });
    xhr.onabort = () => resolve({ ok: false, status: 0 });

    xhr.send(chunk);
  });
}

/**
 * 파일 하나를 이어올리기로 보냅니다.
 *
 * @param onPercent 0~100. 이어받은 자리도 포함한 값입니다
 */
export async function uploadResumable(
  path: string,
  file: File,
  token: string,
  onPercent: (percent: number) => void,
): Promise<ResumableResult> {
  const key = memoKey(path, file);

  // ① 적어 둔 자리가 있으면 거기서 이어 갑니다
  let url = readMemo(key);
  let offset = 0;

  if (url) {
    const known = await askOffset(url, token);

    if (known === null) {
      // 자리가 죽었습니다 — 새로 시작합니다
      clearMemo(key);
      url = null;
    } else {
      offset = known;
    }
  }

  // ② 없으면 새로 만듭니다
  if (!url) {
    url = await createUpload(path, file, token);
    if (!url) return { ok: false, retryable: true };

    writeMemo(key, url);
    offset = 0;
  }

  onPercent(Math.round((offset / file.size) * 100));

  // ③ 6MB 씩 이어 붙입니다
  while (offset < file.size) {
    const end = Math.min(offset + TUS_CHUNK_BYTES, file.size);
    const chunk = file.slice(offset, end);
    const base = offset;

    const result = await patchChunk(url, token, offset, chunk, (sent) => {
      onPercent(Math.min(100, Math.round(((base + sent) / file.size) * 100)));
    });

    if (!result.ok) {
      /*
        ★ 실패해도 **적어 둔 자리는 지우지 않습니다.**
          다시 시도할 때 그 자리부터 이어 가는 것이 이 기능의 전부입니다.
          되돌릴 수 없는 실패(4xx)일 때만 지웁니다 — 권한이 없거나
          파일이 너무 크면 몇 번을 해도 같습니다.
      */
      const retryable = result.status === 0 || result.status >= 500 || result.status === 409;
      if (!retryable) clearMemo(key);

      return { ok: false, retryable };
    }

    offset = end;
  }

  clearMemo(key);
  onPercent(100);

  return { ok: true, retryable: false };
}
