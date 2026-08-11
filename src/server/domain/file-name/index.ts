// =========================================================
// 놓을 위치: src/server/domain/file-name/index.ts
//
// 올라온 파일에 붙일 이름을 정합니다.
//
// ★ 원본 이름을 버립니다.
//   치과가 보내는 스캔 파일 이름에는 환자 이름이 그대로 들어 있습니다 —
//   `2026-08-11-박나래-26.obj`, `2026-08-07_노승희(23384)-17-....stl`.
//   지금까지 열여덟 개 중 열세 개가 그랬습니다.
//
//   저장소 경로는 진작 이름을 뗐지만(uuid), 표시용 이름은 원본 그대로였고
//   내려받으면 **그 이름으로 기공소 PC 에 저장**됩니다. 그 순간 환자 이름이
//   우리 손을 떠납니다 — 열람기록도, 보관기간도, 파기도 닿지 않는 곳으로.
//   메일로 옮겨지고 카톡으로 전달되고 백업에 실립니다.
//
//   그래서 **저장할 때 이름을 새로 짓습니다.** 원본은 어디에도 남기지
//   않습니다. 어딘가에 한 칸이라도 남겨 두면, RLS 는 행 단위라 그 칸만
//   가릴 방법이 없습니다 (제품 판매가에서 이미 겪었습니다).
//
// ★ 원본에서 가져오는 것은 확장자뿐입니다.
//   `.stl` 인지 `.obj` 인지는 열 프로그램을 고르는 데 필요하고,
//   확장자에 사람 이름이 들어갈 수는 없습니다.
//
// ★ 치식을 이름에 넣지 않습니다.
//   `2026-08-11-박나래-26.obj` 의 `26` 은 치식처럼 보이지만 `2026`·`08`·`11`
//   도 똑같이 두 자리 숫자입니다. 어느 것이 치식인지 파일 이름만 보고는
//   알 수 없습니다. 틀린 치식이 적힌 파일은 이름 없는 파일보다 훨씬
//   위험합니다 — 기공소가 그걸 믿고 다른 이를 만듭니다.
//   무엇을 만드는지는 주문서가 말합니다. 파일 이름이 말할 일이 아닙니다.
// =========================================================

/** order_files.kind 와 같습니다 */
export type OrderFileKind = 'scan' | 'design' | 'photo' | 'etc';

/** 이름 가운데 들어갈 말. 폴더에서 눈으로 갈라 보는 용도입니다 */
export const FILE_KIND_TAG: Record<OrderFileKind, string> = {
  scan: '스캔',
  design: '디자인',
  photo: '사진',
  etc: '기타',
};

const TAGS = Object.values(FILE_KIND_TAG);

/**
 * 확장자만 뽑습니다 — 없으면 빈 문자열.
 *
 * ★ 마지막 점 뒤만 봅니다. `김형철.v1.html` → `html`
 * ★ 영문·숫자가 아닌 글자는 버립니다. 확장자 자리에 한글이 들어와도
 *   그것은 확장자가 아니라 이름의 일부입니다.
 */
export function fileExt(name: string, max = 10): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return '';

  const raw = name.slice(dot + 1);
  if (raw.length > max) return '';

  const clean = raw.replace(/[^A-Za-z0-9]/g, '');

  return clean.length === raw.length ? clean : '';
}

/**
 * 새로 지은 이름 — `ORD-260811-013_스캔1.obj`
 *
 * 주문번호를 앞에 둡니다. 기공소는 여러 주문의 파일을 한 폴더에 받아 두는데,
 * 그때 어느 주문 것인지가 가장 먼저 필요합니다.
 */
export function maskFileName(
  orderNo: string,
  kind: OrderFileKind,
  seq: number,
  originalName: string,
): string {
  const ext = fileExt(originalName);

  return `${orderNo}_${FILE_KIND_TAG[kind]}${seq}${ext ? '.' + ext : ''}`;
}

/**
 * 이미 우리가 지은 이름인가.
 *
 * ★ 이 규칙은 DB 트리거(`mask_order_file_name`)와 **글자 그대로 같아야**
 *   합니다. 여기서 통과시킨 이름을 DB 가 다시 고쳐 쓰면, 화면이 보여 주는
 *   이름과 실제로 내려받는 이름이 어긋납니다.
 */
export function isMaskedName(orderNo: string, name: string): boolean {
  const pattern = new RegExp(
    `^${escapeRegExp(orderNo)}_(${TAGS.join('|')})\\d+(\\.[A-Za-z0-9]{1,10})?$`,
  );

  return pattern.test(name);
}

/**
 * 이 주문·이 종류에서 다음에 쓸 번호.
 *
 * ★ 개수를 세지 않고 **쓰인 번호**를 봅니다.
 *   두 개 올리고 하나를 지우면 개수는 1 이지만 `스캔2` 는 이미 쓰였습니다.
 *   개수로 세면 `스캔2` 가 둘이 되어, 목록에서 같은 이름 두 개가 보입니다.
 */
export function nextFileSeq(orderNo: string, kind: OrderFileKind, existing: string[]): number {
  const pattern = new RegExp(`^${escapeRegExp(orderNo)}_${FILE_KIND_TAG[kind]}(\\d+)`);

  let max = 0;
  for (const name of existing) {
    const hit = pattern.exec(name);
    if (hit) max = Math.max(max, Number(hit[1]));
  }

  return max + 1;
}

/** 한 번에 여러 개. 번호가 이어집니다 */
export function maskFileNames(
  orderNo: string,
  kind: OrderFileKind,
  originalNames: string[],
  existing: string[] = [],
): string[] {
  const start = nextFileSeq(orderNo, kind, existing);

  return originalNames.map((name, i) => maskFileName(orderNo, kind, start + i, name));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- 빠진 파일 다시 올릴 때 짝 맞추기 ----------

/** 아직 저장소에 없는 줄. 이름은 이미 새로 지어졌습니다 */
export interface FileSlot {
  id: string;
  fileName: string;
  fileSize: number | null;
}

/** 다시 고른 파일 한 개 */
export interface PickedFile {
  name: string;
  size: number;
}

/**
 * 다시 고른 파일을 빈 줄에 붙입니다.
 *
 * ★ 전에는 **이름으로** 맞췄습니다. 이제는 못 합니다 —
 *   줄에 남은 이름은 우리가 지은 `ORD-…_스캔2.obj` 이고, 사람이 다시 고르는
 *   파일은 자기 PC 의 `박나래-26.obj` 입니다. 영영 안 만납니다.
 *
 * ★ 크기 + 확장자로 맞춥니다.
 *   끊긴 줄에는 고를 때 적어 둔 바이트 수가 그대로 남아 있습니다.
 *   같은 파일을 다시 고르면 크기가 한 바이트도 다르지 않습니다.
 *
 * ★ 못 맞춘 것은 새 줄이 됩니다.
 *   억지로 남은 줄에 끼워 넣으면 다른 파일이 그 자리에 앉습니다.
 *   줄이 하나 더 생기는 것은 눈에 보이지만, 바꿔치기는 안 보입니다.
 */
export function matchMissingFiles(
  slots: FileSlot[],
  picked: PickedFile[],
): (string | null)[] {
  const pool = slots.map((slot) => ({ ...slot, taken: false }));

  return picked.map((file) => {
    const ext = fileExt(file.name);

    const hit = pool.find(
      (slot) =>
        !slot.taken && slot.fileSize === file.size && fileExt(slot.fileName) === ext,
    );

    if (!hit) return null;

    hit.taken = true;

    return hit.id;
  });
}
