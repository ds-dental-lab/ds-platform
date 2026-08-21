// =========================================================
// 놓을 위치: src/server/domain/shade-photo/index.ts
//
// 쉐이드 포토의 규칙. (명세서 SPEC_shade-photo, 사용자 결정 2026-08-21)
//
// ★ 만드는 이유 — 치과는 지금 폰으로 찍어 **카카오톡**으로 보냅니다.
//     ① 카톡이 눌러서 색이 왜곡됩니다 (쉐이드 판별에 치명적)
//     ② 대화방에 여러 환자가 섞여 어느 건인지 헷갈립니다
//     ③ 나중에 그 환자 사진을 못 찾습니다
//   답은 **사진이 처음부터 그 주문에 붙게** 하는 것입니다. 분류할
//   일이 아예 없어집니다.
//
// ★★ **쉐이드 사진은 안 줄입니다** (사용자 결정 2026-08-21).
//   다른 사진은 2026-08-14 결정대로 1600px·WebP 로 줄입니다. 그런데
//   쉐이드는 **카톡의 압축을 피하려고** 만드는 기능입니다 — 우리가
//   또 줄이면 만드는 이유가 없어집니다.
//   저장소는 하루 30건×3장×4MB 로 180일에 65GB 어름, 스캔 파일의
//   10분의 1입니다. 그 값은 치를 만합니다.
// =========================================================

import type { OrderStatus } from '../order-status';

/**
 * 진료실 화면에 세울 주문인가.
 *
 * ★ 아직 만들고 있는 것만 찍습니다. 배송이 나간 뒤에 쉐이드를 찍는
 *   일은 없습니다 — 있다면 그건 리메이크입니다.
 */
const SHOOTABLE: OrderStatus[] = ['uploading', 'received', 'rescan', 'designing'];

export function canShoot(status: OrderStatus): boolean {
  return SHOOTABLE.includes(status);
}

/**
 * 이 파일이 쉐이드 사진인가.
 *
 * ★ 확장자로 봅니다. 기공소에게 열어 주는 목록과 **같은 잣대**여야
 *   합니다 — 화면에서 '촬영 완료' 라고 해 놓고 기공소가 못 여는
 *   파일이면 거짓말이 됩니다 (domain/file-access).
 */
const PHOTO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'heif'];

export function isPhoto(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return false;

  return PHOTO_EXTENSIONS.includes(fileName.slice(dot + 1).toLowerCase());
}

/** 쉐이드 상태 — 사진이 한 장이라도 붙었으면 끝난 것입니다 */
export type ShadeStatus = 'waiting' | 'done';

export function shadeStatusOf(files: { file_name: string; kind: string }[]): ShadeStatus {
  /*
    ★ 디자인 파일은 안 셉니다. 그건 센터가 만든 것이지 진료실이
      찍은 것이 아닙니다. 미리보기 png 가 섞여 있어 헷갈립니다.
  */
  return files.some((f) => f.kind !== 'design' && isPhoto(f.file_name)) ? 'done' : 'waiting';
}

export const SHADE_STATUS_LABEL: Record<ShadeStatus, string> = {
  waiting: '쉐이드 대기',
  done: '촬영 완료',
};

/**
 * 찍은 사진에 붙일 이름.
 *
 * ★ 환자 이름을 안 씁니다. 파일명이 그대로 저장소 경로에 남고,
 *   내려받을 때 사람 눈에도 보입니다 (설계서 §8.5 · 파일명 마스킹).
 *   주문번호와 찍은 순서면 충분합니다.
 */
export function shadePhotoName(orderNo: string, index: number, takenAt: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${takenAt.getFullYear()}${two(takenAt.getMonth() + 1)}${two(takenAt.getDate())}` +
    `-${two(takenAt.getHours())}${two(takenAt.getMinutes())}`;

  return `${orderNo}_shade${index + 1}_${stamp}.jpg`;
}

/**
 * 컷 체크리스트. (명세서 S3)
 *
 * ★ 순서는 **권장이지 강제가 아닙니다.** 셔터는 언제나 눌립니다 —
 *   바쁜 진료실에서 절차가 걸림돌이 되면 안 됩니다.
 */
export const SHADE_CUTS = ['① 쉐이드탭 포함', '② 정면', '③ 자유컷'] as const;

/** 홈 목록에 세우는 기간. 그 이전은 검색으로만 (명세서 S1) */
export const HOME_DAYS = 7;
