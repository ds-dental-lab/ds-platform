// =========================================================
// 놓을 위치: src/server/repositories/alimtalk-run.ts
//
// 알림톡 대기열을 비웁니다 — 1분마다 시계가 부릅니다. (2026-09-08)
//
// ★ 한 번에 50줄. 카카오·알리고 응답이 한 통에 수백 ms 라 그 이상은
//   한 요청 안에서 끝내기 어렵습니다. 남으면 1분 뒤 이어서.
// ★ 옛 줄(vars 없음)은 skipped — 보낼 글을 못 만듭니다.
// ★ 영구 실패(템플릿 불일치·검수 중·번호 이상)는 failed 로 끝내고,
//   잠깐 실패(잔액·연결)는 pending 으로 두고 attempts 만 올립니다. 다섯
//   번 넘게 실패하면 failed.
// ★ 열쇠가 없으면 아무것도 안 건드립니다 — 줄이 그대로 남아 있다가
//   열쇠가 들어오면 그때 나갑니다.
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderTemplate, type TemplateVars } from '@/server/domain/alimtalk/template';
import type { AlimtalkEvent } from '@/server/domain/alimtalk';
import { aligoConfigured, sendAligo } from '@/server/alimtalk/aligo';

const BATCH = 50;
const MAX_ATTEMPTS = 5;

export interface AlimtalkRun {
  configured: boolean;
  sent: number;
  failed: number;
  skipped: number;
  retry: number;
}

interface Row {
  id: string;
  event: AlimtalkEvent;
  phone: string;
  title: string;
  vars: TemplateVars | null;
  attempts: number;
}

export async function runAlimtalkQueue(): Promise<AlimtalkRun> {
  const result: AlimtalkRun = { configured: aligoConfigured(), sent: 0, failed: 0, skipped: 0, retry: 0 };
  if (!result.configured) return result;

  const admin = createAdminClient();
  const { data } = await admin
    .from('alimtalk_queue')
    .select('id, event, phone, title, vars, attempts')
    .eq('status', 'pending')
    .order('created_at')
    .limit(BATCH);

  for (const row of (data ?? []) as Row[]) {
    const rendered = renderTemplate(row.event, row.vars);
    if (!rendered.ok) {
      await admin.from('alimtalk_queue').update({ status: 'skipped', error: rendered.reason }).eq('id', row.id);
      result.skipped += 1;
      continue;
    }

    const sent = await sendAligo({
      phone: row.phone,
      templateCode: rendered.code,
      title: row.title,
      message: rendered.message,
      button: rendered.button,
    });

    const attempts = row.attempts + 1;

    if (sent.ok) {
      await admin
        .from('alimtalk_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), template_code: rendered.code, attempts, error: null })
        .eq('id', row.id);
      result.sent += 1;
      continue;
    }

    const giveUp = sent.permanent || attempts >= MAX_ATTEMPTS;
    await admin
      .from('alimtalk_queue')
      .update({ status: giveUp ? 'failed' : 'pending', template_code: rendered.code, attempts, error: sent.reason })
      .eq('id', row.id);
    if (giveUp) result.failed += 1;
    else result.retry += 1;
  }

  return result;
}
