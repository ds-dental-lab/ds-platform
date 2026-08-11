// =========================================================
// 놓을 위치: src/lib/format/order.ts
//
// 주문목록 · 주문상세에서 쓰는 한글 표기.
// =========================================================

export const ORDER_TYPE_LABEL: Record<string, string> = {
  modelless: '모델리스',
  analog: '아날로그',
  with_model: '모델 포함',
  model_only: '모델만',
  repair: '리페어',
};

export const FILE_KIND_LABEL: Record<string, string> = {
  scan: '스캔',
  design: '디자인',
  photo: '사진',
  etc: '기타',
};

export function formatBytes(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
