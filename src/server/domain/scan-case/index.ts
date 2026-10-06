// =========================================================
// 놓을 위치: src/server/domain/scan-case/index.ts
//
// 스캐너가 내보낸 **이름**에서 케이스 읽기 (사용자 요청 2026-10-05 — Medit).
//
// ★★ Medit 내보내기에는 **파일 안에 아무 정보가 없습니다.** obj 머리글은
//   `#<MEDIT>` 한 줄뿐입니다 (실파일 확인 2026-10-05). 환자 이름도 날짜도
//   전부 **이름에만** 있습니다. dxd 와 정반대입니다.
//
//     폴더/zip : 2026-09-11-Test의 케이스      ← 내보낸 날짜 + 케이스 이름
//     파일     : 2026-09-09-최정여-maxillary.obj ← 스캔 날짜 + 환자 + 부위
//
// ★ 케이스 이름을 먼저 봅니다. 그것이 치과가 Medit 에 **적은** 환자이고,
//   파일 쪽 이름은 가져다 붙인 스캔의 환자일 수 있습니다 (사용자 설명 —
//   "내 스캔을 첨부해서 최정여로 나오는데 원래는 test").
//
// ★ 치식은 여기서 못 읽습니다. Medit Link 안에만 있고 내보내기에 안 담깁니다.
//   이름에 '#26' 처럼 적어 주면 그것만 읽습니다 (dxd 와 같은 규칙).
// =========================================================

import { teethFromName } from '@/server/domain/dxd';

/** exocad 런처가 알아보는 부위 이름 — 이 꼬리는 환자 이름이 아닙니다 */
export const REGION_WORDS = [
  'maxillary',
  'upperjaw',
  'upper',
  'mandibular',
  'lowerjaw',
  'lower',
  'occlusionfirst',
  'occlusion',
  'bite',
  'marker',
  'preop',
  'scanbody',
  'gingiva',
];

/** 스캔으로 받는 그물 파일 */
export const MESH_EXTENSIONS = ['.obj', '.stl', '.ply'];

export function isMeshFile(name: string): boolean {
  const lower = name.toLowerCase();
  return MESH_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const DATE_HEAD = /^\d{4}-\d{2}-\d{2}[-_ ]+/;

/**
 * 같은 이름이 이미 있을 때 Medit 이 붙이는 꼬리 — '…_(1)', '…_(3)'.
 *
 * ★★ 떼지 않으면 두 군데가 틀립니다 (사용자 제보 2026-10-05, 내보내기 창 그림).
 *   ① 환자 이름이 'Test의 케이스_(3)' 으로 주문서에 찍힙니다.
 *   ② 같은 케이스인데 열쇠가 달라져 '주문서 대기' 에 두 줄이 생깁니다.
 *   치과는 '새로운 폴더를 만들고 내보내기' 를 고르는 쪽이 보통입니다 —
 *   덮어쓰기는 이전 결과를 지우니까요. 즉 흔한 길입니다.
 */
const COPY_TAIL = /_\(\d+\)$/;

/** 맨 앞의 'YYYY-MM-DD-' 를 뗍니다. 날짜는 이름이 아닙니다 */
function withoutDate(name: string): string {
  return name.replace(DATE_HEAD, '').replace(COPY_TAIL, '').trim();
}

/** '…_(3)' 과 '…' 은 같은 케이스입니다 */
export function withoutCopyTail(name: string): string {
  return name.replace(/\.zip$/i, '').trim().replace(COPY_TAIL, '').trim();
}

/** 맨 앞의 날짜만 따로 */
export function dateInName(name: string): string {
  return /^(\d{4}-\d{2}-\d{2})/.exec(name)?.[1] ?? '';
}

/**
 * 케이스 이름에서 환자 — '2026-09-11-Test의 케이스' → 'Test'.
 *
 * ★ Medit 은 케이스를 '<환자>의 케이스' 로 자동으로 짓습니다. 치과가 이름을
 *   바꿔 뒀으면 바꾼 그대로 씁니다 — 넘겨짚지 않습니다.
 */
export function patientFromCaseName(folder: string): string {
  const body = withoutDate(folder.replace(/\.zip$/i, ''));
  return body.replace(/[의]?\s*케이스$/u, '').trim() || body;
}

/**
 * 그물 파일 이름에서 환자 — '2026-09-09-최정여-maxillary.obj' → '최정여'.
 *
 * ★ 꼬리가 부위 이름일 때만 뗍니다. '2026-09-09-김민수.obj' 처럼 부위가 없는
 *   파일도 있어서, 무조건 마지막 토막을 버리면 환자를 버립니다.
 */
export function patientFromMeshName(file: string): string {
  const body = withoutDate(file.replace(/\.[^.]+$/, ''));
  const cut = body.lastIndexOf('-');
  if (cut < 0) return body.trim();

  const tail = body.slice(cut + 1).trim().toLowerCase();
  const isRegion = REGION_WORDS.some((w) => tail === w || tail.startsWith(w));
  return (isRegion ? body.slice(0, cut) : body).trim();
}

export interface MeditCase {
  patientName: string;
  /** 'YYYY-MM-DD' — 스캔한 날 (파일 이름 쪽이 더 정확합니다) */
  scannedOn: string;
  teeth: number[];
  /** 같은 케이스를 두 번 올리지 않기 위한 열쇠 */
  caseKey: string;
}

/**
 * Medit 내보내기 한 벌(폴더나 zip)에서 읽습니다.
 *
 * ★ 케이스 번호가 없으니 **폴더 이름**을 열쇠로 씁니다. 같은 케이스를 다시
 *   내보내면 같은 이름이 나와 두 줄이 생기지 않습니다 (dxd 의 CaseGUID 자리).
 */
export function readMeditCase(folderName: string, fileNames: string[]): MeditCase {
  const meshes = fileNames.filter(isMeshFile);

  const fromCase = patientFromCaseName(folderName);
  const fromMesh = meshes.map(patientFromMeshName).find(Boolean) ?? '';

  const teeth = teethFromName(folderName);

  return {
    patientName: fromCase || fromMesh,
    scannedOn: (meshes.map(dateInName).find(Boolean) || dateInName(folderName)) ?? '',
    teeth: teeth.length > 0 ? teeth : teethFromName(meshes.join(' ')),
    caseKey: `medit:${withoutCopyTail(folderName)}`,
  };
}
