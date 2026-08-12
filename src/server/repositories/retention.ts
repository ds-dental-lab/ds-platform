// =========================================================
// 놓을 위치: src/server/repositories/retention.ts
//
// 보관기간 설정과 **미리보기** — 지금 누르면 무엇이 몇 건 지워지는가.
//
// ★ 세는 것과 지우는 것을 갈라 둡니다.
//   화면은 먼저 세어 보여 주고, 사람이 누르면 그때 지웁니다.
//   "몇 건 지워집니다" 를 안 보여 주고 버튼만 두면, 아무도 안 누르거나
//   아무 생각 없이 누릅니다. 둘 다 나쁩니다.
//
// ★ 안 정한 항목(keep_days null)은 **세지도 않습니다.**
//   0건으로 보여 주면 "지울 게 없구나" 로 읽힙니다. 실제로는 규칙이
//   없는 것이고, 그건 다른 이야기입니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import {
  cutoffFor,
  RETENTION_TARGETS,
  type RetentionPlan,
  type RetentionTarget,
} from '@/server/domain/retention';

export interface RetentionRun {
  id: string;
  target: RetentionTarget;
  keepDays: number;
  cutoff: string;
  removed: number;
  ranAt: string;
  ranByName: string;
}

export interface RetentionBoard {
  plans: RetentionPlan[];
  runs: RetentionRun[];
}

export async function getRetentionBoard(): Promise<RetentionBoard | null> {
  const session = await getSession();
  if (!session?.orgId) return null;

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('retention_settings')
    .select('target, keep_days')
    .eq('org_id', session.orgId);

  const keep = new Map<RetentionTarget, number | null>();
  for (const r of (rows ?? []) as { target: RetentionTarget; keep_days: number | null }[]) {
    keep.set(r.target, r.keep_days);
  }

  const plans: RetentionPlan[] = [];

  for (const target of RETENTION_TARGETS) {
    const keepDays = keep.get(target) ?? null;
    const cutoff = cutoffFor(keepDays);

    plans.push({
      target,
      keepDays,
      cutoff: cutoff?.toISOString() ?? null,
      // ★ 안 정했으면 세지 않습니다
      due: cutoff ? await countDue(supabase, target, cutoff.toISOString(), session.orgId) : 0,
    });
  }

  return { plans, runs: await listRuns(supabase, session.orgId) };
}

/**
 * 이 기준으로 지워질 것이 몇 건인가.
 *
 * ★ 지울 때와 **똑같은 조건**으로 셉니다.
 *   조건이 갈리면 "3건" 이라고 보여 주고 5건을 지웁니다.
 *   그래서 조건을 dueFilter 한 곳에 두고 양쪽이 같이 씁니다.
 */
async function countDue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: RetentionTarget,
  cutoff: string,
  orgId: string,
): Promise<number> {
  const { count } = await dueQuery(supabase, target, cutoff, orgId, { head: true });

  return count ?? 0;
}

/**
 * 지울 것을 고르는 한 곳. 세는 쪽과 지우는 쪽이 같이 씁니다.
 *
 *   soft_deleted  지운 표시가 오래된 파일 (주문은 파일이 빠진 뒤에)
 *   audit_log     오래된 열람 기록
 *   order_file    끝난 주문에 붙은 파일
 */
export function dueQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: RetentionTarget,
  cutoff: string,
  orgId: string,
  opts: { head?: boolean; limit?: number } = {},
) {
  const select = opts.head
    ? { count: 'exact' as const, head: true }
    : { count: 'exact' as const };

  if (target === 'audit_log') {
    let q = supabase
      .from('audit_logs')
      .select('id', select)
      .eq('actor_org_id', orgId)
      .lt('created_at', cutoff);

    if (opts.limit) q = q.limit(opts.limit);

    return q;
  }

  if (target === 'soft_deleted') {
    let q = supabase
      .from('order_files')
      .select('id, storage_path', select)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff);

    if (opts.limit) q = q.limit(opts.limit);

    return q;
  }

  /*
    ★ 파일은 **주문이 끝난 날**부터 셉니다.
      올린 날부터 세면 오래 걸린 주문의 파일이 아직 만드는 중에
      사라집니다. 그래서 완료된 주문만 봅니다.
  */
  let q = supabase
    .from('order_files')
    .select('id, storage_path, order:orders!inner(status, updated_at)', select)
    .is('deleted_at', null)
    .eq('order.status', 'completed')
    .lt('order.updated_at', cutoff);

  if (opts.limit) q = q.limit(opts.limit);

  return q;
}

async function listRuns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<RetentionRun[]> {
  const { data } = await supabase
    .from('retention_runs')
    .select('id, target, keep_days, cutoff, removed, ran_at, ran_by')
    .eq('org_id', orgId)
    .order('ran_at', { ascending: false })
    .limit(20);

  interface Raw {
    id: string;
    target: RetentionTarget;
    keep_days: number;
    cutoff: string;
    removed: number;
    ran_at: string;
    ran_by: string | null;
  }

  const rows = (data ?? []) as unknown as Raw[];
  const ids = [...new Set(rows.map((r) => r.ran_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();

  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name')
      .in('id', ids);

    for (const p of (profiles ?? []) as { id: string; name: string | null }[]) {
      if (p.name) names.set(p.id, p.name);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    target: r.target,
    keepDays: r.keep_days,
    cutoff: r.cutoff,
    removed: r.removed,
    ranAt: r.ran_at,
    ranByName: r.ran_by ? (names.get(r.ran_by) ?? '') : '',
  }));
}
