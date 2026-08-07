// =========================================================
// 놓을 위치: src/components/dental/ToothChart/toothShapes.ts
//
// 치종별 외곽선. (기능명세서 §4.2.5)
//
// 모든 경로는 100×100 상자를 꽉 채우게 그려져 있고,
// 실제 크기는 width · height 로 따로 지정합니다.
// 어금니는 넓고 낮게, 앞니는 좁고 길게 — 실제 치아 비율입니다.
// =========================================================

import type { ToothType, Arch } from '@/server/domain/tooth';

interface ShapeSpec {
  path: string;
  width: number;
  height: number;
}

// ---------- 상악 ----------

const UPPER: Record<ToothType, ShapeSpec> = {
  // 지치 — 둥근 덩어리
  third_molar: {
    width: 52, height: 46,
    path: 'M 4 42 C 4 16 22 2 50 2 C 78 2 96 16 96 42 C 96 72 82 97 50 99 C 18 97 4 72 4 42 Z',
  },
  // 제2대구치 — 얕은 홈
  second_molar: {
    width: 56, height: 46,
    path: 'M 4 40 C 4 14 22 2 40 9 C 46 12 49 20 52 26 C 55 19 60 10 66 7 C 82 1 97 15 96 42 C 95 72 82 96 60 98 C 52 99 43 99 35 97 C 15 93 4 68 4 40 Z',
  },
  // 제1대구치 — 두 개의 봉우리
  first_molar: {
    width: 60, height: 47,
    path: 'M 3 42 C 3 14 22 2 38 10 C 45 14 48 22 50 28 C 52 22 55 14 62 10 C 78 2 97 14 97 42 C 97 72 84 96 62 98 C 54 99 46 99 38 98 C 16 96 3 72 3 42 Z',
  },
  // 소구치 — 작고 둥글게
  second_premolar: {
    width: 42, height: 52,
    path: 'M 5 38 C 5 14 22 2 50 2 C 78 2 95 14 95 38 C 95 66 78 94 50 99 C 22 94 5 66 5 38 Z',
  },
  first_premolar: {
    width: 42, height: 52,
    path: 'M 6 36 C 6 13 24 2 50 2 C 76 2 94 13 94 36 C 94 65 77 93 50 99 C 23 93 6 65 6 36 Z',
  },
  // 견치 — 길고 뾰족한 타원
  canine: {
    width: 44, height: 60,
    path: 'M 6 34 C 6 12 24 2 50 2 C 76 2 94 12 94 34 C 94 62 78 88 50 99 C 22 88 6 62 6 34 Z',
  },
  // 측절치
  lateral_incisor: {
    width: 38, height: 55,
    path: 'M 6 17 C 6 8 18 2 50 2 C 82 2 94 8 94 17 C 94 47 86 76 67 95 C 60 100 40 100 33 95 C 14 76 6 47 6 17 Z',
  },
  // 중절치 — 앞니 중 가장 넓고 길다
  central_incisor: {
    width: 48, height: 60,
    path: 'M 4 16 C 4 7 16 2 50 2 C 84 2 96 7 96 16 C 96 46 88 76 68 95 C 60 100 40 100 32 95 C 12 76 4 46 4 16 Z',
  },
};

// ---------- 하악 ----------

const LOWER: Record<ToothType, ShapeSpec> = {
  third_molar: {
    width: 56, height: 46,
    path: 'M 4 44 C 4 17 22 3 50 3 C 78 3 96 17 96 44 C 96 73 82 97 50 99 C 18 97 4 73 4 44 Z',
  },
  second_molar: {
    width: 60, height: 46,
    path: 'M 3 42 C 3 15 20 3 38 10 C 45 13 48 21 51 27 C 54 20 59 12 66 8 C 82 1 97 16 96 44 C 95 73 82 96 60 99 C 52 100 42 100 34 98 C 13 94 3 70 3 42 Z',
  },
  // 하악 제1대구치 — 봉우리 셋으로 가장 넓다
  first_molar: {
    width: 64, height: 47,
    path: 'M 3 44 C 3 16 18 3 32 10 C 39 14 43 22 46 28 C 49 22 53 13 60 9 C 76 1 97 14 97 44 C 97 73 84 96 62 99 C 53 100 43 100 35 99 C 14 96 3 73 3 44 Z',
  },
  second_premolar: {
    width: 42, height: 52,
    path: 'M 5 38 C 5 14 22 2 50 2 C 78 2 95 14 95 38 C 95 66 78 94 50 99 C 22 94 5 66 5 38 Z',
  },
  first_premolar: {
    width: 40, height: 52,
    path: 'M 6 36 C 6 13 24 2 50 2 C 76 2 94 13 94 36 C 94 65 77 93 50 99 C 23 93 6 65 6 36 Z',
  },
  // 하악 견치 — 치아 중 가장 길다
  canine: {
    width: 42, height: 62,
    path: 'M 7 33 C 7 11 25 2 50 2 C 75 2 93 11 93 33 C 93 62 77 88 50 99 C 23 88 7 62 7 33 Z',
  },
  // 하악 앞니 — 좁고 길다
  lateral_incisor: {
    width: 36, height: 56,
    path: 'M 8 18 C 8 8 20 2 50 2 C 80 2 92 8 92 18 C 92 48 85 76 67 95 C 60 100 40 100 33 95 C 15 76 8 48 8 18 Z',
  },
  central_incisor: {
    width: 33, height: 53,
    path: 'M 9 19 C 9 9 21 2 50 2 C 79 2 91 9 91 19 C 91 48 84 76 67 95 C 60 100 40 100 33 95 C 16 76 9 48 9 19 Z',
  },
};

/** 가장 큰 치아의 세로 길이. 줄 높이와 정렬 기준이 됩니다 */
export const MAX_TOOTH_HEIGHT = 62;

export function getShape(type: ToothType, arch: Arch): ShapeSpec {
  return arch === 'upper' ? UPPER[type] : LOWER[type];
}
