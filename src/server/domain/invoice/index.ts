// =========================================================
// 놓을 위치: src/server/domain/invoice/index.ts
//
// 청구서 한 장의 셈. (사용자 요청 2026-08-12)
//
// ★ 미납은 '청구액 − 들어온 돈' 입니다. 따로 안 적습니다.
//   미납 칸을 두고 손으로 줄이면, 입금 줄과 미납 칸이 언젠가 어긋납니다.
//   어긋나면 어느 쪽이 맞는지 아무도 모릅니다 — 돈 이야기에서 제일
//   나쁜 상태입니다. 늘 빼서 셉니다.
//
// ★ 상태는 미납이 정합니다.
//   '완료' 딱지를 따로 두고 손으로 켜면, 딱지는 완료인데 미납이 남는
//   경우가 생깁니다. 미납이 0 이하면 완료, 아니면 미입금입니다.
//
// ★ 입금은 여러 번 나눠 들어옵니다.
//   반만 넣고 나머지는 다음 달에 넣는 일이 흔합니다.
// =========================================================

/** 납부기한을 매기는 날. 쓰던 시스템과 같게 15일입니다 */
export const PAYMENT_DAY = 15;

export type InvoiceStatus = 'unpaid' | 'paid';

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  unpaid: '미입금',
  paid: '완료',
};

/**
 * 아직 안 들어온 돈. 음수는 안 나옵니다 (더 들어왔으면 0).
 *
 * ★ 과입금은 0 으로 보여 주되 사라지지 않습니다.
 *   `overpaid` 로 따로 알려 주어야 다음 달에 떼어 쓸 수 있습니다.
 */
export function unpaidAmount(total: number, paid: number): number {
  return Math.max(0, total - paid);
}

/** 넘게 들어온 돈. 없으면 0 */
export function overpaidAmount(total: number, paid: number): number {
  return Math.max(0, paid - total);
}

export function invoiceStatus(total: number, paid: number): InvoiceStatus {
  return unpaidAmount(total, paid) === 0 ? 'paid' : 'unpaid';
}

export type PaymentVerdict = { ok: true } | { ok: false; reason: string };

/**
 * 이 금액을 입금으로 적을 수 있는가.
 *
 * ★ 0원을 막습니다. 아무것도 안 바뀌는 줄이 이력에 쌓입니다.
 *
 * ★ 남은 것보다 많이 넣는 것은 **막지 않고 알려만 줍니다.**
 *   반올림·수수료·합쳐 보낸 입금 때문에 실제로 넘게 들어옵니다.
 *   막아 버리면 사람은 숫자를 고쳐 적습니다 — 그러면 통장과 장부가
 *   영영 안 맞습니다. 들어온 대로 적고 남는 것은 남는 대로 둡니다.
 */
export function checkPayment(amount: number, unpaid: number): PaymentVerdict {
  if (!Number.isFinite(amount) || Math.trunc(amount) !== amount) {
    return { ok: false, reason: '금액을 숫자로 넣어 주세요' };
  }
  if (amount === 0) return { ok: false, reason: '0원은 적을 수 없습니다' };

  // 되돌리는 줄(음수)은 남은 미납보다 크게 뺄 수 없습니다
  if (amount < 0 && unpaid + amount > Number.MAX_SAFE_INTEGER) {
    return { ok: false, reason: '금액이 너무 큽니다' };
  }

  return { ok: true };
}

/**
 * 납부기한 — 발행일이 든 달의 15일. 그날이 지났으면 다음 달 15일.
 *
 * ★ 발행일에 며칠을 더하는 식이 아닙니다.
 *   거래처마다 "매달 15일에 결제" 로 잡아 두는 것이 실제 관행이라,
 *   3일에 발행하든 10일에 발행하든 같은 날이 되어야 헷갈리지 않습니다.
 */
