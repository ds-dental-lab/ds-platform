// =========================================================
// 놓을 위치: tests/domain/billing-freeze.test.ts
//
// 단가를 안 정한 건이 섞였을 때 마감을 막는 규칙.
// (2026-08-13 정산 코드 점검에서 찾음 — 정산은 한 번도 안 돌아봤습니다)
//
// ★ 굳는 순간 0원이 됩니다.
//   splitItemLines 가 `base ?? 0` 으로 넣습니다. 청구서에 0원으로
//   나가고, 발행하고 나면 되돌릴 수도 없습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { canFreezeAmounts, splitItemLines } from '@/server/domain/billing';

describe('단가를 안 정한 건이 있으면 마감을 막는다', () => {
  it('★ 하나만 있어도 막는다 — 0원으로 굳으면 되돌릴 길이 없습니다', () => {
    const verdict = canFreezeAmounts(1);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('1건');
  });

  it('몇 건인지 알려 준다 — 어디를 채워야 하는지 찾아가야 합니다', () => {
    const verdict = canFreezeAmounts(7);

    expect(verdict.ok === false && verdict.reason).toContain('7건');
  });

  it('다 정해져 있으면 통과한다', () => {
    expect(canFreezeAmounts(0).ok).toBe(true);
  });
});

describe('★ 왜 막아야 하는가 — 굳으면 실제로 0원이 됩니다', () => {
  it('단가가 비어 있으면 0원 줄이 된다', () => {
    const lines = splitItemLines({
      isPontic: false,
      hasGingival: false,
      price: null,
      ponticPrice: null,
      pinkPrice: null,
    });

    expect(lines[0].amount).toBe(0);
  });

  it('핑크 포셀린 값도 비면 0원으로 붙는다', () => {
    const lines = splitItemLines({
      isPontic: false,
      hasGingival: true,
      price: 90_000,
      ponticPrice: null,
      pinkPrice: null,
    });

    expect(lines).toHaveLength(2);
    expect(lines[1].amount).toBe(0);
  });

  it('0원을 일부러 넣은 것은 막지 않는다 — 미정과 무상은 다릅니다', () => {
    const lines = splitItemLines({
      isPontic: false,
      hasGingival: false,
      price: 0,
      ponticPrice: null,
      pinkPrice: null,
    });

    expect(lines[0].amount).toBe(0);
    // 0원은 '정한 값' 이므로 unpriced 로 세지 않습니다 (repositories/billing)
    expect(canFreezeAmounts(0).ok).toBe(true);
  });
});
