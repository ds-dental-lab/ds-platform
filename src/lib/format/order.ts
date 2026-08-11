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

/**
 * 긴 이름의 가운데를 접습니다 — `ORD-260811-0…_스캔12.obj`
 *
 * ★ 끝을 자르면 안 됩니다.
 *   파일 이름은 앞이 주문번호, 뒤가 몇 번째인지입니다. 끝을 자르면
 *   한 주문의 파일 셋이 화면에서 똑같아 보입니다.
 *   앞과 뒤를 남기고 가운데를 접어야 어느 것이 어느 것인지 알아봅니다.
 *
 * ★ 기본 28자는 주문상세 파일칸에 들어가는 폭입니다.
 *   CSS 의 truncate 도 함께 걸어 둡니다 — 창을 줄이면 그쪽이 더 자릅니다.
 *   여기서 접는 것은 '어느 정도 넓을 때 가운데를 접는' 몫입니다.
 */
export function middleEllipsis(name: string, max = 28): string {
  if (name.length <= max) return name;

  const head = Math.ceil((max - 1) * 0.55);
  const tail = max - 1 - head;

  return `${name.slice(0, head)}…${name.slice(-tail)}`;
}