export function paymentDueDate(issuedOn: string, day = PAYMENT_DAY): string {
  const year = Number(issuedOn.slice(0, 4));
  const month = Number(issuedOn.slice(5, 7));
  const dayOfMonth = Number(issuedOn.slice(8, 10));

  const shift = dayOfMonth > day ? 1 : 0;
  const y = month + shift > 12 ? year + 1 : year;
  const m = ((month + shift - 1) % 12) + 1;

  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 청구서 한 줄이 목록에서 보이는 모양.
 *
 * ★ 화면이 셈하지 않게 여기서 다 만들어 보냅니다.
 *   같은 뺄셈을 목록·상세·인쇄 세 곳에서 하면 언젠가 하나가 달라집니다.
 */
export interface InvoiceSummary {
  /** 청구서에 찍힌 금액. 한 번 나가면 안 바뀝니다 */
  total: number;
  /** 마이너스 청구서로 깎은 합 (양수) */
  credited: number;
  /** 실제로 받을 돈 — total 에서 깎은 것을 뺀 값 */
  billed: number;
  paid: number;
  unpaid: number;
  overpaid: number;
  status: InvoiceStatus;
}

export function summarize(
  total: number,
  payments: number[],
  credits: number[] = [],
): InvoiceSummary {
  const paid = payments.reduce((sum, v) => sum + v, 0);
  const credited = credits.reduce((sum, v) => sum + v, 0);

  /*
    ★ 깎는 것은 청구액에서 빼지, 입금으로 적지 않습니다.
      마이너스 청구서를 '입금 -50,000' 으로 적으면 통장에 없는 돈이
      들어온 것이 됩니다. 그러면 '얼마 받았나' 를 물을 때마다 틀립니다.
      받을 돈이 줄어든 것이지, 받은 돈이 는 것이 아닙니다.
  */
  const billed = total - credited;

  return {
    total,
    credited,
    billed,
    paid,
    unpaid: unpaidAmount(billed, paid),
    overpaid: overpaidAmount(billed, paid),
    status: invoiceStatus(billed, paid),
  };
}

// ---------- 마이너스 청구서 (CRD-) ----------

/**
 * ★ 나간 청구서는 못 고칩니다. 대신 **깎는 문서를 새로 냅니다.**
 *   "한 번 나간 문서의 숫자가 나중에 달라지면 신뢰가 무너집니다" 는
 *   이 프로젝트가 처음부터 지켜 온 규칙입니다. 그런데 리메이크·과청구처럼
 *   나중에 되돌려야 하는 일은 실제로 생깁니다. 그때 원본을 손대는 대신
 *   **CRD- 번호가 붙은 마이너스 청구서**를 한 장 더 냅니다.
 *   원본과 깎은 문서가 나란히 남아, 몇 달 뒤에도 설명이 됩니다.
 */
export const CREDIT_PREFIX = 'CRD-';

/**
 * 이 금액을 깎을 수 있는가.
 *
 * ★ 양수로 받습니다. 화면에서 −를 붙여 보여 줍니다.
 *   음수를 입력하게 두면 "−50000 을 깎는다" 가 되어 부호가 두 번
 *   뒤집힙니다. 적는 사람도 읽는 사람도 헷갈립니다.
 *
 * ★ 청구액보다 많이 못 깎습니다.
 *   더 깎으면 받을 돈이 음수가 됩니다 — 그건 청구서가 아니라 환불이고,
 *   여기서 다룰 일이 아닙니다.
 */
export function checkCredit(
  amount: number,
  total: number,
  alreadyCredited: number,
): PaymentVerdict {
  if (!Number.isFinite(amount) || Math.trunc(amount) !== amount) {
    return { ok: false, reason: '금액을 숫자로 넣어 주세요' };
  }
  if (amount <= 0) return { ok: false, reason: '깎을 금액을 넣어 주세요' };

  const room = total - alreadyCredited;

  if (amount > room) {
    return {
      ok: false,
      reason:
        room > 0
          ? `이 청구서에서 더 깎을 수 있는 금액은 ${room.toLocaleString('ko-KR')}원입니다`
          : '이미 전액을 깎았습니다',
    };
  }

  return { ok: true };
}

/** 마이너스 청구서에는 사유가 반드시 있어야 합니다 */
export function checkCreditReason(reason: string): PaymentVerdict {
  if (!reason.trim()) return { ok: false, reason: '사유를 적어 주세요' };
  return { ok: true };
}

/**
 * ★ 발행된 청구서에만 붙습니다.
 *   아직 안 나간 것은 그냥 마감을 되돌려 다시 만들면 됩니다.
 *   나가지도 않은 문서를 깎는 문서가 먼저 생기면 순서가 뒤집힙니다.
 */
export function canCredit(invoiceNo: string | null, cancelledAt: string | null): PaymentVerdict {
  if (!invoiceNo) return { ok: false, reason: '아직 발행되지 않은 청구서입니다' };
  if (cancelledAt) return { ok: false, reason: '취소된 청구서입니다' };
  return { ok: true };
}

// ---------- 조정 내역 ----------

/**
 * 조정 한 줄. 청구서에서 깎거나 더한 금액입니다.
 *
 * ★ 조정은 '왜' 가 금액보다 중요합니다.
 *   -₩150,000 만 남으면 몇 달 뒤에 아무도 설명하지 못합니다.
 *   사유가 빈 줄은 목록에서 눈에 띄어야 합니다.
 */
export interface AdjustmentRow {
  id: string;
  invoiceNo: string | null;
  partyName: string;
  authorName: string;
  reason: string;
  amount: number;
  createdAt: string;
}

/** 사유별로 묶은 것 — 무엇 때문에 얼마나 깎았는지 */
export interface AdjustmentGroup {
  reason: string;
  count: number;
  amount: number;
}

/**
 * 사유가 같은 줄을 묶습니다.
 *
 * ★ 목록만 있으면 '이번 달에 우수고객할인으로 얼마나 나갔나' 를
 *   사람이 눈으로 더해야 합니다. 그 셈은 늘 틀립니다.
 */
export function groupAdjustments(rows: AdjustmentRow[]): AdjustmentGroup[] {
  const map = new Map<string, AdjustmentGroup>();

  for (const row of rows) {
    const reason = row.reason.trim() || '(사유 없음)';
    const found = map.get(reason) ?? { reason, count: 0, amount: 0 };

    found.count += 1;
    found.amount += row.amount;
    map.set(reason, found);
  }

  // 많이 나간 것부터 (음수라 절댓값으로 봅니다)
  return [...map.values()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}
