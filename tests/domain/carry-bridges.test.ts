import { describe, expect, it } from 'vitest';
import { carryBridges, type CarriedItem } from '@/server/domain/bridge';

const item = (n: number, typeCode = 'crown', materialCode = 'zir'): CarriedItem => ({
  parentItemId: `p${n}`,
  newItemId: `n${n}`,
  typeCode,
  materialCode,
});

describe('carryBridges', () => {
  it('통째로 다시 만들면 묶음이 그대로 옵니다', () => {
    const got = carryBridges([['p1', 'p2', 'p3']], [item(1), item(2), item(3)]);
    expect(got).toEqual([['n1', 'n2', 'n3']]);
  });

  it('묶음이 여럿이면 따로따로 옵니다 — 합쳐지지 않습니다', () => {
    const got = carryBridges(
      [['p1', 'p2'], ['p3', 'p4']],
      [item(1), item(2), item(3), item(4)],
    );
    expect(got).toEqual([['n1', 'n2'], ['n3', 'n4']]);
  });

  it('부분 리메이크 — 고른 줄만, 둘 이상 남은 묶음만', () => {
    // 3본 브릿지에서 둘만 고름 → 둘이 묶음
    expect(carryBridges([['p1', 'p2', 'p3']], [item(1), item(2)])).toEqual([['n1', 'n2']]);
    // 하나만 고름 → 묶음이 아닙니다
    expect(carryBridges([['p1', 'p2', 'p3']], [item(2)])).toEqual([]);
  });

  it('원주문에서 낱개였던 줄은 리메이크에서도 낱개입니다', () => {
    // 치과가 끊어 둔 이웃 크라운 — 규칙으로 다시 계산하면 이어지지만, 옮기기는 안 잇습니다
    expect(carryBridges([], [item(1), item(2)])).toEqual([]);
    expect(carryBridges([['p1', 'p2']], [item(1), item(2), item(3)])).toEqual([['n1', 'n2']]);
  });

  it('리메이크에서 재료를 바꿔 서로 달라졌으면 안 옮깁니다', () => {
    const got = carryBridges([['p1', 'p2']], [item(1), item(2, 'crown', 'pfm')]);
    expect(got).toEqual([]);
  });

  it('같이 바꿨으면 옮깁니다', () => {
    const got = carryBridges([['p1', 'p2']], [item(1, 'crown', 'pfm'), item(2, 'crown', 'pfm')]);
    expect(got).toEqual([['n1', 'n2']]);
  });
});
