import { describe, expect, it } from 'vitest';
import { resolveOrderOptions } from '@/server/domain/production-option';

const GROUPS = [
  { id: 'hook', values: [{ id: 'h-no', isDefault: true }, { id: 'h-yes', isDefault: false }] },
  { id: 'pontic', values: [{ id: 'p-a', isDefault: false }, { id: 'p-b', isDefault: false }] },
];

describe('resolveOrderOptions', () => {
  it('고른 값은 그대로 둡니다', () => {
    expect(resolveOrderOptions(GROUPS, { hook: 'h-yes', pontic: 'p-b' })).toEqual({ hook: 'h-yes', pontic: 'p-b' });
  });

  it('화면이 아무것도 안 보냈으면 그룹마다 기본값으로 채웁니다', () => {
    expect(resolveOrderOptions(GROUPS, {})).toEqual({ hook: 'h-no', pontic: 'p-a' });
    expect(resolveOrderOptions(GROUPS, undefined)).toEqual({ hook: 'h-no', pontic: 'p-a' });
  });

  it('빠진 그룹만 채웁니다', () => {
    expect(resolveOrderOptions(GROUPS, { pontic: 'p-b' })).toEqual({ hook: 'h-no', pontic: 'p-b' });
  });

  it('그 그룹의 것이 아닌 값은 기본값으로 바꿉니다', () => {
    expect(resolveOrderOptions(GROUPS, { hook: 'p-b', pontic: 'p-b' })).toEqual({ hook: 'h-no', pontic: 'p-b' });
  });

  it('없는 그룹은 버립니다', () => {
    expect(resolveOrderOptions(GROUPS, { gone: 'x', hook: 'h-yes' })).toEqual({ hook: 'h-yes', pontic: 'p-a' });
  });

  it('값이 하나도 없는 그룹은 건너뜁니다', () => {
    expect(resolveOrderOptions([{ id: 'empty', values: [] }], {})).toEqual({});
  });
});
