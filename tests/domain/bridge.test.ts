// =========================================================
// 놓을 위치: tests/domain/bridge.test.ts
// 기준: 기능명세서 §4.2.6, 구현계획서 Sprint 2 완료 기준
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  linkKey,
  canLink,
  isForcedLink,
  computeBridges,
  canSever,
  canRejoin,
  findBridgeOf,
  type ToothPlacement,
} from '@/server/domain/bridge';

/** 짧게 쓰기 위한 도우미 */
const zir = (tooth: number, isPontic = false): ToothPlacement => ({
  tooth,
  typeCode: 'crown',
  materialCode: 'zirconia',
  isPontic,
});

const pmma = (tooth: number): ToothPlacement => ({
  tooth,
  typeCode: 'crown',
  materialCode: 'pmma',
});

const inlay = (tooth: number): ToothPlacement => ({
  tooth,
  typeCode: 'inlay',
  materialCode: 'hybrid',
});

const implant = (tooth: number): ToothPlacement => ({
  tooth,
  typeCode: 'implant',
  materialCode: 'abut_zir_scrp',
});

describe('연결 지점 이름', () => {
  it('순서가 바뀌어도 같은 이름', () => {
    expect(linkKey(16, 17)).toBe(linkKey(17, 16));
  });

  it('치식도 순서대로 적는다', () => {
    expect(linkKey(16, 17)).toBe('17-16'); // 18 쪽이 왼쪽 끝
    expect(linkKey(21, 11)).toBe('11-21');
  });
});

describe('연결 판정', () => {
  it('★ 인접 + 같은 종류 + 같은 재료면 연결', () => {
    expect(canLink(zir(16), zir(17))).toBe(true);
  });

  it('★ 재료가 다르면 연결되지 않는다', () => {
    expect(canLink(zir(16), pmma(17))).toBe(false);
  });

  it('★ 인레이는 연결되지 않는다', () => {
    expect(canLink(inlay(16), inlay(17))).toBe(false);
  });

  it('★ 사이가 빈 치아는 연결되지 않는다', () => {
    expect(canLink(zir(16), zir(18))).toBe(false);
  });

  it('임플란트는 연결된다', () => {
    expect(canLink(implant(16), implant(17))).toBe(true);
  });

  it('★ 정중선을 넘는 앞니는 연결된다', () => {
    expect(canLink(zir(11), zir(21))).toBe(true);
  });

  it('위턱과 아래턱은 연결되지 않는다', () => {
    expect(canLink(zir(11), zir(41))).toBe(false);
  });
});

describe('폰틱', () => {
  it('★ 한쪽이 폰틱이면 무조건 연결', () => {
    expect(canLink(zir(16), zir(17, true))).toBe(true);
  });

  it('★ 폰틱 연결은 끊을 수 없다', () => {
    expect(isForcedLink(zir(16), zir(17, true))).toBe(true);
    expect(isForcedLink(zir(16), zir(17))).toBe(false);
  });

  it('★ 인레이 폰틱은 연결되지 않는다 (현실에 없는 조합)', () => {
    const inlayPontic: ToothPlacement = {
      tooth: 17,
      typeCode: 'inlay',
      materialCode: 'hybrid',
      isPontic: true,
    };
    expect(canLink(inlay(16), inlayPontic)).toBe(false);
    expect(isForcedLink(inlay(16), inlayPontic)).toBe(false);
    expect(computeBridges([inlay(16), inlayPontic])).toHaveLength(0);
  });

  it('★ 폰틱이 낀 연결은 − 버튼이 안 나온다', () => {
    // 16 - 17(폰틱) - 18
    const bridges = computeBridges([zir(16), zir(17, true), zir(18)]);
    const bridge = bridges[0];

    expect(bridge.teeth).toEqual([18, 17, 16]);
    expect(bridge.hasPontic).toBe(true);
    expect(canSever(bridge, linkKey(17, 16))).toBe(false);
    expect(canSever(bridge, linkKey(18, 17))).toBe(false);
  });

  it('★ 끊어 뒀어도 폰틱이면 다시 붙는다', () => {
    const bridges = computeBridges(
      [zir(16), zir(17, true)],
      [linkKey(16, 17)],  // 끊으려 시도
    );
    expect(bridges).toHaveLength(1);
    expect(bridges[0].teeth).toHaveLength(2);
  });
});

