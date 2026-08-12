// =========================================================
// 놓을 위치: src/server/repositories/invoice.ts
//
// 청구 내역 · 정산(입금) 내역 · 조정 내역.
//
// ★ 금액은 굳은 줄(billing_lines)에서 셉니다.
//   발행된 청구서는 주문에서 다시 세면 안 됩니다 — 마감 뒤에 단가를
//   고치거나 주문을 손대도 지난 청구서는 그대로여야 합니다.
//
// ★ 미납은 저장하지 않고 뺍니다 (domain/invoice).
//   미납 칸을 두고 손으로 줄이면 입금 줄과 언젠가 어긋납니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { summarize, type InvoiceStatus, type AdjustmentRow } from '@/server/domain/invoice';
import type { InvoiceMethod } from '@/server/domain/invoice-method';

export interface InvoiceRow {
  periodId: string;
  invoiceNo: string;
  yearMonth: string;
  issuedAt: string;
  /** 발행할 때 베낀 값 — 지금 거래처 설정이 아닙니다 */
  method: InvoiceMethod | null;
  sentTo: string | null;
  sentCount: number;

  partyOrgId: string;
  partyName: string;
  partyType: 'clinic' | 'lab';

  total: number;
  /** 마이너스 청구서로 깎은 합 (양수) */
  credited: number;
  /** 실제로 받을 돈 = total − credited */
  billed: number;
  paid: number;
  unpaid: number;
  overpaid: number;
  status: InvoiceStatus;

  dueDate: string | null;
  periodFrom: string;
  periodTo: string;
}

export interface InvoiceFilter {
  /** '2026-07' ~ '2026-08' — 발행일 기준이 아니라 정산 달 기준입니다 */
  fromMonth?: string;
  toMonth?: string;
  partyType?: 'clinic' | 'lab';
  /** 상호 일부 */
  name?: string;
  /** 안 고르면 둘 다 */
  statuses?: InvoiceStatus[];
}

interface RawPeriod {
  id: string;
  invoice_no: string | null;
  year_month: string;
  issued_at: string | null;
  invoice_method: InvoiceMethod | null;
  invoice_to: string | null;
  sent_count: number;
  due_date: string | null;
  period_from: string;
  period_to: string;
  party_org_id: string;
  party: { name: string; org_type: 'clinic' | 'lab' } | null;
}

/**
 * 발행된 청구서 전부.
 *
 * ★ 발행 전(마감만 한) 기간은 안 나옵니다.
 *   청구 내역은 '나간 문서' 의 목록입니다. 마감만 하고 안 보낸 것을
 *   섞으면 "보냈다" 는 사실이 흐려집니다 — 그건 정산 탭이 봅니다.
 */
