// =========================================================
// 놓을 위치: src/server/domain/upload/index.ts
//
// 올리는 파일의 규칙. (사용자 요청 2026-08-14 — 저장소 아끼기)
//
// ★ 상한이 **두 군데에 흩어져 있었습니다** (ScanDropZone, DesignFileUpload).
//   같은 100MB 를 두 번 적어 두면 언젠가 한쪽만 고칩니다. 여기로 모읍니다.
//
// ★ 형식(mime) 로는 못 거릅니다. 치과가 올리는 것들이 대개
//   `application/octet-stream` 이거나 아예 빈 값으로 옵니다 —
//   `.dxd` `.stl` `.constructioninfo` 가 다 그렇습니다. 그걸 허용하면
//   결국 아무거나 허용하는 것과 같습니다. **크기로 겁니다.**
//
// ★ exocad webview(`.html`)가 실제로 올라옵니다. 설계를 브라우저에서
//   3D 로 돌려 보는 파일이라 한 개가 5MB 쯤 됩니다.
//   확장자를 좁게 잡으면 **이게 먼저 막힙니다.**
// =========================================================

/**
 * 파일 한 개 상한. 버킷에도 같은 값을 겁니다.
 *
 * ★ 100 → 300 → **500MB** (작업지시서 2026-08-20 확정값).
 *   "1건이 150MB 로 한 덩어리로 올 때도 있고, 3개로 각 50MB,
 *    10개로 각 10MB 로 올 때도 있다."
 *   실제 최대(150MB)의 세 배로 잡습니다 — 스캐너를 바꾸거나 케이스가
 *   커지면 파일도 같이 큽니다. 여기서 막히면 치과는 이유를 모른 채
 *   주문을 못 넣습니다.
 *
 * ★ 그래도 상한은 둡니다. 실수로 고른 동영상 한 개가 저장소를
 *   갉아먹는 것을 막는 마지막 선입니다.
 */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/**
 * ★★ **지금 서버가 실제로 받는 한계는 50MB 입니다** (2026-08-20 실측).
 *
 *   버킷에 500MB 를 적어 뒀는데도 50MB 를 넘으면 저장소가
 *   `413 Maximum size exceeded` 로 거절합니다 — 파일을 보내기도 전에,
 *   크기만 보고 거절합니다.
 *
 *   **버킷 상한과 별개로 프로젝트 전체 상한이 있습니다.**
 *   무료 요금제는 그 값이 50MB 로 고정이고 못 올립니다.
 *   Pro 로 올려야 대시보드(Storage → Settings)에서 풀 수 있습니다.
 *
 *   ★ 그래서 버킷 값만 고치는 것은 **아무 효과가 없습니다.**
 *     100 → 300 → 500MB 로 두 번 올렸는데 둘 다 소용없었고,
 *     실제 파일을 올려 보고서야 알았습니다.
 *
 *   ★ Pro 로 올려 상한을 푼 뒤에는 **이 상수를 지우세요.**
 *     남겨 두면 풀린 뒤에도 화면이 계속 겁을 줍니다.
 */
export const SERVER_CEILING_BYTES = 50 * 1024 * 1024;

/**
 * 지금 요금제에서 못 받는 크기인가.
 *
 * ★ 미리 걸러 주는 것이 낫습니다. 서버가 어차피 거절하지만, 그때는
 *   '주문은 만들어졌는데 파일이 없는' 상태가 남습니다.
 */
export function overServerCeiling(size: number): boolean {
  return size > SERVER_CEILING_BYTES;
}

// ---------- 사진 줄이기 ----------
//
// ★ 저장소의 3분의 1이 사진이었습니다 (31.3MB 중 10.3MB, 2026-08-14).
//   쉐이드 사진은 원본 화질이 필요 없습니다 — 색과 형태를 보는 것이지
//   1:1 로 재는 것이 아닙니다.
//
// ★ 스캔·설계 파일은 **절대 안 건드립니다.** 그건 치수 자체입니다.

/** 줄일 대상 */
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg'];

/** 이보다 작으면 그냥 둡니다 — 줄여 봐야 얼마 안 되고 손만 갑니다 */
export const MIN_COMPRESS_BYTES = 300 * 1024;

/** 긴 변을 여기에 맞춥니다 */
export const MAX_IMAGE_EDGE = 1600;

/** WebP 화질. 0.82 면 눈으로 차이를 못 느끼는 선입니다 */
export const IMAGE_QUALITY = 0.82;

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

/** 이 파일을 줄일까 */
export function shouldCompress(name: string, size: number): boolean {
  if (!IMAGE_EXTS.includes(extOf(name))) return false;
  return size >= MIN_COMPRESS_BYTES;
}

/** 줄인 뒤에 붙일 이름 */
export function webpName(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot < 0 ? name : name.slice(0, dot)) + '.webp';
}

/**
 * 긴 변을 맞춘 크기. 이미 작으면 그대로 둡니다.
 *
 * ★ 키우지 않습니다. 작은 사진을 늘리면 용량만 늘고 화질은 그대로입니다.
 */
