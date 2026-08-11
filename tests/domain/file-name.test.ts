import { describe, it, expect } from 'vitest';
import {
  fileExt,
  maskFileName,
  maskFileNames,
  nextFileSeq,
  isMaskedName,
  matchMissingFiles,
} from '@/server/domain/file-name';

const NO = 'ORD-260811-013';

describe('fileExt', () => {
  it('마지막 점 뒤만 봅니다', () => {
    expect(fileExt('2026-08-11_김형철.v1.html')).toBe('html');
  });

  it('점이 없으면 빈 문자열', () => {
    expect(fileExt('상악스캔')).toBe('');
  });

  it('점으로 끝나면 빈 문자열', () => {
    expect(fileExt('상악스캔.')).toBe('');
  });

  // 확장자 자리에 한글이 오면 그건 확장자가 아니라 이름의 일부입니다.
  // 잘라서 담으면 이름 조각이 새어 나갑니다
  it('영문·숫자가 아닌 글자가 섞이면 버립니다', () => {
    expect(fileExt('스캔.박나래')).toBe('');
    expect(fileExt('scan.st l')).toBe('');
  });

  it('확장자처럼 보이기엔 너무 길면 버립니다', () => {
    expect(fileExt('a.박나래환자님상악스캔데이터')).toBe('');
  });
});

describe('maskFileName', () => {
  it('주문번호를 앞에 둡니다', () => {
    expect(maskFileName(NO, 'scan', 1, '2026-08-11-박나래-26.obj')).toBe(
      'ORD-260811-013_스캔1.obj',
    );
  });

  it('종류마다 다른 말이 붙습니다', () => {
    expect(maskFileName(NO, 'design', 2, 'x.stl')).toBe('ORD-260811-013_디자인2.stl');
  });

  // ★ 이 파일들의 존재 이유입니다
  it('원본 이름은 확장자 말고 아무것도 남지 않습니다', () => {
    const masked = maskFileName(NO, 'scan', 1, '2026-08-07_노승희(23384)-17-provisional.stl');

    expect(masked).not.toContain('노승희');
    expect(masked).not.toContain('23384');
    expect(masked).not.toContain('provisional');
    expect(masked).toBe('ORD-260811-013_스캔1.stl');
  });

  it('확장자가 없으면 점도 안 붙습니다', () => {
    expect(maskFileName(NO, 'scan', 1, '박나래상악')).toBe('ORD-260811-013_스캔1');
  });
});

describe('nextFileSeq', () => {
  it('아무것도 없으면 1', () => {
    expect(nextFileSeq(NO, 'scan', [])).toBe(1);
  });

  it('종류가 다르면 따로 셉니다', () => {
    expect(nextFileSeq(NO, 'design', ['ORD-260811-013_스캔1.obj'])).toBe(1);
  });

  // 개수로 세면 지운 자리를 다시 써서 같은 이름이 둘 생깁니다
  it('지운 자리를 다시 쓰지 않습니다', () => {
    const left = ['ORD-260811-013_스캔3.obj'];

    expect(nextFileSeq(NO, 'scan', left)).toBe(4);
  });

  it('다른 주문의 이름은 안 셉니다', () => {
    expect(nextFileSeq(NO, 'scan', ['ORD-260811-999_스캔7.obj'])).toBe(1);
  });
});

describe('maskFileNames', () => {
  it('번호가 이어집니다', () => {
    expect(maskFileNames(NO, 'scan', ['a.stl', 'b.obj'], ['ORD-260811-013_스캔1.stl'])).toEqual([
      'ORD-260811-013_스캔2.stl',
      'ORD-260811-013_스캔3.obj',
    ]);
  });
});

describe('isMaskedName', () => {
  it('우리가 지은 이름을 통과시킵니다', () => {
    expect(isMaskedName(NO, 'ORD-260811-013_스캔1.obj')).toBe(true);
    expect(isMaskedName(NO, 'ORD-260811-013_디자인12.html')).toBe(true);
    expect(isMaskedName(NO, 'ORD-260811-013_스캔1')).toBe(true);
  });

  it('원본 이름은 막습니다', () => {
    expect(isMaskedName(NO, '2026-08-11-박나래-26.obj')).toBe(false);
  });

  // 주문번호만 앞에 붙여 오는 것으로는 통과 못 합니다
  it('주문번호를 앞에 달아도 뒤가 다르면 막습니다', () => {
    expect(isMaskedName(NO, 'ORD-260811-013_박나래.obj')).toBe(false);
    expect(isMaskedName(NO, 'ORD-260811-013_스캔1_박나래.obj')).toBe(false);
  });

  it('다른 주문의 이름은 막습니다', () => {
    expect(isMaskedName(NO, 'ORD-260811-011_스캔1.obj')).toBe(false);
  });
});

describe('matchMissingFiles', () => {
  const slots = [
    { id: 'a', fileName: 'ORD-260811-013_스캔1.stl', fileSize: 1455284 },
    { id: 'b', fileName: 'ORD-260811-013_스캔2.obj', fileSize: 2056865 },
  ];

  it('크기와 확장자가 같은 줄에 붙습니다', () => {
    const matched = matchMissingFiles(slots, [{ name: '박나래-26.obj', size: 2056865 }]);

    expect(matched).toEqual(['b']);
  });

  it('한 줄에 두 파일이 붙지 않습니다', () => {
    const matched = matchMissingFiles(slots, [
      { name: 'x.obj', size: 2056865 },
      { name: 'y.obj', size: 2056865 },
    ]);

    expect(matched).toEqual(['b', null]);
  });

  // 크기가 같아도 확장자가 다르면 다른 파일입니다
  it('확장자가 다르면 안 붙습니다', () => {
    expect(matchMissingFiles(slots, [{ name: 'x.obj', size: 1455284 }])).toEqual([null]);
  });

  it('못 맞추면 null — 새 줄이 됩니다', () => {
    expect(matchMissingFiles(slots, [{ name: 'z.stl', size: 99 }])).toEqual([null]);
  });
});
