// 요청시한 자동 완료 — 정산이 어긋나지 않는지까지 (2026-10-01)
import { describe, it, expect } from 'vitest';
import {
  AUTO_COMPLETE_FROM,
  dueReached,
  isAutoCompletable,
  shippedAtFor,
} from '@/server/domain/auto-complete';
import { periodOfDate, periodRange, isBillable } from '@/server/domain/billing';

describe('자동 완료 대상', () => {
  it('제작·배송만 넘깁니다', () => {
    expect(AUTO_COMPLETE_FROM).toEqual(['production', 'shipping']);
    expect(isAutoCompletable('production')).toBe(true);
    expect(isAutoCompletable('shipping')).toBe(true);
  });

  it('아직 안 만든 단계는 시한이 지나도 완료가 아닙니다', () => {
    for (const status of ['received', 'rescan', 'designing', 'production_wait'] as const) {
      expect(isAutoCompletable(status)).toBe(false);
    }
  });

  it('오늘이 시한이거나 지났으면 넘깁니다', () => {
    expect(dueReached('2026-10-31', '2026-10-31')).toBe(true);
    expect(dueReached('2026-10-30', '2026-10-31')).toBe(true);
    expect(dueReached('2026-11-01', '2026-10-31')).toBe(false);
    expect(dueReached(null, '2026-10-31')).toBe(false);
  });
});

describe('★ 배송 시각 — 정산의 근거', () => {
  it('배송을 눌러 둔 건 그대로 둡니다', () => {
    expect(shippedAtFor('2026-10-20T01:00:00.000Z', new Date('2026-10-31T00:00:00Z'))).toBe(
      '2026-10-20T01:00:00.000Z',
    );
  });

  it('비어 있으면 지금으로 채웁니다 — 안 채우면 청구가 안 됩니다', () => {
    const now = new Date('2026-10-31T00:00:00Z');
    const stamped = shippedAtFor(null, now);

    expect(stamped).toBe('2026-10-31T00:00:00.000Z');
    expect(isBillable({ shippedAt: stamped, isBillable: true })).toBe(true);
    expect(isBillable({ shippedAt: null, isBillable: true })).toBe(false);
  });

  /*
    ★ 사용자 물음 (2026-10-01): "31일에 바뀌어도 1일 정산에 문제없나".
      아침 9시(KST) = 00:00 UTC 라, 저장되는 시각의 날짜가 한국 날짜와 같습니다.
  */
  it('한국 10/31 아침에 넘겨도 10월 정산(1일 기준)에 듭니다', () => {
    const stamped = shippedAtFor(null, new Date('2026-10-31T00:00:00Z')); // 한국 10/31 09:00
    expect(periodOfDate(stamped, 1)).toBe('2026-10');
    expect(periodRange('2026-10', 1)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('26일 기준 치과면 같은 건이 11월 정산 — 배송을 손으로 눌렀을 때와 같습니다', () => {
    const stamped = shippedAtFor(null, new Date('2026-10-31T00:00:00Z'));
    expect(periodOfDate(stamped, 26)).toBe('2026-11');
  });

  it('★ 자정에 돌리면 한국 11/1 건이 10월로 샙니다 — 그래서 9시입니다', () => {
    const midnightKst = new Date('2026-10-31T15:00:00Z'); // 한국 11/1 00:00
    expect(periodOfDate(shippedAtFor(null, midnightKst), 1)).toBe('2026-10');

    const nineKst = new Date('2026-11-01T00:00:00Z'); // 한국 11/1 09:00
    expect(periodOfDate(shippedAtFor(null, nineKst), 1)).toBe('2026-11');
  });
});
