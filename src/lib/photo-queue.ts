// =========================================================
// 놓을 위치: src/lib/photo-queue.ts
//
// 못 보낸 사진을 폰 안에 들고 있다가 다시 보냅니다.
// (명세서 SPEC_shade-photo §5 · 엣지케이스 "업로드 중 네트워크 끊김")
//
// ★★ **왜 필요한가.** 진료실 와이파이는 자주 약합니다. 지금까지는
//   올리다 끊기면 그 자리에서 실패하고 찍은 사진이 **사라졌습니다.**
//   환자는 이미 일어났고 다시 찍을 수 없습니다.
//
// ★ IndexedDB 에 담습니다. localStorage 는 글자만 담을 수 있어서
//   사진(수 MB)을 못 넣습니다.
//
// ★★ **여기서는 절대 던지지 않습니다.** 큐가 고장 났다고 촬영이
//   막히면 안 됩니다 — 큐는 안전망이지 길목이 아닙니다.
//   실패하면 빈 결과를 돌려주고 조용히 지나갑니다.
//
// ★ 이 파일은 브라우저에서만 돕니다.
// =========================================================

const DB_NAME = 'denflow';
const DB_VERSION = 1;
const STORE = 'photo-queue';

export interface QueuedPhoto {
  id: string;
  /** 붙일 주문. 미분류로 찍은 것이면 비어 있습니다 */
  orderId: string | null;
  /** 미분류 묶음. 주문이 정해진 것이면 비어 있습니다 */
  clinicOrgId: string | null;
  fileName: string;
  mimeType: string;
  blob: Blob;
  takenAt: number;
  tries: number;
  /** 마지막에 무엇 때문에 실패했나. 사람에게 보여 줍니다 */
  lastReason: string;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // 사생활 보호 모드에서 막힙니다 — 없는 셈 칩니다
      return resolve(null);
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  return new Promise(async (resolve) => {
    const db = await open();
    if (!db) return resolve(fallback);

    try {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));

      request.onsuccess = () => resolve((request.result as T) ?? fallback);
      request.onerror = () => resolve(fallback);
      tx.onabort = () => resolve(fallback);
    } catch {
      resolve(fallback);
    }
  });
}

/**
 * 못 보낸 사진을 담아 둡니다.
 *
 * ★ 이름을 그대로 들고 갑니다. 다시 보낼 때 같은 이름으로 올라가야
 *   나중에 목록에서 무엇인지 알아봅니다.
 */
export async function enqueuePhotos(
  files: File[],
  target: { orderId?: string; clinicOrgId?: string },
  reason: string,
): Promise<void> {
  for (const file of files) {
    const item: QueuedPhoto = {
      id: crypto.randomUUID(),
      orderId: target.orderId ?? null,
      clinicOrgId: target.clinicOrgId ?? null,
      fileName: file.name,
      mimeType: file.type || 'image/jpeg',
      blob: file,
      takenAt: Date.now(),
      tries: 0,
      lastReason: reason,
    };

    await run('readwrite', (store) => store.put(item), undefined);
  }
}

export async function listQueue(): Promise<QueuedPhoto[]> {
  const rows = await run<QueuedPhoto[]>('readonly', (store) => store.getAll(), []);
  return rows.sort((a, b) => a.takenAt - b.takenAt);
}

export async function dropFromQueue(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id), undefined);
}

/** 몇 번 해 봤는지와 마지막 이유를 적어 둡니다 */
export async function markTried(item: QueuedPhoto, reason: string): Promise<void> {
  await run(
    'readwrite',
    (store) => store.put({ ...item, tries: item.tries + 1, lastReason: reason }),
    undefined,
  );
}

/** 담아 둔 것을 다시 File 로. 올리는 쪽은 File 을 받습니다 */
export function fileOf(item: QueuedPhoto): File {
  return new File([item.blob], item.fileName, { type: item.mimeType });
}
