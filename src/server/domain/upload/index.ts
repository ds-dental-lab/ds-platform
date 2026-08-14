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

/** 파일 한 개 상한. 버킷에도 같은 값을 겁니다 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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

/** 상한을 넘었는가 */
export function tooBig(size: number): boolean {
  return size > MAX_UPLOAD_BYTES;
}

/** 사람에게 보여 줄 크기 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
