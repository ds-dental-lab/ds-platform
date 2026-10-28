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

  // 브릿지 가지가 붙은 뒤(2026-10-28) 남는 멈춤 말들
  it('결손 자리에 이름표가 없어 폰틱을 못 찍음 — 사람이 찍어야 하니 포기', () => {
    const n = '폰틱 자리 25 의 이름표가 화면에 없습니다 — 결손 자리는 사람이 찍어 주세요';
    expect(stallKind(n)).toBe('unsupported');
    expect(designVerdict(n, 0)).toBe('give_up');
  });

  it('떨어진 크라운 둘인데 폰틱이 없음 — 의뢰서 문제라 포기', () => {
    expect(stallKind('치식이 [24, 26] 로 떨어져 있는데 폰틱이 없습니다 — 의뢰서의 연결 표시를 봐 주세요')).toBe('unsupported');
  });

  it('내보내기 창의 브릿지가 주문서와 다름 — 못 읽은 것으로', () => {
    expect(stallKind('내보낼 브릿지가 주문서와 다릅니다 — 주문서 브릿지 25-27 · 창 [\'26-27\'] / 크라운 []')).toBe('unreadable');
  });

  it('합치기·묶기 실패는 일시적 — 다시 건다', () => {
    expect(stallKind('브릿지 25-27 로 안 묶였습니다 — 화면: 크라운 26 크라운 27')).toBe('transient');
    expect(designVerdict('합치기를 눌렀는데 90초 안에 \'조립됨\' 이 안 뜹니다', 0)).toBe('retry');
  });
});
