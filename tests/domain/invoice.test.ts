// =========================================================
// 놓을 위치: tests/domain/invoice.test.ts
// 기준: 사용자 요청 2026-08-12 — 청구 내역 · 정산(입금) · 조정 내역
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  unpaidAmount,
  overpaidAmount,
  invoiceStatus,
  checkPayment,
  paymentDueDate,
  summarize,
  groupAdjustments,
  PAYMENT_DAY,
  type AdjustmentRow,
  checkCredit,
  checkCreditReason,
  canCredit,
} from '@/server/domain/invoice';

describe('미납', () => {
  it('청구액에서 들어온 돈을 뺍니다', () => {
    expect(unpaidAmount(490000, 0)).toBe(490000);
    expect(unpaidAmount(490000, 200000)).toBe(290000);
    expect(unpaidAmount(490000, 490000)).toBe(0);
  });

  // ★ 미납이 음수로 찍히면 목록 합계가 줄어 다른 청구서까지 틀려 보입니다
  it('★ 더 들어와도 미납은 0 아래로 안 갑니다', () => {
    expect(unpaidAmount(490000, 500000)).toBe(0);
    expect(overpaidAmount(490000, 500000)).toBe(10000);
  });

  it('과입금이 없으면 0입니다', () => {
    expect(overpaidAmount(490000, 490000)).toBe(0);
  });
});

describe('상태', () => {
  // ★ 딱지를 따로 두면 '완료' 인데 미납이 남는 줄이 생깁니다
  it('★ 미납이 정합니다 — 따로 켜는 딱지가 아닙니다', () => {
    expect(invoiceStatus(490000, 0)).toBe('unpaid');
    expect(invoiceStatus(490000, 489999)).toBe('unpaid');
    expect(invoiceStatus(490000, 490000)).toBe('paid');
    expect(invoiceStatus(490000, 600000)).toBe('paid');
  });

  it('0원 청구서는 처음부터 완료입니다', () => {
    expect(invoiceStatus(0, 0)).toBe('paid');
  });
});

describe('입금 적기', () => {
  it('0원은 막습니다', () => {
    expect(checkPayment(0, 490000)).toEqual({ ok: false, reason: '0원은 적을 수 없습니다' });
  });

  it('소수점은 막습니다', () => {
    expect(checkPayment(1000.5, 490000).ok).toBe(false);
  });

  // ★ 막으면 사람이 숫자를 고쳐 적습니다 — 그러면 통장과 장부가 안 맞습니다
  it('★ 남은 것보다 많이 넣는 것은 막지 않습니다', () => {
    expect(checkPayment(500000, 490000)).toEqual({ ok: true });
  });

  it('되돌리는 줄(음수)도 적을 수 있습니다', () => {
    expect(checkPayment(-100000, 390000)).toEqual({ ok: true });
  });
});

describe('납부기한', () => {
  it('발행한 달의 15일입니다', () => {
    expect(paymentDueDate('2026-08-03')).toBe('2026-08-15');
    expect(paymentDueDate('2026-08-10')).toBe('2026-08-15');
    expect(paymentDueDate('2026-08-15')).toBe('2026-08-15');
  });

  it('15일이 지났으면 다음 달 15일', () => {
    expect(paymentDueDate('2026-08-16')).toBe('2026-09-15');
    expect(paymentDueDate('2026-08-31')).toBe('2026-09-15');
  });

  it('12월은 해를 넘깁니다', () => {
    expect(paymentDueDate('2026-12-20')).toBe('2027-01-15');
  });

  it('날짜를 바꿔 쓸 수 있습니다', () => {
    expect(paymentDueDate('2026-08-03', 25)).toBe('2026-08-25');
    expect(PAYMENT_DAY).toBe(15);
  });
});

describe('한 장 요약', () => {
  it('나눠 들어온 입금을 더합니다', () => {
    expect(summarize(490000, [200000, 190000])).toEqual({
      total: 490000,
      // 안 깎았으면 청구액이 그대로 받을 돈입니다
      credited: 0,
      billed: 490000,
      paid: 390000,
      unpaid: 100000,
      overpaid: 0,
      status: 'unpaid',
    });
  });

  it('다 차면 완료입니다', () => {
    expect(summarize(490000, [200000, 290000]).status).toBe('paid');
  });

  it('되돌린 줄이 있으면 다시 미입금이 됩니다', () => {
    expect(summarize(490000, [490000, -490000])).toMatchObject({
      paid: 0,
      unpaid: 490000,
      status: 'unpaid',
    });
  });

  it('입금이 없으면 통째로 미납입니다', () => {
    expect(summarize(490000, []).unpaid).toBe(490000);
  });
});

