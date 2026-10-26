// 설계 묶음 — 싱글·브릿지·폰틱을 일꾼에 넘기는 단위 (2026-10-26, 다서울 브릿지 약속)
import { describe, it, expect } from 'vitest';
import { designGroups, type DesignTooth } from '@/server/domain/auto-print';

const t = (itemId: string, tooth: number, isPontic = false): DesignTooth => ({ itemId, tooth, isPontic });

describe('designGroups — 주문서 줄 + 브릿지 묶음 → 설계 묶음', () => {
  it('브릿지가 없으면 치아마다 싱글', () => {
    expect(designGroups([t('a', 36), t('b', 25)], [])).toEqual([
      { teeth: [25], pontics: [] },
      { teeth: [36], pontics: [] },
    ]);
  });

  it('16-15 브릿지(15 폰틱) + 25 싱글 — 치식도 그림 그대로', () => {
    const items = [t('a', 16), t('b', 15, true), t('c', 25)];
    expect(designGroups(items, [['a', 'b']])).toEqual([
      { teeth: [15, 16], pontics: [15] },
      { teeth: [25], pontics: [] },
    ]);
  });

  it('크라운 줄 id 가 섞인 브릿지 멤버는 버립니다 (FlowTemp 줄만 묶음)', () => {
    const items = [t('f1', 16), t('f2', 15, true)];
    // 'c1','c2' 는 같은 치아의 크라운 줄 — FlowTemp 목록에 없음
    expect(designGroups(items, [['c1', 'c2'], ['f1', 'f2']])).toEqual([{ teeth: [15, 16], pontics: [15] }]);
  });

  it('폰틱만 있는 묶음도 돌려줍니다 — 빼면 치과가 까닭을 모릅니다', () => {
    expect(designGroups([t('a', 15, true)], [])).toEqual([{ teeth: [15], pontics: [15] }]);
  });

  it('같은 줄이 두 묶음에 들어 있어도 한 번만 씁니다', () => {
    const items = [t('a', 16), t('b', 15), t('c', 14)];
    expect(designGroups(items, [['a', 'b'], ['b', 'c']])).toEqual([
      { teeth: [14], pontics: [] },
      { teeth: [15, 16], pontics: [] },
    ]);
  });

  it('묶음은 첫 치아 번호순, 안의 치식은 오름차순', () => {
    const items = [t('a', 46), t('b', 45, true), t('c', 44), t('d', 36)];
    expect(designGroups(items, [['a', 'b', 'c']])).toEqual([
      { teeth: [36], pontics: [] },
      { teeth: [44, 45, 46], pontics: [45] },
    ]);
  });
});
