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
  severedFromBridges,
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

// =========================================================
// 저장된 묶음에서 '끊어 둔 자리' 되읽기 (2026-10-12)
//
// ★★ 사용자 지적 — "주문수정 시 연결부분을 싱글싱글로 나눠도 반영이
//   안되네". 저장은 제대로 됐고 **화면이 다시 계산**하고 있었습니다.
//   치식도는 늘 computeBridges 로 그리는데, 주문상세·기공의뢰서·수정폼이
//   끊어 둔 자리를 안 넘겨 줘서 도로 이어져 보였습니다.
//
// ★ 끊어 둔 목록을 따로 저장하지 않습니다 — order_bridges 가 이미
//   사실입니다. "이어질 자리인데 같은 묶음에 없다" 가 곧 끊은 자리입니다.
// =========================================================

describe('저장된 묶음에서 끊어 둔 자리 되읽기', () => {
  const crown = (tooth: number, isPontic = false) => ({
    tooth,
    typeCode: 'crown',
    materialCode: 'zirconia',
    isPontic,
  });

  it('통째로 한 묶음이면 끊은 곳이 없습니다', () => {
    expect(severedFromBridges([crown(15), crown(16), crown(17)], [[15, 16, 17]])).toEqual([]);
  });

  // ★★ 이것이 사용자가 겪은 바로 그 경우입니다
  it('★ 셋을 싱글로 쪼개 두면 두 자리가 끊긴 것입니다', () => {
    const got = severedFromBridges([crown(15), crown(16), crown(17)], []);

    // ★ 치식 순서는 어금니 → 앞니입니다 (17 → 16 → 15)
    expect(got).toEqual(['17-16', '16-15']);
  });

  it('★ 가운데만 끊어 둔 경우', () => {
    const got = severedFromBridges([crown(15), crown(16), crown(17)], [[15, 16]]);

    expect(got).toEqual(['17-16']);
  });

  // ★ 되읽은 값을 다시 넣으면 저장된 모양이 그대로 나와야 합니다.
  //   둘이 어긋나면 화면과 저장이 영영 다른 말을 합니다
  it('★ 되읽어 다시 계산하면 저장된 묶음과 같습니다', () => {
    const placements = [crown(15), crown(16), crown(17)];
    const severed = severedFromBridges(placements, [[15, 16]]);
    const again = computeBridges(placements, severed);

    expect(again).toHaveLength(1);
    expect(again[0].teeth).toEqual([16, 15]);
  });

  // ★ 폰틱은 혼자 설 수 없어 끊을 수 없는 연결입니다.
  //   저장이 어떻든 '끊었다' 로 읽으면 안 됩니다
  it('★ 폰틱이 낀 자리는 끊긴 것으로 안 읽습니다', () => {
    expect(severedFromBridges([crown(15), crown(16, true), crown(17)], [])).toEqual([]);
  });

  // ★ 애초에 안 이어지는 자리(떨어진 이)는 끊고 말고가 없습니다
  it('떨어져 있으면 아무것도 안 셉니다', () => {
    expect(severedFromBridges([crown(15), crown(17)], [])).toEqual([]);
  });

  it('종류가 다르면 안 셉니다', () => {
    const pmma = { tooth: 16, typeCode: 'crown', materialCode: 'pmma', isPontic: false };
    expect(severedFromBridges([crown(15), pmma], [])).toEqual([]);
  });

  it('보철이 하나뿐이면 셀 자리가 없습니다', () => {
    expect(severedFromBridges([crown(15)], [])).toEqual([]);
  });
});