export function fitEdge(
  width: number,
  height: number,
  max: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height };

  const ratio = max / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * 줄인 것을 쓸까, 원본을 쓸까.
 *
 * ★ **줄였는데 더 커지는 일이 있습니다.** 색이 몇 개 안 되는 그림이나
 *   이미 잘 눌린 PNG 가 그렇습니다. 그때 줄인 것을 쓰면 용량을 아끼려다
 *   늘리는 셈입니다.
 *
 * ★ 조금 줄어든 정도로는 안 바꿉니다. 이름이 `.webp` 로 바뀌는 값을
 *   치르는 일이라, 눈에 띄게 줄 때만 바꿉니다.
 */
export function worthReplacing(originalBytes: number, compressedBytes: number): boolean {
  if (compressedBytes <= 0) return false;
  return compressedBytes < originalBytes * 0.9;
}

/**
 * 주문 하나에 올릴 수 있는 **전체** 크기 (작업지시서 확정값).
 *
 * ★ 파일 하나만 재면 못 막는 사고가 있습니다 — **폴더째 끌어다 놓기**.
 *   스캐너 프로젝트 폴더를 통째로 던지면 40MB 짜리 서른 개가 됩니다.
 *   하나하나는 다 통과하는데 합치면 1.2GB 입니다.
 *
 * ★ 실제 한 건이 150MB 어름이니 여섯 배 남깁니다. 정상적인 주문이
 *   여기 걸리면 안 됩니다 — 이 선은 사고를 막는 것이지 살림하는 것이
 *   아닙니다(살림은 보관기간이 합니다).
 */
export const MAX_ORDER_TOTAL_BYTES = 1024 * 1024 * 1024;

/**
 * 이 크기를 넘으면 **이어올리기**로 보냅니다 (Supabase 권장 기준).
 *
 * ★ 작은 파일까지 이어올리기로 보내면 오히려 느립니다 — 만들고
 *   조각내고 확인하는 왕복이 파일 자체보다 큽니다.
 *   10MB 열 개짜리 주문이 느려지면 안 됩니다.
 */
export const RESUMABLE_MIN_BYTES = 6 * 1024 * 1024;

/**
 * 이어올리기 조각 크기.
 *
 * ★ **6MB 여야 합니다.** Supabase 의 이어올리기가 그 크기를 요구합니다 —
 *   다르게 보내면 통째로 거절합니다. 마음대로 바꾸지 마세요.
 */
export const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

/** 이 파일은 이어올리기로 보내야 하는가 */
export function needsResumable(size: number): boolean {
  return size > RESUMABLE_MIN_BYTES;
}

/** 상한을 넘었는가 */
export function tooBig(size: number): boolean {
  return size > MAX_UPLOAD_BYTES;
}

/**
 * 이 묶음을 올려도 되는가. 막을 이유가 있으면 그 말을, 없으면 null.
 *
 * ★ **파일 하나 검사와 총량 검사를 한 곳에서** 합니다.
 *   화면마다 따로 재면 한 곳은 총량을 빠뜨립니다 — 실제로 스캔칸과
 *   디자인칸 둘이 각자 재고 있었습니다.
 *
 * ★ 큰 놈부터 이름을 댑니다. "이 중에 큰 게 있습니다" 로는 어느 것을
 *   빼야 할지 모릅니다.
 */
export function checkUploadBatch(
  files: { name: string; size: number }[],
): string | null {
  /*
    ★ 요금제 상한이 먼저입니다 (2026-08-20).
      지금은 50MB 를 넘으면 서버가 받지 않습니다. 화면에서 미리 잡아야
      '주문은 만들어졌는데 파일이 없는' 상태가 안 남습니다.
      Pro 로 올려 상한을 풀면 이 검사를 지웁니다.
  */
  const overCeiling = files.filter((f) => overServerCeiling(f.size));

  if (overCeiling.length > 0) {
    const names = [...overCeiling]
      .sort((a, b) => b.size - a.size)
      .map((f) => `${f.name} (${formatBytes(f.size)})`)
      .join(', ');

    return (
      `${names} — 지금은 ${formatBytes(SERVER_CEILING_BYTES)} 까지만 올릴 수 있습니다. ` +
      '저장소 요금제 상한이라, 올리려면 관리자에게 문의해 주세요'
    );
  }

  const over = files.filter((f) => tooBig(f.size));

  if (over.length > 0) {
    const names = [...over]
      .sort((a, b) => b.size - a.size)
      .map((f) => f.name)
      .join(', ');

    return `${names} 은(는) ${formatBytes(MAX_UPLOAD_BYTES)} 를 넘어 올릴 수 없습니다`;
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);

  if (total > MAX_ORDER_TOTAL_BYTES) {
    return (
      `한 번에 ${formatBytes(total)} 는 너무 많습니다 ` +
      `(주문 하나에 ${formatBytes(MAX_ORDER_TOTAL_BYTES)} 까지). ` +
      '폴더째 고르신 것은 아닌지 확인해 주세요'
    );
  }

  return null;
}

/** 사람에게 보여 줄 크기 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
