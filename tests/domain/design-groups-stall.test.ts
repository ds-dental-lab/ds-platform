// 묶음 일감에서 일꾼이 멈추는 말 — 기계 판정이 '자동으로 못 함' 으로 가야 합니다 (2026-10-26)
import { describe, it, expect } from 'vitest';
import { stallKind, designVerdict } from '@/server/domain/auto-print';

describe('브릿지·묶음 멈춤 말의 판정', () => {
  it('브릿지 준비 중 — 다시 걸어도 같으니 포기(give_up)', () => {
    const n = '브릿지 [15, 16] (폰틱 [15]) — 브릿지 자동 설계는 준비 중입니다';
    expect(stallKind(n)).toBe('unsupported');
    expect(designVerdict(n, 0)).toBe('give_up');
  });

  it('한 주문에 묶음 여럿 — 포기', () => {
    const n = '한 주문에 설계 묶음이 2개입니다 — 지금은 한 주문에 하나(싱글 또는 브릿지 하나)만 자동으로 합니다';
    expect(stallKind(n)).toBe('unsupported');
  });

  it('폰틱만 있고 지대치 없음 — 포기', () => {
    expect(stallKind('폰틱만 있고 지대치가 없습니다 — 치식 [15]')).toBe('unsupported');
  });
});
