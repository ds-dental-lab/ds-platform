// =========================================================
// 놓을 위치: src/server/domain/file-access/index.ts
//
// 누가 어떤 파일을 열 수 있는가. (사용자 결정 2026-08-20 —
//   "기공소 계정은 스캔 데이터를 다운받을 수 없어야 해.
//    기공소는 쉐이드 파일만 봐야 하고 스캔 파일을 열어 봐서는 안 된다")
//
// ★ 기공소가 받는 것은 **센터가 만든 설계**입니다. 구강스캔 원본은
//   센터가 설계하는 데 쓰는 재료이지 기공소가 볼 것이 아닙니다.
//
// ★★ **막을 것을 세지 않고, 열 것만 셉니다.**
//   `.dxd .obj .stl .ply` 를 막는 식으로 짜면 새 스캐너가 `.3oxz` 를
//   뱉는 날 그대로 새어 나갑니다. 목록을 고치는 사람이 그 스캐너를
//   모르면 영영 안 고쳐집니다.
//   그래서 기공소에게는 **사진만** 엽니다 — 쉐이드 사진은 png·jpg 로
//   옵니다. 모르는 확장자는 전부 닫힙니다.
//
// ★ 확장자는 **믿을 수 있는 값이 아닙니다.** `.stl` 을 `.png` 로 바꿔
//   올리면 이 검사는 통과합니다. 그건 막을 수 없고, 막을 필요도
//   없습니다 — 그렇게까지 하는 사람은 이미 그 파일을 갖고 있습니다.
//   이 규칙이 막는 것은 **평범한 화면에서 흘러나가는 것**입니다.
//
// ★ 자사 제작을 조심해야 합니다.
//   디자인센터가 기공소 자리를 겸합니다(통합 모델). 주문의 '역할' 로
//   가르면 센터가 자기 주문의 스캔을 못 보게 됩니다.
//   그래서 **보는 사람의 소속(sector)** 으로만 가릅니다.
// =========================================================

import type { Sector } from '../order-status';

/**
 * 기공소에게 열어 주는 확장자 — 사진뿐입니다.
 *
 * ★ heic·heif 는 아이폰 사진입니다. 원장님이 폰으로 찍어 보내는 일이
 *   흔해서 빼면 안 됩니다.
 */
export const LAB_OPEN_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'heic',
  'heif',
] as const;

/** 파일명에서 확장자를 소문자로. 없으면 빈 글자 */
export function extensionOf(fileName: string): string {
  const name = (fileName ?? '').trim();
  const dot = name.lastIndexOf('.');

  // 이름이 '.' 로 시작하거나 확장자가 없으면 빈 글자
  if (dot <= 0 || dot === name.length - 1) return '';

  return name.slice(dot + 1).toLowerCase();
}

/** 기공소가 열어도 되는 사진인가 */
export function isLabOpenable(fileName: string): boolean {
  return (LAB_OPEN_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));
}

export interface FileForAccess {
  /** 'scan' | 'design' — 그 밖의 값은 스캔으로 봅니다 */
  kind: string;
  fileName: string;
}

/**
 * 이 사람이 이 파일을 못 여는가. 막을 이유가 있으면 그 말을, 없으면 null.
 *
 * ★ **디자인 파일은 확장자를 안 따집니다.**
 *   센터가 기공소에게 주라고 올린 것입니다. 거기에 stl 이 들어 있는
 *   것이 정상이고, 그게 곧 기공소가 깎을 원본입니다.
 *
 * ★ 치과·디자인센터는 아무것도 안 막습니다. 스캔은 치과가 올린
 *   자기 자료이고, 센터는 그걸로 설계합니다.
 */
export function fileBlockedFor(
  sector: Sector | null | undefined,
  file: FileForAccess,
): string | null {
  if (sector !== 'lab') return null;
  if (file.kind === 'design') return null;
  if (isLabOpenable(file.fileName)) return null;

  return '스캔 원본은 기공소에서 열 수 없습니다. 설계 파일로 작업해 주세요';
}

/** 목록에서 자물쇠를 그릴지 판단할 때 씁니다 */
export function isFileBlockedFor(
  sector: Sector | null | undefined,
  file: FileForAccess,
): boolean {
  return fileBlockedFor(sector, file) !== null;
}
