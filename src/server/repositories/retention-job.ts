// =========================================================
// 놓을 위치: src/server/repositories/retention-job.ts
//
// 새벽 3시(KST)에 시계가 부르는 자동 파기. (사용자 결정 2026-09-07 —
// "자동으로 하는 게 좋아 보여. 그러나 의뢰 내역은 지워지면 안 된다")
//
// ★★ **주문(의뢰 내역)은 절대 안 지웁니다.** 여기서 지우는 것은 셋뿐 —
//   ① 끝난 주문에 붙은 파일(저장소 덩어리 + order_files 줄),
//   ② 지웠다고 표시만 해 둔 파일, ③ 오래된 열람 기록.
//   orders 표는 어느 갈래에서도 건드리지 않습니다 — 손으로 누르던
//   파기(actions/retention)와 같은 dueQuery 를 그대로 씁니다.
//
// ★ 기간은 관리자가 정한 값(retention_settings)만 씁니다. 안 정한 항목은
//   안 지웁니다 — 손 파기와 같은 규칙.
// ★ 한 번에 다 못 지우면 이어서 지웁니다(200개씩, 한 밤에 최대 20번).
//   저장소 삭제가 느려 한 요청 안에서 끝내기 어렵고, 남으면 내일 새벽에
//   또 옵니다.
// ★ 기록(retention_runs)은 ran_by 가 비어 있으면 '시계가 했다' 입니다.
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { dueQuery } from '@/server/repositories/retention';
import { cutoffFor, RETENTION_TARGETS, PURGE_BATCH, type RetentionTarget } from '@/server/domain/retention';

const BUCKET = 'order-files';
/** 한 밤에 도는 묶음 수의 상한 — 무한히 돌지 않게 */
const MAX_BATCHES = 20;

export interface RetentionJobResult {
  orgs: number;
  removed: Record<RetentionTarget, number>;
  /** 상한에 걸려 내일로 넘긴 항목 */
  leftover: RetentionTarget[];
}

/** 처리방침 제3조의 고정 보유기간 — 문의·알림 기록 1년 (domain/privacy FIXED_KEEP 과 같은 숫자) */
const FIXED_KEEP_DAYS = 365;

export async function runRetentionJob(now: Date = new Date()): Promise<RetentionJobResult> {
  const admin = createAdminClient();

  /*
    ★ 수가표 문의(처리 완료 뒤)·알림톡 발송 기록은 관리자 설정이 아니라
      처리방침에 적은 고정값 1년으로 지웁니다 (2026-09-08). 문의는 치과가
      회원이 아니어서 다른 어떤 표에도 안 묶여 있고, 발송 기록은 번호와
      환자 이름이 들어 있어 오래 둘 이유가 없습니다.
  */
  const fixedCutoff = new Date(now.getTime() - FIXED_KEEP_DAYS * 86400_000).toISOString();
  await admin.from('contact_requests').delete().eq('status', 'done').lt('handled_at', fixedCutoff);
  await admin.from('alimtalk_queue').delete().lt('created_at', fixedCutoff);
  const result: RetentionJobResult = {
    orgs: 0,
    removed: { soft_deleted: 0, audit_log: 0, order_file: 0 },
    leftover: [],
  };

  // 파기는 디자인센터의 일입니다 — 설정도 센터 줄에만 있습니다
  const { data: settings } = await admin
    .from('retention_settings')
    .select('org_id, target, keep_days');

  type Setting = { org_id: string; target: RetentionTarget; keep_days: number | null };
  const rows = (settings ?? []) as Setting[];
  result.orgs = new Set(rows.map((r) => r.org_id)).size;

  for (const target of RETENTION_TARGETS) {
    for (const setting of rows.filter((r) => r.target === target)) {
      const cutoff = cutoffFor(setting.keep_days, now);
      if (!cutoff) continue;
      const iso = cutoff.toISOString();

      let batches = 0;
      while (batches < MAX_BATCHES) {
        batches += 1;

        // ★ dueQuery 는 사용자 세션용 타입으로 선언돼 있지만 같은 supabase-js 클라이언트입니다
        const { data, error } = await dueQuery(
          admin as unknown as Parameters<typeof dueQuery>[0],
          target,
          iso,
          setting.org_id,
          { limit: PURGE_BATCH },
        );
        if (error) {
          console.error('[retention-job] 찾지 못했습니다', target, error.message);
          break;
        }

        const due = (data ?? []) as { id: string; storage_path?: string }[];
        if (due.length === 0) break;

        let removed = 0;
        if (target === 'audit_log') {
          const { data: gone } = await admin
            .from('audit_logs')
            .delete()
            .in('id', due.map((r) => r.id))
            .select('id');
          removed = gone?.length ?? 0;
        } else {
          // ★ 저장소를 먼저 비웁니다 — 표를 먼저 지우면 경로를 잃습니다
          const paths = due.map((r) => r.storage_path).filter(Boolean) as string[];
          if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths);

          const { data: gone } = await admin
            .from('order_files')
            .delete()
            .in('id', due.map((r) => r.id))
            .select('id');
          removed = gone?.length ?? 0;
        }

        result.removed[target] += removed;

        await admin.from('retention_runs').insert({
          org_id: setting.org_id,
          target,
          keep_days: setting.keep_days,
          cutoff: iso,
          removed,
          ran_by: null,
        });

        if (removed === 0) break; // 지워지지 않는 줄이 남아 있으면 헛돌지 않게
        if (due.length < PURGE_BATCH) break;
      }

      if (batches >= MAX_BATCHES) result.leftover.push(target);
    }
  }

  return result;
}
