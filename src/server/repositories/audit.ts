// =========================================================
// 놓을 위치: src/server/repositories/audit.ts
//
// 열람 기록 조회. 관리자만 봅니다 (RLS 가 잡습니다).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AuditAction } from '@/server/audit';

export interface AuditRow {
  id: number;
  action: AuditAction;
  actorName: string;
  targetId: string | null;
  subjectCount: number;
  detail: string | null;
  createdAt: string;
  /** 주문 열람이면 그 주문번호. 이름은 안 담습니다 */
  orderNo: string | null;
}

export interface AuditFilter {
  action?: AuditAction | 'all';
  /** 며칠치를 볼지 */
  days?: number;
  limit?: number;
}

export async function listAuditLogs(filter: AuditFilter = {}): Promise<AuditRow[]> {
  const supabase = await createClient();

  const days = filter.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('audit_logs')
    .select(
      'id, action, target_id, subject_count, detail, created_at, ' +
        'actor:user_profiles(name)',
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 200);

  if (filter.action && filter.action !== 'all') query = query.eq('action', filter.action);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as {
    id: number;
    action: AuditAction;
    target_id: string | null;
    subject_count: number;
    detail: string | null;
    created_at: string;
    actor: { name: string } | null;
  }[];

  /*
    주문번호를 곁들입니다 — id 만 있으면 무엇을 봤는지 사람이 못 읽습니다.
    ★ 환자 이름은 붙이지 않습니다. 로그가 또 하나의 명단이 됩니다.
  */
  const orderIds = [
    ...new Set(
      rows.filter((r) => r.action === 'order.view' && r.target_id).map((r) => r.target_id!),
    ),
  ];

  const orderNos = new Map<string, string>();

  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_no')
      .in('id', orderIds);

    for (const row of (orders ?? []) as { id: string; order_no: string }[]) {
      orderNos.set(row.id, row.order_no);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorName: row.actor?.name ?? '(알 수 없음)',
    targetId: row.target_id,
    subjectCount: row.subject_count,
    detail: row.detail,
    createdAt: row.created_at,
    orderNo: row.target_id ? (orderNos.get(row.target_id) ?? null) : null,
  }));
}

/** 요약 — 며칠 동안 몇 건, 몇 명분이 열렸는가 */
export interface AuditSummary {
  total: number;
  subjects: number;
  byAction: Record<string, number>;
}

export function summarize(rows: AuditRow[]): AuditSummary {
  const byAction: Record<string, number> = {};
  let subjects = 0;

  for (const row of rows) {
    byAction[row.action] = (byAction[row.action] ?? 0) + 1;
    subjects += row.subjectCount;
  }

  return { total: rows.length, subjects, byAction };
}