export async function listInvoices(filter: InvoiceFilter = {}): Promise<InvoiceRow[]> {
  const session = await getSession();
  if (!session?.orgId) return [];

  const supabase = await createClient();

  let query = supabase
    .from('billing_periods')
    .select(
      'id, invoice_no, year_month, issued_at, invoice_method, invoice_to, sent_count, ' +
        'due_date, period_from, period_to, party_org_id, ' +
        'party:organizations!billing_periods_party_org_id_fkey(name, org_type)',
    )
    .not('issued_at', 'is', null)
    .order('issued_at', { ascending: false });

  if (filter.fromMonth) query = query.gte('year_month', filter.fromMonth);
  if (filter.toMonth) query = query.lte('year_month', filter.toMonth);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = (data as unknown as RawPeriod[]).filter((r) => r.invoice_no);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const [lineRes, payRes, creditRes] = await Promise.all([
    supabase.from('billing_lines').select('period_id, amount').in('period_id', ids),
    supabase.from('billing_payments').select('period_id, amount').in('period_id', ids),
    // 취소된 마이너스 청구서는 안 셉니다 — 취소는 '없던 일' 이 됩니다
    supabase
      .from('credit_notes')
      .select('period_id, amount')
      .in('period_id', ids)
      .is('cancelled_at', null),
  ]);

  const totals = new Map<string, number>();
  for (const line of (lineRes.data ?? []) as { period_id: string; amount: number }[]) {
    totals.set(line.period_id, (totals.get(line.period_id) ?? 0) + line.amount);
  }

  const paid = new Map<string, number[]>();
  for (const pay of (payRes.data ?? []) as { period_id: string; amount: number }[]) {
    paid.set(pay.period_id, [...(paid.get(pay.period_id) ?? []), pay.amount]);
  }

  const credits = new Map<string, number[]>();
  for (const note of (creditRes.data ?? []) as { period_id: string; amount: number }[]) {
    credits.set(note.period_id, [...(credits.get(note.period_id) ?? []), note.amount]);
  }

  const out = rows.map((row) => {
    const money = summarize(
      totals.get(row.id) ?? 0,
      paid.get(row.id) ?? [],
      credits.get(row.id) ?? [],
    );

    return {
      periodId: row.id,
      invoiceNo: row.invoice_no as string,
      yearMonth: row.year_month,
      issuedAt: row.issued_at as string,
      method: row.invoice_method,
      sentTo: row.invoice_to,
      sentCount: row.sent_count,
      partyOrgId: row.party_org_id,
      partyName: row.party?.name ?? '',
      partyType: row.party?.org_type ?? 'clinic',
      dueDate: row.due_date,
      periodFrom: row.period_from,
      periodTo: row.period_to,
      ...money,
    };
  });

  return out.filter((row) => {
    if (filter.partyType && row.partyType !== filter.partyType) return false;
    if (filter.name && !row.partyName.includes(filter.name.trim())) return false;
    if (filter.statuses && filter.statuses.length > 0 && !filter.statuses.includes(row.status)) {
      return false;
    }

    return true;
  });
}

/** 청구서 한 장 */
export async function getInvoice(periodId: string): Promise<InvoiceRow | null> {
  const rows = await listInvoices();

  return rows.find((r) => r.periodId === periodId) ?? null;
}

// ---------- 입금 내역 ----------

export interface PaymentRow {
  id: string;
  periodId: string;
  invoiceNo: string;
  partyName: string;
  amount: number;
  paidOn: string;
  memo: string;
  authorName: string;
  createdAt: string;
}