describe('묶기', () => {
  it('붙어 있는 셋을 한 덩어리로', () => {
    const bridges = computeBridges([zir(16), zir(17), zir(18)]);
    expect(bridges).toHaveLength(1);
    expect(bridges[0].teeth).toEqual([18, 17, 16]);
  });

  it('혼자면 브릿지가 아니다', () => {
    expect(computeBridges([zir(16)])).toHaveLength(0);
  });

  it('★ 사이가 비면 따로 논다', () => {
    expect(computeBridges([zir(16), zir(18)])).toHaveLength(0);
  });

  it('재료가 다르면 각각 별개', () => {
    // 16 지르코니아 - 17 PMMA - 18 PMMA
    const bridges = computeBridges([zir(16), pmma(17), pmma(18)]);
    expect(bridges).toHaveLength(1);
    expect(bridges[0].materialCode).toBe('pmma');
    expect(bridges[0].teeth).toEqual([18, 17]);
  });

  it('★ 중복 등록된 치아는 재료별로 따로 묶인다', () => {
    // 16·17 에 지르코니아와 PMMA 가 각각 올라간 상태
    const bridges = computeBridges([
      zir(16), zir(17),
      pmma(16), pmma(17),
    ]);
    expect(bridges).toHaveLength(2);
    expect(bridges.map((b) => b.materialCode).sort()).toEqual(['pmma', 'zirconia']);
  });

  it('턱이 다르면 따로 묶인다', () => {
    const bridges = computeBridges([zir(16), zir(17), zir(46), zir(47)]);
    expect(bridges).toHaveLength(2);
  });
});

describe('끊기와 되붙이기', () => {
  it('★ 끊으면 두 덩어리가 된다', () => {
    const bridges = computeBridges(
      [zir(16), zir(17), zir(18)],
      [linkKey(17, 16)],
    );
    expect(bridges).toHaveLength(1);       // 18-17 만 남음
    expect(bridges[0].teeth).toEqual([18, 17]);
  });

  it('★ 끊은 기록은 치아를 추가해도 남는다', () => {
    // 16·17 을 끊어 둔 상태에서 18 을 추가
    const severed = [linkKey(16, 17)];
    const bridges = computeBridges([zir(16), zir(17), zir(18)], severed);

    const has16and17 = bridges.some(
      (b) => b.teeth.includes(16) && b.teeth.includes(17),
    );
    expect(has16and17).toBe(false);
  });

  it('끊긴 곳은 되붙일 수 있다', () => {
    const severed = [linkKey(16, 17)];
    expect(canRejoin(zir(16), zir(17), severed)).toBe(true);
  });

  it('끊긴 적 없으면 되붙일 것도 없다', () => {
    expect(canRejoin(zir(16), zir(17), [])).toBe(false);
  });

  it('규칙상 못 붙는 사이는 되붙일 수 없다', () => {
    const severed = [linkKey(16, 17)];
    expect(canRejoin(inlay(16), inlay(17), severed)).toBe(false);
  });
});

describe('브릿지 찾기', () => {
  it('치아가 속한 브릿지를 찾는다', () => {
    const bridges = computeBridges([zir(16), zir(17)]);
    const found = findBridgeOf(bridges, 16, 'crown', 'zirconia');
    expect(found?.teeth).toContain(17);
  });

  it('없으면 null', () => {
    const bridges = computeBridges([zir(16), zir(17)]);
    expect(findBridgeOf(bridges, 26, 'crown', 'zirconia')).toBeNull();
  });
});