describe('조정 묶기', () => {
  const row = (over: Partial<AdjustmentRow>): AdjustmentRow => ({
    id: 'a',
    invoiceNo: 'INV-26000489',
    partyName: '한마음치과',
    authorName: '이대신',
    reason: '우수고객할인',
    amount: -150000,
    createdAt: '2026-08-03T08:19:19Z',
    ...over,
  });

  // ★ 목록만 있으면 '이번 달 할인 얼마' 를 사람이 눈으로 더합니다. 그 셈은 늘 틀립니다
  it('★ 사유가 같은 줄을 묶어 합을 냅니다', () => {
    const groups = groupAdjustments([
      row({ id: '1', reason: '우수고객할인', amount: -150000 }),
      row({ id: '2', reason: '우수고객할인', amount: -150000 }),
      row({ id: '3', reason: '실사용금액청구', amount: -110000 }),
    ]);

    expect(groups).toEqual([
      { reason: '우수고객할인', count: 2, amount: -300000 },
      { reason: '실사용금액청구', count: 1, amount: -110000 },
    ]);
  });

  it('많이 나간 사유가 위로 옵니다', () => {
    const groups = groupAdjustments([
      row({ id: '1', reason: '소액', amount: -10000 }),
      row({ id: '2', reason: '플랜 조정', amount: -500000 }),
    ]);

    expect(groups[0].reason).toBe('플랜 조정');
  });

  // ★ -₩150,000 만 남으면 몇 달 뒤에 아무도 설명하지 못합니다
  it('★ 사유가 빈 줄도 묶여서 눈에 띕니다', () => {
    expect(groupAdjustments([row({ reason: '  ' })])[0].reason).toBe('(사유 없음)');
  });

  it('아무것도 없으면 빈 배열', () => {
    expect(groupAdjustments([])).toEqual([]);
  });
});

// =========================================================
// 마이너스 청구서 (CRD-) — 사용자 요청 2026-08-12
// =========================================================

describe('마이너스 청구서', () => {
  // ★ 깎는 것은 청구액에서 빼지, 입금으로 적지 않습니다.
  //   '입금 -50,000' 으로 적으면 통장에 없는 돈이 들어온 것이 됩니다.
  it('★ 깎은 만큼 받을 돈이 줄지, 받은 돈이 늘지 않습니다', () => {
    const money = summarize(100_000, [], [30_000]);

    expect(money.total).toBe(100_000);
    expect(money.credited).toBe(30_000);
    expect(money.billed).toBe(70_000);
    expect(money.paid).toBe(0);
    expect(money.unpaid).toBe(70_000);
  });

  it('깎고 남은 만큼 넣으면 완료입니다', () => {
    const money = summarize(100_000, [70_000], [30_000]);

    expect(money.unpaid).toBe(0);
    expect(money.status).toBe('paid');
  });

  // ★ 이미 다 낸 뒤에 깎으면 그만큼 돌려줄 돈이 됩니다
  it('★ 다 낸 뒤에 깎으면 과입금으로 남습니다', () => {
    const money = summarize(100_000, [100_000], [30_000]);

    expect(money.overpaid).toBe(30_000);
    expect(money.status).toBe('paid');
  });

  it('여러 장을 내면 합쳐집니다', () => {
    expect(summarize(100_000, [], [10_000, 20_000]).billed).toBe(70_000);
  });

  it('안 깎았으면 전과 똑같습니다', () => {
    const money = summarize(100_000, [40_000]);

    expect(money.credited).toBe(0);
    expect(money.billed).toBe(100_000);
    expect(money.unpaid).toBe(60_000);
  });
});

describe('깎을 수 있는 금액', () => {
  it('청구액 안이면 됩니다', () => {
    expect(checkCredit(30_000, 100_000, 0)).toEqual({ ok: true });
  });

  // ★ 음수를 넣게 두면 부호가 두 번 뒤집힙니다
  it('★ 0 이하는 못 넣습니다 — 양수로 받고 화면이 −를 붙입니다', () => {
    expect(checkCredit(0, 100_000, 0).ok).toBe(false);
    expect(checkCredit(-30_000, 100_000, 0).ok).toBe(false);
  });

  // ★ 더 깎으면 받을 돈이 음수가 됩니다 — 그건 환불이지 청구서가 아닙니다
  it('★ 청구액보다 많이는 못 깎습니다', () => {
    const verdict = checkCredit(120_000, 100_000, 0);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('100,000');
  });

  it('이미 깎은 것을 빼고 셉니다', () => {
    expect(checkCredit(30_000, 100_000, 80_000).ok).toBe(false);
    expect(checkCredit(20_000, 100_000, 80_000).ok).toBe(true);
  });

  it('전액을 깎았으면 그렇게 말해 줍니다', () => {
    const verdict = checkCredit(1, 100_000, 100_000);

    expect(verdict.ok === false && verdict.reason).toContain('전액');
  });

  it('소수점은 안 받습니다', () => {
    expect(checkCredit(1000.5, 100_000, 0).ok).toBe(false);
  });
});

describe('마이너스 청구서를 낼 수 있는 청구서인가', () => {
  // ★ 나가지도 않은 문서를 깎는 문서가 먼저 생기면 순서가 뒤집힙니다
  it('★ 발행 전에는 못 냅니다 — 마감을 되돌려 다시 만들면 됩니다', () => {
    expect(canCredit(null, null).ok).toBe(false);
  });

  it('취소된 청구서에는 못 냅니다', () => {
    expect(canCredit('INV-26000001', '2026-08-12T00:00:00Z').ok).toBe(false);
  });

  it('발행됐고 살아 있으면 냅니다', () => {
    expect(canCredit('INV-26000001', null)).toEqual({ ok: true });
  });

  it('사유가 없으면 못 냅니다', () => {
    expect(checkCreditReason('  ').ok).toBe(false);
    expect(checkCreditReason('리메이크 차감')).toEqual({ ok: true });
  });
});
