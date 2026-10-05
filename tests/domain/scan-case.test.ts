// =========================================================
// 놓을 위치: tests/domain/scan-case.test.ts
//
// Medit 내보내기 이름 읽기 (사용자 요청 2026-10-05).
// 값은 실제로 받은 내보내기에서 그대로 떼어 왔습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  isMeshFile,
  patientFromCaseName,
  patientFromMeshName,
  readMeditCase,
} from '@/server/domain/scan-case';

// 실제로 받은 한 벌 (2026-10-05)
const FOLDER = '2026-09-11-Test의 케이스';
const FILES = [
  '2026-09-09-최정여-mandibular.obj',
  '2026-09-09-최정여-maxillary.obj',
  '2026-09-09-최정여-occlusionfirst.obj',
];

describe('실제 Medit 내보내기', () => {
  const c = readMeditCase(FOLDER, FILES);

  /*
    ★★ 케이스 이름이 먼저입니다. 그것이 치과가 Medit 에 **적은** 환자입니다.
      파일 쪽 이름은 가져다 붙인 스캔의 환자일 수 있습니다
      (사용자 설명 — "내 스캔을 첨부해서 최정여로 나오는데 원래는 test").
  */
  it('★ 환자는 케이스 이름에서', () => {
    expect(c.patientName).toBe('Test');
  });

  it('스캔한 날은 파일 쪽이 더 정확합니다', () => {
    expect(c.scannedOn).toBe('2026-09-09');
  });

  it('같은 케이스를 다시 내보내도 같은 열쇠', () => {
    expect(readMeditCase(`${FOLDER}.zip`, FILES).caseKey).toBe(c.caseKey);
  });

  // ★ 치식은 Medit Link 안에만 있고 내보내기에 안 담깁니다 (2026-10-05 확인)
  it('★ 치식은 없습니다 — 적어 주지 않는 한', () => {
    expect(c.teeth).toEqual([]);
    expect(readMeditCase('2026-09-11-Test의 케이스 #26', FILES).teeth).toEqual([26]);
  });
});

/*
  ★★ 같은 이름이 이미 있으면 Medit 이 '…_(3)' 으로 폴더를 하나 더 만듭니다
    (사용자 제보 2026-10-05 — 내보내기 창 그림). 치과는 보통 이쪽을 고릅니다,
    덮어쓰기는 이전 결과를 지우니까요. 떼지 않으면 환자 이름이
    'Test의 케이스_(3)' 으로 주문서에 찍히고, 같은 케이스가 두 줄이 됩니다.
*/
describe('★ 같은 이름으로 또 내보냈을 때', () => {
  it('환자 이름에 꼬리가 안 붙습니다', () => {
    expect(patientFromCaseName('2026-09-11-Test의 케이스_(3)')).toBe('Test');
    expect(patientFromCaseName('2026-09-11-Test의 케이스_(1).zip')).toBe('Test');
  });

  it('같은 케이스로 봅니다 — 두 줄이 안 생깁니다', () => {
    const first = readMeditCase('2026-09-11-Test의 케이스', FILES).caseKey;
    expect(readMeditCase('2026-09-11-Test의 케이스_(3)', FILES).caseKey).toBe(first);
    expect(readMeditCase('2026-09-11-Test의 케이스_(1).zip', FILES).caseKey).toBe(first);
  });

  // ★ 치과가 이름에 진짜로 (2) 를 쓴 것까지 뺏지는 않습니다 — Medit 꼬리는 '_(N)' 입니다
  it('사람이 적은 괄호는 그대로 둡니다', () => {
    expect(patientFromCaseName('2026-09-11-김민수 (상악)')).toBe('김민수 (상악)');
  });
});

describe('케이스 이름에서 환자', () => {
  it("'…의 케이스' 를 뗍니다", () => {
    expect(patientFromCaseName('2026-09-11-Test의 케이스')).toBe('Test');
    expect(patientFromCaseName('2026-09-11-김민수의 케이스.zip')).toBe('김민수');
  });

  it('치과가 이름을 바꿔 뒀으면 그대로 씁니다', () => {
    expect(patientFromCaseName('2026-09-11-상악 재제작 김민수')).toBe('상악 재제작 김민수');
  });
});

describe('파일 이름에서 환자', () => {
  it('부위 꼬리를 뗍니다', () => {
    expect(patientFromMeshName('2026-09-09-최정여-maxillary.obj')).toBe('최정여');
    expect(patientFromMeshName('2026-09-09-최정여-occlusionfirst.obj')).toBe('최정여');
  });

  /*
    ★★ 꼬리가 부위일 때만 뗍니다. 무조건 마지막 토막을 버리면
      '2026-09-09-김민수.obj' 에서 환자를 버립니다.
  */
  it('★ 부위가 없으면 안 뗍니다', () => {
    expect(patientFromMeshName('2026-09-09-김민수.obj')).toBe('김민수');
  });

  it('성이 둘인 이름도 그대로', () => {
    expect(patientFromMeshName('2026-09-09-남궁 민수-lowerjaw.stl')).toBe('남궁 민수');
  });
});

describe('그물 파일인가', () => {
  it('obj·stl·ply 만', () => {
    expect(isMeshFile('a.obj')).toBe(true);
    expect(isMeshFile('a.STL')).toBe(true);
    expect(isMeshFile('a.ply')).toBe(true);
    expect(isMeshFile('a.dxd')).toBe(false);
    expect(isMeshFile('안내문.pdf')).toBe(false);
  });
});
