// =========================================================
// 놓을 위치: src/server/actions/retention.ts
//
// 보관기간 정하기 · 파기 실행.
//
// ★ 파기는 저절로 안 돕니다. 사람이 누릅니다.
//   밤사이 배치가 돌아 환자 파일이 사라졌는데 그날 무엇이 지워졌는지
//   아무도 모르는 상태가 제일 나쁩니다. 몇 건인지 보여 주고 누르게 합니다.
//
// ★ 끊어서 지웁니다 (PURGE_BATCH).
//   파일은 저장소에서도 지워야 해서 한 건에 왕복이 붙습니다. 수천 건을
//   한 번에 돌리면 화면이 먼저 끊기고, 어디까지 지웠는지 모르게 됩니다.
//   지운 수와 남은 수를 돌려주고, 다시 누르면 이어서 지웁니다.
//
// ★ 저장소를 먼저 비우고 표를 지웁니다.
//   표를 먼저 지우면 경로를 잃어 저장소에 덩어리가 영영 남습니다
//   (파일 지우기와 같은 순서 — actions/order-file).
//
// ★ 무엇을 몇 건 지웠는지 남깁니다 (retention_runs).
//   "그 파일 어디 갔냐" 에 답할 수 있어야 합니다. 내용은 안 남깁니다 —
//   파기 기록이 개인정보 사본이 되면 안 됩니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { dueQuery } from '@/server/repositories/retention';
import {
  checkKeepDays,
  cutoffFor,
  canManage,
  PURGE_BATCH,
  type RetentionTarget,
} from '@/server/domain/retention';

export type RetentionResult = { ok: true } | { ok: false; error: string };

export type PurgeResult =
  | { ok: true; removed: number; left: number }
  | { ok: false; error: string };

const BUCKET = 'order-files';

async function requireManager() {
  const session = await getSession();
  if (!session?.orgId) return null;
  if (!canManage(session.role)) return null;

  return session;
}

function refresh() {
  for (const p of ['/clinic', '/design', '/lab']) revalidatePath(`${p}/account/retention`);
}

// ---------- 기간 정하기 ----------

export async function submitKeepDays(
  target: RetentionTarget,
  keepDays: number | null,
): Promise<RetentionResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '관리자만 정할 수 있습니다' };

  const verdict = checkKeepDays(keepDays);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createClient();

  const { error } = await supabase.from('retention_settings').upsert(
    {
      org_id: session.orgId,
      target,
      keep_days: keepDays,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,target' },
  );

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };

  refresh();

  return { ok: true };
}

// ---------- 파기 ----------

export async function submitPurge(target: RetentionTarget): Promise<PurgeResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '관리자만 파기할 수 있습니다' };

  const supabase = await createClient();

  /*
    ★ 화면이 보낸 기간을 안 믿습니다. 표에서 다시 읽습니다.
      화면이 오래됐거나 손으로 부른 요청이면 엉뚱한 기간으로 지웁니다.
  */
  const { data: setting } = await supabase
    .from('retention_settings')
    .select('keep_days')
    .eq('org_id', session.orgId)
    .eq('target', target)
    .maybeSingle();

  const keepDays = (setting as { keep_days: number | null } | null)?.keep_days ?? null;
  if (keepDays === null) {
    return { ok: false, error: '보관기간을 먼저 정해 주세요. 안 정한 것은 안 지웁니다' };
  }

  const cutoff = cutoffFor(keepDays);
  if (!cutoff) return { ok: false, error: '보관기간이 이상합니다' };

  const iso = cutoff.toISOString();

  const { data, error } = await dueQuery(supabase, target, iso, session.orgId, {
    limit: PURGE_BATCH,
  });

  if (error) return { ok: false, error: `찾지 못했습니다: ${error.message}` };

  const rows = (data ?? []) as { id: string; storage_path?: string }[];
  if (rows.length === 0) return { ok: true, removed: 0, left: 0 };

  let removed = 0;

  if (target === 'audit_log') {
    const { data: gone, error: delError } = await supabase
      .from('audit_logs')
      .delete()
      .in('id', rows.map((r) => r.id))
      .select('id');

    if (delError) return { ok: false, error: `지우지 못했습니다: ${delError.message}` };
    removed = gone?.length ?? 0;
  } else {
    // ★ 저장소를 먼저 비웁니다 — 표를 먼저 지우면 경로를 잃습니다
    const paths = rows.map((r) => r.storage_path).filter(Boolean) as string[];
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);

    const { data: gone, error: delError } = await supabase
      .from('order_files')
      .delete()
      .in('id', rows.map((r) => r.id))
      .select('id');

    if (delError) return { ok: false, error: `지우지 못했습니다: ${delError.message}` };
    removed = gone?.length ?? 0;
  }

  // 남은 수를 다시 셉니다 — "이어서 누르세요" 를 말해 주려고
  const { count } = await dueQuery(supabase, target, iso, session.orgId, { head: true });

  await supabase.from('retention_runs').insert({
    org_id: session.orgId,
    target,
    keep_days: keepDays,
    cutoff: iso,
    removed,
    ran_by: session.user.id,
  });

  refresh();

  return { ok: true, removed, left: count ?? 0 };
}
