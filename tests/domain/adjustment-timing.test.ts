// =========================================================
// 놓을 위치: tests/domain/adjustment-timing.test.ts
//
// 조정한 금액이 언제 청구서에 실리는가. (사용자 신고 2026-08-13 —
//   "주문서에서 조정금액이 정산에 적용되지 않는경우")
//
// ★ 버그가 아니라 말을 안 해 준 것이었습니다.
//   정산은 **배송된 건만** 셉니다. 조정은 접수 단계에서도 걸 수 있어서,
//   넣어 놓고 정산을 열어 본 사람은 "적용이 안 됐다" 고 읽습니다.
//   실제로 그런 조정이 있었습니다 — ORD-260812-005, 접수 상태.
// =========================================================

import { describe, it, expect } from 'vitest';
import { adjustmentTiming, periodOfDate } from '@/server/domain/billing';

describe('배송 전에는 정산에 안 잡힙니다', () => {
  const before = adjustmentTiming({ billable: true, shippedAt: null, closingDay: 26 });

  it('★ 왜 안 보이는지를 말해 준다', () => {
    expect(before.willBill).toBe(false);
    expect(before.note).toContain('배송 전');
  });

  it('사라지는 것이 아니라 나중에 붙는다는 것까지 말한다', () => {
    // "안 됩니다" 만 적으면 조정을 지우고 다시 넣습니다
    expect(before.note).toContain('붙습니다');
  });
});

describe('배송된 뒤에는 몇 월인지까지 말합니다', () => {
  it('기준일 26일 — 08-12 배송은 그달 정산', () => {
    const timing = adjustmentTiming({
      billable: true,
      shippedAt: '2026-08-12T04:00:00Z',
      closingDay: 26,
    });

    expect(timing.willBill).toBe(true);
    expect(timing.note).toContain('2026-08');
  });

  it('★ 기준일을 넘긴 배송은 다음 달입니다', () => {
    // 26일 기준에서 08-26 은 벌써 9월분입니다 (periodOfDate)
    const timing = adjustmentTiming({
      billable: true,
      shippedAt: '2026-08-26',
      closingDay: 26,
    });

    expect(timing.note).toContain('2026-09');
    expect(periodOfDate('2026-08-26', 26)).toBe('2026-09');
  });

  it('기준일이 1일이면 달력 월 그대로', () => {
    const timing = adjustmentTiming({
      billable: true,
      shippedAt: '2026-08-31',
      closingDay: 1,
    });

    expect(timing.note).toContain('2026-08');
  });
});

describe('청구 대상이 아닌 주문', () => {
  it('★ 리메이크·리페어라도 조정한 금액은 실린다 — 그렇게 말해 준다', () => {
    const timing = adjustmentTiming({
      billable: false,
      shippedAt: '2026-08-12',
      closingDay: 26,
    });

    expect(timing.willBill).toBe(true);
    expect(timing.note).toContain('청구 대상이 아니');
    expect(timing.note).toContain('2026-08');
  });
});