export async function listPayments(fromMonth?: string, toMonth?: string): Promise<PaymentRow[]> {
  const session = await getSession();
  if (!session?.orgId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('billing_payments')
    .select(
      'id, period_id, amount, paid_on, memo, created_by, created_at, ' +
        'period:billing_periods!inner(invoice_no, year_month, ' +
        'party:organizations!billing_periods_party_org_id_fkey(name))',
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  interface Raw {
    id: string;
    period_id: string;
    amount: number;
    paid_on: string;
    memo: string | null;
    created_by: string | null;
    created_at: string;
    period: { invoice_no: string | null; year_month: string; party: { name: string } | null };
  }

  const rows = (data as unknown as Raw[]).filter((r) => {
    if (fromMonth && r.period.year_month < fromMonth) return false;
    if (toMonth && r.period.year_month > toMonth) return false;

    return true;
  });

  const names = await loadUserNames(supabase, rows.map((r) => r.created_by));

  return rows.map((r) => ({
    id: r.id,
    periodId: r.period_id,
    invoiceNo: r.period.invoice_no ?? '',
    partyName: r.period.party?.name ?? '',
    amount: r.amount,
    paidOn: r.paid_on,
    memo: r.memo ?? '',
    authorName: r.created_by ? (names.get(r.created_by) ?? '') : '',
    createdAt: r.created_at,
  }));
}

// ---------- 조정 내역 ----------

/**
 * 조정 줄 전부.
 *
 * ★ 청구번호는 그 조정이 실린 청구서의 번호입니다.
 *   아직 안 실린 조정(마감 전)은 번호가 없습니다 — 그것도 보여 줍니다.
 *   목록에서 빠지면 "분명 깎아 뒀는데" 가 됩니다.
 */
export async function listAdjustments(
  fromMonth?: string,
  toMonth?: string,
): Promise<AdjustmentRow[]> {
  const session = await getSession();
  if (!session?.orgId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('billing_adjustments')
    .select(
      'id, amount, reason, created_by, created_at, posted_line_id, ' +
        'party:organizations!billing_adjustments_party_org_id_fkey(name)',
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  interface Raw {
    id: string;
    amount: number;
    reason: string | null;
    created_by: string | null;
    created_at: string;
    posted_line_id: string | null;
    party: { name: string } | null;
  }

  const rows = (data as unknown as Raw[]).filter((r) => {
    const month = toKstMonth(r.created_at);
    if (fromMonth && month < fromMonth) return false;
    if (toMonth && month > toMonth) return false;

    return true;
  });

  // 실린 청구서 번호는 굳은 줄을 거쳐 찾습니다
  const lineIds = rows.map((r) => r.posted_line_id).filter(Boolean) as string[];
  const invoiceOf = new Map<string, string>();

  if (lineIds.length > 0) {
    const { data: lines } = await supabase
      .from('billing_lines')
      .select('id, period:billing_periods!inner(invoice_no)')
      .in('id', lineIds);

    for (const line of (lines ?? []) as unknown as {
      id: string;
      period: { invoice_no: string | null } | null;
    }[]) {
      if (line.period?.invoice_no) invoiceOf.set(line.id, line.period.invoice_no);
    }
  }

  const names = await loadUserNames(supabase, rows.map((r) => r.created_by));

  return rows.map((r) => ({
    id: r.id,
    invoiceNo: r.posted_line_id ? (invoiceOf.get(r.posted_line_id) ?? null) : null,
    partyName: r.party?.name ?? '',
    authorName: r.created_by ? (names.get(r.created_by) ?? '') : '',
    reason: r.reason ?? '',
    amount: r.amount,
    createdAt: r.created_at,
  }));
}

// ---------- 조각들 ----------

async function loadUserNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  const map = new Map<string, string>();

  if (unique.length === 0) return map;

  const { data } = await supabase.from('user_profiles').select('id, name').in('id', unique);

  for (const row of (data ?? []) as { id: string; name: string | null }[]) {
    if (row.name) map.set(row.id, row.name);
  }

  return map;
}

/** UTC 시각을 한국 기준 '2026-08' 로 */
function toKstMonth(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

// ---------- 마이너스 청구서 ----------

export interface CreditNoteRow {
  id: string;
  creditNo: string;
  amount: number;
  reason: string;
  issuedAt: string;
  issuedBy: string;
  cancelledAt: string | null;
  cancelReason: string;
}

/**
 * 이 청구서에 붙은 마이너스 청구서들.
 *
 * ★ 취소된 것도 함께 돌려줍니다.
 *   번호가 붙은 문서라 지우지 않습니다. 취소한 것도 보여야
 *   "그 번호 어디 갔냐" 를 안 묻습니다. 셈에서만 빠집니다.
 */
export async function listCreditNotes(periodId: string): Promise<CreditNoteRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('credit_notes')
    .select(
      'id, credit_no, amount, reason, issued_at, cancelled_at, cancel_reason, ' +
        'issuer:user_profiles!credit_notes_issued_by_fkey(name)',
    )
    .eq('period_id', periodId)
    .order('issued_at', { ascending: false });

  type Raw = {
    id: string;
    credit_no: string;
    amount: number;
    reason: string;
    issued_at: string;
    cancelled_at: string | null;
    cancel_reason: string | null;
    issuer: { name: string | null } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    creditNo: row.credit_no,
    amount: row.amount,
    reason: row.reason,
    issuedAt: row.issued_at,
    issuedBy: row.issuer?.name ?? '',
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason ?? '',
  }));
}
