// =========================================================
// 놓을 위치: tests/domain/tooth.test.ts
//
// 구현계획서 Sprint 2 완료 기준의 경계 케이스를 담았습니다.
// 규칙을 바꿔도 이 테스트가 통과하면 안심할 수 있습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  isValidTooth,
  getQuadrant,
  getPosition,
  getToothType,
  getArch,
  getSide,
  isAnterior,
  isPosterior,
  isAdjacent,
  getMesialNeighbor,
  getDistalNeighbor,
  groupAdjacent,
  describeTooth,
} from '@/server/domain/tooth';

describe('유효성', () => {
  it('정상 번호를 받아들인다', () => {
    expect(isValidTooth(11)).toBe(true);
    expect(isValidTooth(48)).toBe(true);
    expect(isValidTooth(26)).toBe(true);
  });

  it('없는 번호를 거른다', () => {
    expect(isValidTooth(10)).toBe(false); // 위치 0
    expect(isValidTooth(19)).toBe(false); // 위치 9
    expect(isValidTooth(51)).toBe(false); // 사분악 5
    expect(isValidTooth(0)).toBe(false);
    expect(isValidTooth(1.5)).toBe(false);
  });
});

describe('분해', () => {
  it('사분악과 위치를 읽는다', () => {
    expect(getQuadrant(16)).toBe(1);
    expect(getPosition(16)).toBe(6);
    expect(getQuadrant(38)).toBe(3);
    expect(getPosition(38)).toBe(8);
  });

  it('치종을 판정한다', () => {
    expect(getToothType(11)).toBe('central_incisor');
    expect(getToothType(23)).toBe('canine');
    expect(getToothType(36)).toBe('first_molar');
    expect(getToothType(48)).toBe('third_molar');
  });

  it('위아래와 좌우를 판정한다', () => {
    expect(getArch(16)).toBe('upper');
    expect(getArch(46)).toBe('lower');
    expect(getSide(16)).toBe('right'); // 1사분악
    expect(getSide(26)).toBe('left');  // 2사분악
    expect(getSide(36)).toBe('left');  // 3사분악
    expect(getSide(46)).toBe('right'); // 4사분악
  });

  it('앞니와 어금니를 나눈다', () => {
    expect(isAnterior(13)).toBe(true);  // 견치까지 앞니
    expect(isPosterior(14)).toBe(true); // 소구치부터 어금니
  });
});

describe('인접 판정', () => {
  it('같은 사분악에서 붙어 있으면 인접', () => {
    expect(isAdjacent(16, 17)).toBe(true);
    expect(isAdjacent(17, 16)).toBe(true); // 순서 무관
  });

  it('사이가 뜨면 인접이 아니다', () => {
    expect(isAdjacent(16, 18)).toBe(false);
  });

  it('★ 정중선을 넘는 앞니끼리는 인접', () => {
    expect(isAdjacent(11, 21)).toBe(true); // 위
    expect(isAdjacent(41, 31)).toBe(true); // 아래
  });

  it('★ 정중선을 넘어도 앞니가 아니면 인접이 아니다', () => {
    expect(isAdjacent(12, 22)).toBe(false);
    expect(isAdjacent(16, 26)).toBe(false);
  });

  it('★ 위턱과 아래턱은 절대 인접하지 않는다', () => {
    expect(isAdjacent(11, 41)).toBe(false);
    expect(isAdjacent(16, 46)).toBe(false);
  });

  it('같은 치아는 인접이 아니다', () => {
    expect(isAdjacent(16, 16)).toBe(false);
  });
});

describe('이웃 찾기', () => {
  it('안쪽 이웃', () => {
    expect(getMesialNeighbor(16)).toBe(15);
    expect(getMesialNeighbor(11)).toBe(21); // 정중선 건너
    expect(getMesialNeighbor(41)).toBe(31);
  });

  it('바깥 이웃', () => {
    expect(getDistalNeighbor(16)).toBe(17);
    expect(getDistalNeighbor(18)).toBeNull(); // 지치 바깥은 없음
  });
});

describe('덩어리 묶기', () => {
  it('붙어 있는 것끼리 묶는다', () => {
    expect(groupAdjacent([16, 17, 18])).toEqual([[18, 17, 16]]);
  });

  it('★ 사이가 빈 치아는 건너뛰지 않는다', () => {
    expect(groupAdjacent([16, 18])).toEqual([[18], [16]]);
  });

  it('턱이 다르면 따로 묶인다', () => {
    const groups = groupAdjacent([16, 17, 46, 47]);
    expect(groups).toHaveLength(2);
  });

  it('정중선을 넘는 앞니는 한 덩어리', () => {
    expect(groupAdjacent([11, 21])).toEqual([[11, 21]]);
  });

  it('중복 입력을 걸러낸다', () => {
    expect(groupAdjacent([16, 16, 17])).toEqual([[17, 16]]);
  });

  it('빈 입력은 빈 결과', () => {
    expect(groupAdjacent([])).toEqual([]);
  });
});

describe('표시', () => {
  it('사람이 읽을 설명을 만든다', () => {
    expect(describeTooth(16)).toBe('16 (제1대구치, 오른쪽 위)');
    expect(describeTooth(31)).toBe('31 (중절치, 왼쪽 아래)');
  });
});
