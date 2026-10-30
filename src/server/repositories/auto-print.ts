// =========================================================
// 놓을 위치: src/server/repositories/auto-print.ts
//
// 자동 템포러리 — 작업 큐 (사용자 요청 2026-10-06).
//
// ★ **치과 쪽으로 들어오는 연결이 없습니다.** 치과 PC 가 밖으로 물어보고
//   작업을 받아 갑니다. 그래서 여기에 치과 IP 도 포트도 없습니다 —
//   포트포워딩을 버린 자리가 이 파일입니다.
//
// ★ 출력 파일은 우리 서버를 지나가지 않습니다. 저장소가 내주는
//   **서명 주소**로 치과 PC 가 바로 내려받습니다. 스캔 올릴 때와 같은 길입니다.
//
// ★ 단계를 옮기는 규칙은 여기 없습니다 — domain/auto-print 가 정합니다.
//   여기서는 **그 규칙을 어기는 요청을 거절**하기만 합니다.
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  alertOnMove,
  canHandDesign,
  canClearBed,
  canDismiss,
  designVerdict,
  endedMessage,
  stallAdvice,
  canMove,
  claimable,
  isAutoStep,
  isDesignStage,
  retryTo,
  teethMismatch,
  typicalPrintSeconds,
  PAUSE_MARK,
  type AutoJob,
  type AutoStep,
  type DesignStage,
  designGroups,
  type DesignGroup,
} from '@/server/domain/auto-print';
import { publishAutoAlert, publishDesignStall } from '@/server/events/auto-print';
import type { LinkedDevice } from '@/server/repositories/device-link';
import { issueExocadToken } from '@/server/exocad/token';
import { olderThan } from '@/server/domain/agent';

/** 하던 출력을 이어서 지켜볼 줄 아는 에이전트 판 (2026-10-23) */
const RESUME_SINCE = '1.3.15';
/** 집어 간 지 이만큼 지나야 '다시 켜져 놓친 것' 으로 봅니다 (2026-10-27) */
const RESUME_AFTER_SECONDS = 90;

const BUCKET = 'order-files';

/** 서명 주소가 살아 있는 시간. 큰 파일을 느린 선에서 받아도 되게 넉넉히 */
const DOWNLOAD_TTL = 30 * 60;

interface JobRow {
  id: string;
  order_id: string;
  clinic_org_id: string;
  printer_id: string | null;
  step: AutoStep;
  bed_cleared_at: string | null;
  percent: number | null;
  tries: number;
  failed_at: AutoStep | null;
  failed_reason: string | null;
  print_file_path: string;
  design_stage: string | null;
  design_note: string | null;
  finished_at: string | null;
  /** 치과가 FlowTemp 를 그만둔 시각 — 찍히면 없는 건으로 봅니다 (2026-10-19) */
  dismissed_at: string | null;
  started_at: string | null;
  remaining_min: number | null;
  layer_now: number | null;
  layer_total: number | null;
}

const asJob = (row: JobRow): AutoJob => ({
  step: row.step,
  bedClearedAt: row.bed_cleared_at,
  percent: row.percent,
  failedAt: row.failed_at,
  failedReason: row.failed_reason,
  designNote: row.design_note ?? null,
  designStage: isDesignStage(row.design_stage) ? row.design_stage : null,
  finishedAt: row.finished_at,
  startedAt: row.started_at,
  remainingMin: row.remaining_min,
  layerNow: row.layer_now,
  layerTotal: row.layer_total,
});

const COLUMNS =
  'id, order_id, clinic_org_id, printer_id, step, bed_cleared_at, ' +
  'percent, tries, failed_at, failed_reason, print_file_path, design_stage, design_note, finished_at, ' +
  'started_at, remaining_min, layer_now, layer_total, dismissed_at';

/** 주문 하나의 작업. 없으면 null */
export async function jobOfOrder(
  orderId: string,
): Promise<(AutoJob & { id: string; designNote: string | null; dismissed: boolean }) | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('auto_jobs').select(COLUMNS).eq('order_id', orderId).maybeSingle();
  const row = data as JobRow | null;
  // ★ 그만둔 건은 없는 건입니다 (2026-10-21) — 책갈피와 같은 눈. 그만둔 뒤에도 주문 상세에
  //   '디자인 다시 걸기' 가 남아 있어, 눌렀더니 치식 0개로 또 멈췄습니다(zzz 건).
  // ★★ 단, **다 나온 뒤 치운 것(done)은 남깁니다** (사용자 2026-10-23 "재출력 버튼이 없다").
  //   책갈피에서 치우면 상세에서도 사라져, 다시 뽑을 단추가 어디에도 없었습니다.
  if (!row || (row.dismissed_at && row.step !== 'done')) return null;
  return { id: row.id, designNote: row.design_note, dismissed: !!row.dismissed_at, ...asJob(row) };
}

/**
 * 주문이 들어오면 작업 한 줄을 엽니다.
 *
 * ★ 한 주문에 하나입니다 (표에 unique). 두 번 불러도 두 줄이 생기지 않습니다 —
 *   두 줄이 생기면 같은 것을 두 번 뽑습니다.
 */
export async function openAutoJob(
  orderId: string,
  clinicOrgId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const existing = await jobOfOrder(orderId);
  if (existing) return { ok: true, id: existing.id };

  const { data: printer } = await admin
    .from('clinic_printers')
    .select('id')
    .eq('clinic_org_id', clinicOrgId)
    .is('revoked_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin
    .from('auto_jobs')
    .insert({
      order_id: orderId,
      clinic_org_id: clinicOrgId,
      printer_id: (printer as { id: string } | null)?.id ?? null,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? '작업을 열지 못했습니다' };
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * 주문서에 맞춰 작업 줄을 열거나 닫습니다 — 주문을 넣거나 고칠 때 (2026-10-15).
 *
 * ★ FlowTemp 가 있으면 엽니다 (이미 있으면 그대로).
 * ★ 없어졌으면 **아직 디자인 차례일 때만** 닫습니다. 이미 잘랐거나 뽑는
 *   중인 것을 주문 고치기 하나로 지우면 프린터가 쥔 일이 허공에 뜹니다.
 * ★ 실패해도 주문은 이미 저장됐습니다 — 되돌리지 않고 로그만 남깁니다.
 *   STL 이 올라올 때 openAutoJob 이 한 번 더 엽니다.
 */
export async function syncAutoJob(orderId: string, clinicOrgId: string, autoTeeth: number[]): Promise<void> {
  try {
    if (autoTeeth.length > 0) {
      const opened = await openAutoJob(orderId, clinicOrgId);
      if (!opened.ok) console.error('[auto-print] 작업 줄을 못 열었습니다', opened.error);

      /*
        ★★ 주문을 고쳤으면 멈춰 있던 디자인을 **저절로 다시 겁니다** (사용자 2026-10-15
          — "센터가 왜 관여를 하는가"). 치식이 달라 멈춘 건을 치과가 고쳤는데,
          센터가 단추를 눌러야 다시 돌았습니다. 고친 사람이 곧 푼 사람입니다.
        ★ 덴트버드 건수는 내보낼 때만 씁니다. 멈춘 건은 내보내기 전이라 다시 돌려도
          손해가 없습니다.
      */
      const admin = createAdminClient();
      await admin
        .from('auto_jobs')
        .update({ design_stage: null, design_note: null, updated_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('step', 'waiting_design')
        .eq('design_stage', 'stalled');
      return;
    }
    const admin = createAdminClient();
    await admin.from('auto_jobs').delete().eq('order_id', orderId).eq('step', 'waiting_design');
  } catch (error) {
    console.error('[auto-print] 작업 줄 맞추기 실패', error);
  }
}

/**
 * 단계를 옮깁니다. **규칙에 없는 길이면 거절합니다.**
 *
 * ★ 건너뛰기를 여기서도 막습니다. 화면이나 에이전트가 잘못 불러도
 *   표에는 안 들어갑니다 — 표가 마지막 문지기입니다.
 */
export async function moveStep(
  jobId: string,
  to: AutoStep,
  extra: {
    percent?: number | null;
    reason?: string | null;
    deviceId?: string | null;
    printFilePath?: string;
    rotate?: { x: number; y: number; z: number };
  } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data } = await admin.from('auto_jobs').select(COLUMNS).eq('id', jobId).maybeSingle();
  const row = data as JobRow | null;
  if (!row) return { ok: false, error: '작업을 찾지 못했습니다' };

  /*
    ★★ **같은 단계라도 파일은 바꿔 줍니다** (2026-10-14 에 고침).
      전에는 여기서 그냥 돌아갔습니다 — '같은 말을 두 번 해도 탈이 없게'.
      그런데 이미 'queued' 인 주문에 **고쳐 자른 파일**을 올리면, 그 이른
      돌아감 때문에 print_file_path 가 **안 바뀌었습니다.** 새 파일을
      저장소에 올려 놓고 프린터에는 옛 파일을 보냈습니다 — 각도를 고쳐
      놓고도 틀린 각도로 뽑힐 뻔했고, 실제로 한 번 그랬습니다.
    ★ 되돌리는 것이 아닙니다. 같은 자리에서 **가리키는 것만** 바꿉니다.
  */
  if (row.step === to) {
    if (to !== 'queued' || (!extra.printFilePath && !extra.rotate)) return { ok: true };

    const same: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (extra.printFilePath) same.print_file_path = extra.printFilePath;
    if (extra.rotate) {
      same.rotate_x = extra.rotate.x;
      same.rotate_y = extra.rotate.y;
      same.rotate_z = extra.rotate.z;
    }
    const { error: e2 } = await admin.from('auto_jobs').update(same).eq('id', jobId);
    return e2 ? { ok: false, error: e2.message } : { ok: true };
  }
  if (!canMove(row.step, to)) {
    return { ok: false, error: `${row.step} 에서 ${to} 로는 갈 수 없습니다` };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { step: to, updated_at: now };

  // ★ 디자인 칸을 떠나면 잔걸음도 지웁니다 — 다음 칸에서 '설계 중' 이 남지 않게
  if (row.step === 'waiting_design' && to !== 'failed') {
    patch.design_stage = null;
    patch.design_note = null;
  }

  if (to === 'failed') {
    patch.failed_at = row.step;
    patch.failed_reason = (extra.reason ?? '').slice(0, 500) || null;
    patch.tries = row.tries + 1;
  } else {
    patch.failed_at = null;
    patch.failed_reason = null;
  }

  if (to === 'queued') {
    // 다시 자르기를 잡았던 표시(claimed_*) — 출력 대기로 넘어가면 지웁니다 (2026-10-23)
    patch.claimed_at = null;
    patch.claimed_device_id = null;
    if (extra.printFilePath) patch.print_file_path = extra.printFilePath;
    if (extra.rotate) {
      patch.rotate_x = extra.rotate.x;
      patch.rotate_y = extra.rotate.y;
      patch.rotate_z = extra.rotate.z;
    }
  }
  if (to === 'sending') {
    patch.claimed_at = now;
    patch.claimed_device_id = extra.deviceId ?? null;
  }
  if (to === 'printing') {
    patch.started_at = now;
    patch.percent = extra.percent ?? 0;
    patch.remaining_min = null;
  }
  if (to === 'done') {
    patch.finished_at = now;
    patch.percent = 100;
    patch.remaining_min = 0;
  }

  const { error } = await admin.from('auto_jobs').update(patch).eq('id', jobId);
  if (error) return { ok: false, error: error.message };

  /*
    ★ 치과가 손댈 일이 생겼으면 알립니다 (2026-10-15) — 출력판 비우기·꺼내기 둘뿐.
      **넘어간 뒤에** 부릅니다. 알림이 실패해도 단계는 그대로입니다.
  */
  const alert = alertOnMove(row.step, to);
  if (alert) await publishAutoAlert(row.order_id, alert, extra.reason ?? null);

  // ★ 임시치아만 있는 주문은 다 나오면 그 자리에서 완료 (과금 2안, 2026-10-21)
  if (to === 'done') await completeAutoOnlyOrder(admin, row.order_id);

  return { ok: true };
}

/**
 * 디자인 칸 안의 잔걸음을 적습니다 — 설계 PC 의 매크로가 부릅니다 (2026-10-15).
 *
 * ★ **디자인 칸에 있을 때만** 받습니다. 이미 잘라서 넘어간 주문에 늦게 온
 *   '설계 중' 이 덮이면 치과 화면이 뒤로 갑니다.
 * ★ 까닭(note)은 센터만 봅니다. 치과 화면에는 잔걸음 이름만 그립니다.
 */
export async function setDesignStage(
  orgId: string,
  orderId: string,
  stage: DesignStage,
  note: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from('organizations')
    .select('org_type')
    .eq('id', orgId)
    .maybeSingle();
  if ((org as { org_type?: string } | null)?.org_type !== 'design_center') {
    return { ok: false, error: '설계 PC 만 적을 수 있습니다' };
  }

  if (stage !== 'stalled') {
    const { data, error } = await admin
      .from('auto_jobs')
      .update({ design_stage: stage, design_note: null, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('step', 'waiting_design')
      .select('id');
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: '디자인 차례인 주문이 아닙니다' };
    return { ok: true };
  }

  /*
    ★★ 멈추면 **기계가 먼저 판정합니다** (사용자 결정 2026-10-21 — "센터에서 손이 안 갔으면").
      retry      일시적 — 5분 뒤 일꾼이 한 번 더 집어 갑니다 (claimNextDesign · canHandDesign)
      wait_scan  스캔 문제 — 치과에 알리고, 스캔을 다시 올리면 DB 트리거가 다시 엽니다
      give_up    자동으로 못 하는 건 — 포기: FlowTemp 줄을 빼고 치과에 '평소대로' 안내
      hold       장비·계정 문제 — 센터에 알림 (전처럼)
  */
  const { data: cur } = await admin
    .from('auto_jobs')
    .select('id, design_tries')
    .eq('order_id', orderId)
    .eq('step', 'waiting_design')
    .maybeSingle();
  const row = cur as { id: string; design_tries: number | null } | null;
  if (!row) return { ok: false, error: '디자인 차례인 주문이 아닙니다' };
  const tries = row.design_tries ?? 0;
  const clean = (note ?? '').slice(0, 500) || null;
  const verdict = designVerdict(clean, tries);
  const stamp = new Date().toISOString();

  if (verdict === 'give_up') {
    const { error } = await admin
      .from('auto_jobs')
      .update({ design_stage: 'ended', design_note: clean, design_wait: null, updated_at: stamp })
      .eq('id', row.id);
    if (error) return { ok: false, error: error.message };
    await removeAutoItems(admin, orderId);
    await publishAutoAlert(orderId, 'design_ended', endedMessage(clean));
    await publishDesignStreak(orderId);
    return { ok: true };
  }

  const patch: Record<string, unknown> = { design_stage: 'stalled', design_note: clean, updated_at: stamp };
  if (verdict === 'retry') patch.design_tries = tries + 1;
  if (verdict === 'wait_scan') patch.design_wait = 'scan';
  const { error } = await admin.from('auto_jobs').update(patch).eq('id', row.id);
  if (error) return { ok: false, error: error.message };

  if (verdict === 'wait_scan') await publishAutoAlert(orderId, 'design_scan', stallAdvice(clean).what);
  // ★ 센터에 알리는 건 센터만 고칠 수 있는 것뿐 (2026-10-16 점검 → 2026-10-21 좁힘)
  if (verdict === 'hold') await publishDesignStall(orderId, clean);
  return { ok: true };
}

/** 주문서에서 FlowTemp 줄을 뺍니다 — 그만두기·포기가 같이 씁니다. 어떤 줄이 FlowTemp 인지는 제품 표(auto_pipeline)가 말합니다 */
async function removeAutoItems(admin: ReturnType<typeof createAdminClient>, orderId: string): Promise<void> {
  const { data: types } = await admin.from('prosthesis_types').select('code').eq('auto_pipeline', true);
  const codes = (types ?? []).map((t: { code: string }) => t.code);
  if (codes.length === 0) return;
  const { data: items } = await admin.from('order_items').select('id, type_code').eq('order_id', orderId);
  const rows = (items ?? []) as { id: string; type_code: string }[];
  const autoRows = rows.filter((r) => codes.includes(r.type_code));
  if (autoRows.length === 0) return;
  /*
    ★★ **임시치아만 있는 주문은 줄을 빼지 않고 주문을 취소합니다** (2026-10-22, 시험 ORD-261022-001).
      과금 2안으로 FlowTemp 만 주문이 열리자, 포기 때 줄을 빼니 **항목이 하나도 없는 접수 주문**이
      남았습니다. 센터 목록에 빈 주문이 떠 있고 아무도 못 닫습니다. 만들 것도 받을 돈도 없으니
      취소가 맞습니다. 치과 안내('평소대로')는 그대로 갑니다.
  */
  if (autoRows.length === rows.length) {
    const { data: o } = await admin.from('orders').select('status').eq('id', orderId).maybeSingle();
    const from = (o as { status: string } | null)?.status ?? 'received';
    if (from === 'cancelled' || from === 'completed') return;
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    await admin.from('order_status_history').insert({
      order_id: orderId,
      from_status: from,
      to_status: 'cancelled',
      actor_org_id: null,
      actor_user_id: null,
      reason: '임시치아만 있는 주문 — 자동 설계를 못 해 취소',
    });
    return;
  }
  await admin.from('order_items').delete().eq('order_id', orderId).in('type_code', codes);
}

/**
 * 포기가 **잇따르면** 센터에 한 번 알립니다 (2026-10-21).
 *
 * ★ 건마다 알리지 않습니다 — 센터가 손댈 일이 아니라서요. 그런데 하루에 셋이 잇따라
 *   포기되면 그건 건이 아니라 장비·덴트버드 쪽이 아픈 것입니다. 그때만 알립니다.
 */
const STREAK_TO_ALERT = 3;
async function publishDesignStreak(orderId: string): Promise<void> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await admin
    .from('auto_jobs')
    .select('design_stage')
    .eq('step', 'waiting_design')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(STREAK_TO_ALERT);
  const recent = (data ?? []) as { design_stage: string | null }[];
  if (recent.length < STREAK_TO_ALERT || !recent.every((r) => r.design_stage === 'ended')) return;
  await publishDesignStall(orderId, `자동 설계 포기가 ${STREAK_TO_ALERT}건째 잇따릅니다 — 설계 PC·덴트버드를 봐 주세요`);
}

/**
 * 같은 디자인을 다시 뽑습니다 — '다 나옴' → '출력 대기' (사용자 요청 2026-10-15).
 *
 * ★ 출력 파일을 그대로 씁니다. 자르기·설계를 다시 안 하므로 덴트버드 건수도
 *   안 씁니다. 출력판 확인 도장을 지워서 **비웠는지부터 다시 묻습니다** —
 *   방금 나온 것이 판 위에 있을 수 있습니다.
 * ★ moveStep 을 안 거칩니다. done 에서 나가는 길은 이것 하나뿐이고, 치과가
 *   방금 스스로 누른 것이라 '출력판을 비워 주세요' 알림을 또 보낼 까닭이
 *   없습니다. (화면 신호는 표 트리거가 쏩니다)
 * ★ 몇 번째인지 domain_events 에 남깁니다 — 자꾸 다시 뽑으면 디자인 문제입니다.
 * ★ 책갈피에서 치웠던 것이면 다시 보이게 합니다.
 */
export async function reprintJob(
  orderId: string,
  actor: { orgId: string | null; userId: string },
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const admin = createAdminClient();

  /*
    ★★ 'queued' 가 아니라 **'slicing'(출력 준비)** 으로 돌립니다 (사용자 2026-10-23
      "다시 뽑을 때도 자리 바꿔서"). 출력 파일에는 판 위 자리가 박혀 있어서, 그대로
      다시 보내면 늘 같은 자리·같은 퍼지 줄입니다. 서버 PC 의 임시치아 지켜보기가
      놓인 STL 을 받아 다음 자리로 다시 잘라 올립니다(claimNextReslice).
    ★ print_file_path 는 **남깁니다** — 서버 PC 가 3분 안에 안 잡거나 6분 안에 못
      끝내면 그 옛 파일로 출력합니다(promoteStaleReslices). 자리만 같을 뿐 멈추지 않습니다.
  */
  const { data, error } = await admin
    .from('auto_jobs')
    .update({
      step: 'slicing',
      bed_cleared_at: null,
      bed_cleared_by: null,
      claimed_at: null,
      claimed_device_id: null,
      started_at: null,
      finished_at: null,
      percent: null,
      tries: 0,
      failed_at: null,
      failed_reason: null,
      dismissed_at: null,
      dismissed_by: null,
      remaining_min: null,
      layer_now: null,
      layer_total: null,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .eq('step', 'done')
    .not('print_file_path', 'is', null)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: '다 나온 것만 다시 뽑을 수 있습니다' };

  await admin.from('domain_events').insert({
    event_type: 'order.auto_print.reprint',
    aggregate_type: 'order',
    aggregate_id: orderId,
    actor_org_id: actor.orgId,
    actor_user_id: actor.userId,
    payload: {},
  });

  const { count } = await admin
    .from('domain_events')
    .select('id', { count: 'exact', head: true })
    .eq('aggregate_id', orderId)
    .eq('event_type', 'order.auto_print.reprint');

  return { ok: true, count: count ?? 1 };
}

/**
 * 다 나온 건을 책갈피에서 치웁니다 (사용자 요청 2026-10-15).
 *
 * ★ **출력 완료만.** 오류·진행 중을 치우면 치과가 놓친 일을 아무도 모릅니다.
 * ★ 작업 기록은 그대로 — dismissed_at 도장만 찍습니다.
 */
export async function dismissJob(
  orderId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  // ★ 다 나온 것·멈춘 것·실패한 것 (domain canDismiss, 2026-10-19). 돌고 있는 것은 못 치웁니다
  const { data: row } = await admin
    .from('auto_jobs')
    .select('id, step, design_stage')
    .eq('order_id', orderId)
    .is('dismissed_at', null)
    .maybeSingle();
  if (!row) return { ok: false, error: '치울 FlowTemp 가 없습니다' };
  const ok = canDismiss({ step: row.step, designStage: row.design_stage } as Parameters<typeof canDismiss>[0]);
  if (!ok) return { ok: false, error: '돌고 있는 중에는 치울 수 없습니다 — 끝나거나 멈춘 뒤에 치워 주세요' };

  const { error } = await admin
    .from('auto_jobs')
    .update({ dismissed_at: new Date().toISOString(), dismissed_by: userId })
    .eq('id', row.id);
  if (error) return { ok: false, error: error.message };

  /*
    ★ 그만두면 **주문서에서도 FlowTemp 줄을 뺍니다** (사용자 2026-10-19 "그만두면 주문서에서 빼줘").
      멈춘 것·실패한 것만 — 다 나온 것(done)은 치과가 받은 물건이라 줄을 남깁니다.
      크라운 줄은 그대로입니다. 어떤 줄이 FlowTemp 인지는 제품 표의 auto_pipeline 이 말합니다.
  */
  if (row.step !== 'done') await removeAutoItems(admin, orderId);
  return { ok: true };
}

/**
 * 일꾼이 잡은 일감을 **내려놓습니다** — 잠깐의 네트워크 끊김 따위로 (2026-10-16 점검).
 *
 * ★ 전에는 스캔을 받다 끊기기만 해도 '확인 중' 으로 세워, 사람이 다시 걸 때까지
 *   멈춰 있었습니다. 다시 하면 되는 일입니다. 내려놓으면 다음 바퀴에 다시 잡습니다.
 * ★ '마무리'(내보냄)·'확인 중' 은 못 내려놓습니다 — 앞엣것은 건수를 또 쓰고,
 *   뒤엣것은 사람이 볼 차례입니다.
 */
export async function releaseDesign(
  orgId: string,
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: org } = await admin.from('organizations').select('org_type').eq('id', orgId).maybeSingle();
  if ((org as { org_type?: string } | null)?.org_type !== 'design_center') {
    return { ok: false, error: '설계 PC 만 내려놓을 수 있습니다' };
  }
  const { error } = await admin
    .from('auto_jobs')
    .update({ design_stage: null, design_note: null, updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('step', 'waiting_design')
    .in('design_stage', ['uploading', 'analyzing', 'generating']);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** 출력 중 숫자만 올립니다. 단계는 그대로 */
export async function reportPercent(jobId: string, percent: number): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('auto_jobs')
    .update({
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('step', 'printing');
}

/**
 * 치과가 출력판을 비웠다고 누릅니다.
 *
 * ★ 이 도장이 찍히기 전에는 치과 PC 가 집어가지 않습니다.
 *   치과에는 기공사가 없습니다 — 전 출력물 위에 덮어 뽑는 일을 막는
 *   유일한 잠금입니다.
 */
export async function clearBed(
  orderId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data } = await admin.from('auto_jobs').select(COLUMNS).eq('order_id', orderId).maybeSingle();
  const row = data as JobRow | null;
  if (!row) return { ok: false, error: '자동 진행 중인 주문이 아닙니다' };
  if (row.bed_cleared_at) return { ok: true };
  // ★ 다시 뽑기(2026-10-23)·디자인 중(2026-10-26)에도 미리 눌러 둡니다 — 규칙은 canClearBed 한 곳
  if (!canClearBed(asJob(row))) return { ok: false, error: '지금은 출력판 확인을 받을 때가 아닙니다' };

  const { error } = await admin
    .from('auto_jobs')
    .update({
      bed_cleared_at: new Date().toISOString(),
      bed_cleared_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * 이 치과에 **곧 출력할 것**이 있는가 (2026-10-23 미리 데우기).
 *
 * ★ 덴트버드 설계가 돌기 시작한 때부터(업로드·분석·생성·내보내기), 다시 자르는 중,
 *   출력판 확인을 기다리는 중 — 이때부터 판을 데우면 출력이 시작될 때 이미 55도입니다.
 *   설계 2~3분이면 판이 충분히 데워집니다.
 * ★ 멈춘 설계(stalled·ended)·그만둔 건은 빼야 쓸데없이 데우지 않습니다.
 */
export async function warmSoon(clinicOrgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('auto_jobs')
    .select('step, design_stage')
    .eq('clinic_org_id', clinicOrgId)
    .is('dismissed_at', null)
    .in('step', ['waiting_design', 'slicing', 'queued'])
    .limit(20);
  return ((data ?? []) as { step: string; design_stage: string | null }[]).some((j) =>
    j.step === 'waiting_design' ? WARM_DESIGN_STAGES.includes(j.design_stage ?? '') : true,
  );
}

/** 이 치과의 최근 실제 출력 시간(초) — 준비 구간 남은 시간용 (2026-10-23) */
export async function clinicTypicalPrintSeconds(clinicOrgId: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('auto_jobs')
    .select('started_at, finished_at')
    .eq('clinic_org_id', clinicOrgId)
    .eq('step', 'done')
    .not('started_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(5);
  return typicalPrintSeconds(
    ((data ?? []) as { started_at: string | null; finished_at: string | null }[]).map((r) => ({
      startedAt: r.started_at,
      finishedAt: r.finished_at,
    })),
  );
}

/** 설계가 실제로 돌고 있는 칸 — 이때부터 데웁니다 */
const WARM_DESIGN_STAGES = ['uploading', 'analyzing', 'generating', 'exporting'];

export interface ClaimedJob {
  jobId: string;
  orderId: string;
  /** 치과 PC 가 바로 내려받는 주소. 우리 서버를 지나가지 않습니다 */
  downloadUrl: string;
  fileName: string;
  /**
   * ★ 이 기기가 이미 집어 가 **보내는 중·출력 중**이던 것 (2026-10-23). 에이전트가 업데이트·재부팅으로
   *   다시 켜졌을 때 옛 출력을 이어서 지켜보라는 뜻 — 내려받기·올리기·출력 명령 없이 프린터만 봅니다.
   */
  resume?: 'sending' | 'printing';
}

/**
 * 치과 PC 가 할 일을 가져갑니다.
 *
 * ★ 가져가는 **그 순간** 단계를 `sending` 으로 옮깁니다. 안 그러면 PC 가
 *   둘일 때 같은 것을 둘 다 집어 두 번 뽑습니다.
 * ★ 한 번에 하나만 줍니다. 프린터는 한 번에 하나만 뽑습니다.
 */
export async function claimPrintJob(
  device: LinkedDevice,
): Promise<{ ok: true; job: ClaimedJob | null; warm?: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();

  await promoteStaleReslices(device.clinicOrgId);

  // ★ 곧 뽑을 것이 있으면 판을 미리 데우라고 알립니다 (사용자 2026-10-23 "미리 데우기도 넣어줘").
  //   넘겨줄 일감이 없을 때만 붙입니다 — 넘겨주면 에이전트가 어차피 올리면서 데웁니다.
  const idle = async () => ({ ok: true as const, job: null, warm: await warmSoon(device.clinicOrgId) });

  /*
    ★★ **하던 출력부터** (사용자 2026-10-23 — 출력 중 에이전트를 업데이트했더니 프린터는 다 뽑았는데
      덴플로우는 53% 에 멈춤). 에이전트는 한 번에 하나만 하므로, 이 기기가 집어 간 '보내는 중·출력 중'
      이 남아 있으면 그건 **에이전트가 다시 켜져 놓친 것**입니다. 그것을 먼저 돌려줘 이어서 지켜보게 합니다.
      다른 기기 것은 건드리지 않습니다.
  */
  const { data: mine } = await admin
    .from('auto_jobs')
    .select('id, order_id, step, print_file_path, claimed_at')
    .eq('clinic_org_id', device.clinicOrgId)
    .eq('claimed_device_id', device.id)
    .in('step', ['sending', 'printing'])
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const inflightRow = mine as { id: string; order_id: string; step: 'sending' | 'printing'; print_file_path: string | null; claimed_at: string | null } | null;
  /*
    ★ 방금 집어 간 것은 '놓친 것' 이 아닙니다 (2026-10-27, ORD-261027-001). 같은 기기가 집어 가고 8초 뒤에
      또 물었는데(에이전트 안에 출력 루프가 둘 뜬 사고) 이어서 보기를 내줘, 아직 보내는 중인 것을 '확인 못 함'
      으로 실패 처리했습니다. 집어 간 지 RESUME_AFTER_SECONDS 가 안 됐으면 그 에이전트가 아직 보내는 중인
      것으로 보고 아무것도 안 줍니다.
  */
  const claimedAgo = inflightRow?.claimed_at ? (Date.now() - new Date(inflightRow.claimed_at).getTime()) / 1000 : Infinity;
  if (inflightRow && claimedAgo < RESUME_AFTER_SECONDS) return idle();
  const inflight = inflightRow;
  // 이어서 지켜보기를 아는 판(1.3.15+)에게만 — 옛 판은 내려받을 주소가 비어 실패로 끝냅니다
  let canResume = false;
  if (inflight?.print_file_path) {
    const { data: dev } = await admin.from('clinic_devices').select('agent_version').eq('id', device.id).maybeSingle();
    const v = (dev as { agent_version: string | null } | null)?.agent_version ?? null;
    canResume = !!v && !olderThan(v, RESUME_SINCE);
  }
  if (inflight?.print_file_path && canResume) {
    return {
      ok: true,
      job: {
        jobId: inflight.id,
        orderId: inflight.order_id,
        downloadUrl: '',
        fileName: inflight.print_file_path.split('/').pop() ?? 'print.gcode.3mf',
        resume: inflight.step,
      },
    };
  }

  const { data } = await admin
    .from('auto_jobs')
    .select(COLUMNS)
    .eq('clinic_org_id', device.clinicOrgId)
    .eq('step', 'queued')
    .not('bed_cleared_at', 'is', null)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  const row = data as JobRow | null;
  if (!row) return idle();
  if (!claimable(asJob(row))) return idle();
  if (!row.print_file_path) return { ok: false, error: '출력 파일이 없습니다' };

  /*
    ★★ 「비웠습니다」 **뒤에 다른 것이 나왔으면** 그 확인은 낡았습니다 (2026-10-26 겹침 시험).
      미리 누르기가 생기면서 둘을 다 눌러 두면, 앞 건이 다 나온 판 위에 뒷 건이 바로
      뽑혔습니다. 마지막으로 끝난(또는 출력 중 멈춘) 때보다 먼저 누른 것은 지우고
      치과가 다시 누르게 합니다.
  */
  // ★ failed_at 은 시각이 아니라 **멈춘 단계** 입니다 — 출력 중 멈춘 건은 updated_at 을 끝난 때로 봅니다
  const { data: lastOut } = await admin
    .from('auto_jobs')
    .select('finished_at, failed_at, updated_at')
    .eq('clinic_org_id', device.clinicOrgId)
    .neq('id', row.id)
    .or('finished_at.not.is.null,failed_at.eq.printing')
    .order('updated_at', { ascending: false })
    .limit(20);
  const lastEnd = ((lastOut ?? []) as { finished_at: string | null; failed_at: string | null; updated_at: string }[])
    .map((r) => r.finished_at ?? (r.failed_at === 'printing' ? r.updated_at : null))
    .filter((t): t is string => !!t)
    .reduce((a, b) => (new Date(a) > new Date(b) ? a : b), '');
  if (lastEnd && row.bed_cleared_at && new Date(row.bed_cleared_at) < new Date(lastEnd)) {
    await admin
      .from('auto_jobs')
      .update({ bed_cleared_at: null, bed_cleared_by: null, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    return idle();
  }

  /*
    ★★ **집어가는 것은 한 번만 됩니다.** 전에는 moveStep 을 거쳤는데, 그 안에
      "이미 그 단계면 그냥 ok" 하는 길이 있어서 **둘이 동시에 물어보면 둘 다
      가져갔습니다.** 치과 PC 에 에이전트가 두 번 떠 있거나, 치과가 PC 를
      두 대 연결해 두면 **같은 것을 두 번 뽑습니다.**
      (사용자 물음 2026-10-07 — "중복으로 실행이 되는게 문제가 안될까?")

    ★ 그래서 **'queued' 인 줄만** 골라 한 번에 바꿉니다. DB 가 한 줄만
      바꿔 주므로 늦게 온 쪽은 0줄을 받고 조용히 물러납니다.
  */
  const now = new Date().toISOString();
  const { data: taken, error: takeError } = await admin
    .from('auto_jobs')
    .update({
      step: 'sending',
      claimed_at: now,
      claimed_device_id: device.id,
      updated_at: now,
      failed_at: null,
      failed_reason: null,
    })
    .eq('id', row.id)
    .eq('step', 'queued')
    .not('bed_cleared_at', 'is', null)
    .select('id');

  if (takeError) return { ok: false, error: takeError.message };
  // 누가 먼저 가져갔습니다. 다음 번에 다시 물어보면 됩니다
  if (!taken || taken.length === 0) return { ok: true, job: null };

  const signed = await admin.storage.from(BUCKET).createSignedUrl(row.print_file_path, DOWNLOAD_TTL);
  if (signed.error || !signed.data) {
    await moveStep(row.id, 'failed', { reason: '내려받을 주소를 만들지 못했습니다' });
    return { ok: false, error: '내려받을 주소를 만들지 못했습니다' };
  }

  await admin
    .from('clinic_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', device.id);

  return {
    ok: true,
    job: {
      jobId: row.id,
      orderId: row.order_id,
      downloadUrl: signed.data.signedUrl,
      fileName: row.print_file_path.split('/').pop() ?? 'print.gcode.3mf',
    },
  };
}

/**
 * 치과 PC 가 결과를 알립니다.
 *
 * ★ **자기 치과 작업인지 확인합니다.** 열쇠만 있으면 남의 치과 작업을
 *   건드릴 수 있어서는 안 됩니다.
 */
export async function reportPrintJob(
  device: LinkedDevice,
  jobId: string,
  body: {
    step?: unknown;
    percent?: unknown;
    reason?: unknown;
    remaining?: unknown;
    layer?: unknown;
    layers?: unknown;
    /** 일시 정지 까닭 (2026-10-23) — 있으면 '일시 정지' 로 표시하고 치과에 알림 */
    paused?: unknown;
    /** 일시 정지가 풀려 다시 뽑는 중 */
    resumed?: unknown;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('auto_jobs')
    .select('id, clinic_org_id, step, order_id, failed_reason')
    .eq('id', jobId)
    .maybeSingle();

  const row = data as
    | { id: string; clinic_org_id: string; step: AutoStep; order_id: string; failed_reason: string | null }
    | null;
  if (!row || row.clinic_org_id !== device.clinicOrgId) {
    return { ok: false, error: '작업을 찾지 못했습니다' };
  }

  const percent = typeof body.percent === 'number' ? body.percent : null;

  /*
    ★ 남은 시간·층 (2026-10-15). **따로** 적고 실패는 삼킵니다 — 이 덤이
      안 써져도 퍼센트·단계 보고는 멀쩡해야 합니다.
  */
  const whole = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  const extras: Record<string, number> = {};
  const rem = whole(body.remaining);
  const layer = whole(body.layer);
  const layers = whole(body.layers);
  if (rem !== null) extras.remaining_min = rem;
  if (layer !== null) extras.layer_now = layer;
  if (layers !== null && layers > 0) extras.layer_total = layers;

  const writeExtras = async () => {
    if (Object.keys(extras).length === 0) return;
    const { error } = await admin.from('auto_jobs').update(extras).eq('id', jobId).eq('step', 'printing');
    if (error) console.error('[auto-print] 남은 시간을 못 적었습니다', error.message);
  };

  /*
    ★ 일시 정지·이어서 (2026-10-23). 단계는 '출력 중' 그대로 — 실패가 아닙니다.
      처음 멈춘 순간에만 치과에 알립니다(에이전트는 5분마다 같은 말을 다시 보내 소식을 잇습니다).
  */
  if (!body.step && typeof body.paused === 'string' && body.paused.trim()) {
    if (row.step !== 'printing') return { ok: true };
    const first = !(row.failed_reason ?? '').startsWith(PAUSE_MARK);
    const { error } = await admin
      .from('auto_jobs')
      .update({ failed_reason: (PAUSE_MARK + body.paused.trim()).slice(0, 500), updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('step', 'printing');
    if (error) return { ok: false, error: error.message };
    if (percent !== null) await reportPercent(jobId, percent);
    await writeExtras();
    if (first) await publishAutoAlert(row.order_id, 'paused', body.paused.trim());
    return { ok: true };
  }
  if (!body.step && body.resumed === true) {
    if (row.step === 'printing' && (row.failed_reason ?? '').startsWith(PAUSE_MARK)) {
      await admin
        .from('auto_jobs')
        .update({ failed_reason: null, updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('step', 'printing');
    }
    if (percent !== null) await reportPercent(jobId, percent);
    await writeExtras();
    return { ok: true };
  }

  // 숫자만 올리는 것은 단계를 안 건드립니다
  if (!body.step && percent !== null) {
    await reportPercent(jobId, percent);
    await writeExtras();
    return { ok: true };
  }

  if (!isAutoStep(body.step)) return { ok: false, error: 'step 이 올바르지 않습니다' };

  // ★ 치과 PC 가 옮길 수 있는 자리는 셋뿐입니다. 'queued' 로 되돌리거나
  //   'slicing' 으로 가는 것은 치과 PC 가 할 일이 아닙니다.
  const allowed: AutoStep[] = ['printing', 'done', 'failed'];
  if (!allowed.includes(body.step)) return { ok: false, error: '그 단계는 보낼 수 없습니다' };

  const moved = await moveStep(jobId, body.step, {
    percent,
    reason: typeof body.reason === 'string' ? body.reason : null,
  });
  if (moved.ok && body.step === 'printing') await writeExtras();
  return moved;
}

// ---------------------------------------------------------------- 결과 붙이기

/** 기공소 PC 가 올릴 것 — 출력 파일 · 디자인 STL · 놓인 모습 그림 */
export interface DeliverSlot {
  role: 'print' | 'design' | 'preview';
  name: string;
  path: string;
  token: string;
}

const ROLE_EXT: Record<DeliverSlot['role'], string> = {
  print: '.gcode.3mf',
  design: '.stl',
  preview: '.png',
};

/**
 * 올릴 자리를 엽니다.
 *
 * ★ 파일은 우리 서버를 안 지나갑니다 — 저장소 서명 주소로 바로 올립니다.
 *   스캔 받을 때와 같은 길입니다.
 */
export async function openDeliverSlots(
  orderId: string,
  body: { files?: unknown; teeth?: unknown },
): Promise<{ ok: true; slots: DeliverSlot[]; bucket: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('id, clinic_org_id, order_items(tooth_number)')
    .eq('id', orderId)
    .maybeSingle();
  const found = order as
    | { id: string; clinic_org_id: string; order_items: { tooth_number: number }[] | null }
    | null;
  if (!found) return { ok: false, error: '주문을 찾지 못했습니다' };

  /*
    ★★ **올리기 전에** 치식을 견줍니다. 덴트버드가 치식을 알아서 잡는데,
      틀렸을 때 아무도 모르는 것이 위험합니다 — 엉뚱한 이의 크라운이 치과에서
      그대로 출력됩니다. 디자인 쪽 치식은 `.constructionInfo` 에 적혀 옵니다.
    ★ 1MB 를 올린 뒤에 막으면 올린 것이 저장소에 남습니다. 자리를 내주기
      전에 봅니다.
  */
  const designTeeth = Array.isArray(body.teeth)
    ? body.teeth.filter((t): t is number => Number.isInteger(t))
    : [];
  const why = teethMismatch(
    (found.order_items ?? []).map((i) => i.tooth_number).filter((n) => Number.isInteger(n)),
    designTeeth,
  );
  if (why) return { ok: false, error: why };

  const opened = await openAutoJob(orderId, found.clinic_org_id);
  if (!opened.ok) return { ok: false, error: opened.error };

  const wanted = Array.isArray(body.files) ? body.files : [];
  const roles = wanted
    .map((f) => (f as { role?: unknown })?.role)
    .filter((r): r is DeliverSlot['role'] => r === 'print' || r === 'design' || r === 'preview');

  if (!roles.includes('print')) return { ok: false, error: '출력 파일이 없습니다' };

  const slots: DeliverSlot[] = [];
  for (const role of roles) {
    const path = `orders/${orderId}/${crypto.randomUUID()}_auto${ROLE_EXT[role]}`;
    const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signed.error || !signed.data) return { ok: false, error: '올릴 주소를 못 받았습니다' };

    const names: Record<DeliverSlot['role'], string> = {
      print: '자동출력.gcode.3mf',
      design: '자동디자인.stl',
      preview: '놓인모습.png',
    };
    slots.push({ role, name: names[role], path, token: signed.data.token });
  }

  return { ok: true, slots, bucket: BUCKET };
}

/**
 * 다 올렸다고 알립니다 → 작업이 '출력 대기' 로 갑니다.
 *
 * ★ **저장소에 진짜로 있는지 먼저 봅니다.** 없는 것을 가리키는 줄을
 *   주문에 붙이면, 치과가 눌렀을 때 그제야 빈손인 것을 압니다.
 * ★ 디자인 STL 과 그림은 **기록**이라 `order_files` 에 남기고,
 *   출력 파일은 작업 줄이 가리킵니다 (치과가 받아 갈 것).
 */
export async function finishDeliver(
  orderId: string,
  body: { files?: unknown; rotate?: unknown; facts?: unknown },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const files = Array.isArray(body.files) ? body.files : [];
  const byRole = new Map<string, { path: string; name?: string; size?: number }>();
  for (const f of files) {
    const row = f as { role?: unknown; path?: unknown; name?: unknown; size?: unknown };
    if (typeof row.role === 'string' && typeof row.path === 'string') {
      byRole.set(row.role, {
        path: row.path,
        name: typeof row.name === 'string' ? row.name : undefined,
        size: typeof row.size === 'number' ? row.size : undefined,
      });
    }
  }

  const print = byRole.get('print');
  if (!print) return { ok: false, error: '출력 파일이 없습니다' };

  // 저장소에 실제로 있는지 — 없는 것을 가리키지 않습니다
  for (const [role, f] of byRole) {
    const dir = f.path.slice(0, f.path.lastIndexOf('/'));
    const name = f.path.slice(f.path.lastIndexOf('/') + 1);
    const { data } = await admin.storage.from(BUCKET).list(dir, { search: name });
    if (!data?.some((o) => o.name === name)) {
      return { ok: false, error: `${role} 파일이 저장소에 없습니다` };
    }
  }

  const job = await jobOfOrder(orderId);
  if (!job) return { ok: false, error: '자동 진행 중인 주문이 아닙니다' };

  /*
    기록으로 남길 것 — 디자인 STL 과 놓인 모습.

    ★★ FlowTemp STL 은 **'design' 이 아니라 'etc'** 로 남깁니다 (2026-10-15).
      FlowTemp 는 이제 최종 크라운과 **같은 주문**에 들어옵니다(과금 1안).
      'design' 으로 두면 두 가지가 틀어집니다.
        ① 크라운 디자인을 안 올렸는데도 '디자인 파일 있음' 으로 세어
           제작대기로 넘어갑니다 (requiresDesignFile).
        ② 기공소가 디자인 파일을 받을 때 **임시치아 STL 이 같이 가서**
           그걸로 최종 크라운을 깎을 수 있습니다.
      'etc' 의 stl 은 기공소가 못 엽니다(file-access) — 임시치아는 치과
      프린터가 뽑으니 기공소엔 필요 없습니다.
  */
  const keep: Array<{ role: string; kind: string }> = [
    { role: 'design', kind: 'etc' },
    { role: 'preview', kind: 'photo' },
  ];
  const rows = keep
    .map(({ role, kind }) => {
      const f = byRole.get(role);
      return f
        ? {
            order_id: orderId,
            kind,
            storage_path: f.path,
            file_name: f.name ?? f.path.split('/').pop(),
            file_size: f.size ?? null,
            mime_type: null,
            upload_status: 'uploaded',
          }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length) {
    const { error } = await admin.from('order_files').insert(rows);
    if (error) return { ok: false, error: `기록을 남기지 못했습니다: ${error.message}` };
  }

  const r = (body.rotate ?? {}) as { x?: unknown; y?: unknown; z?: unknown };
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);

  // waiting_design → slicing → queued. 건너뛰지 않습니다
  if (job.step === 'waiting_design') {
    const moved = await moveStep(job.id, 'slicing');
    if (!moved.ok) return moved;
  }

  return moveStep(job.id, 'queued', {
    printFilePath: print.path,
    // ★ 다시 자르기는 각도를 안 보냅니다 — 0 으로 덮지 않게 (2026-10-23)
    ...(body.rotate ? { rotate: { x: num(r.x), y: num(r.y), z: num(r.z) } } : {}),
  });
}

/**
 * 멈춘 작업을 **다시 겁니다** (2026-10-12).
 *
 * ★★ 전에는 실패하면 **거기서 끝이었습니다.** retryTo 는 도메인에 있었는데
 *   아무도 부르지 않았고, 표도 failed 에서 나가는 길을 막아 두었습니다
 *   (`failed: []`). 프린터에 필라멘트가 떨어지기만 해도 그 주문은 영영
 *   자동 출력으로 못 돌아왔습니다 — 실제로 그래서 막혔습니다.
 *
 * ★ **베드 비움을 같이 지웁니다.** 실패한 판 위에 무엇이 남아 있는지
 *   아무도 모릅니다. 다시 한 번 사람이 보고 눌러야 합니다.
 *
 * ★ 횟수를 0 으로 되돌립니다. 사람이 손을 봐서 다시 거는 것이라,
 *   자동 재시도도 처음부터 다시 셀 자격이 있습니다.
 */
export async function retryJob(
  orderId: string,
): Promise<{ ok: true; step: AutoStep } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data } = await admin.from('auto_jobs').select(COLUMNS).eq('order_id', orderId).maybeSingle();
  const row = data as JobRow | null;
  if (!row) return { ok: false, error: '자동 진행 중인 주문이 아닙니다' };
  // ★ 그만둔 건은 주문서에서 FlowTemp 줄이 빠져 있어 다시 걸어도 치식이 없습니다 (2026-10-21)
  if (row.dismissed_at) {
    return { ok: false, error: 'FlowTemp 를 그만둔 건입니다 — 주문서에 FlowTemp 를 다시 넣으면 새로 시작합니다' };
  }

  /*
    ★ 디자인이 멈춘 것(확인 중)도 다시 겁니다 (2026-10-15). 단계는 그대로
      '디자인' 이라 잔걸음만 지우면 설계 일꾼이 다시 가져갑니다.
  */
  if (row.step === 'waiting_design' && row.design_stage === 'ended') {
    return { ok: false, error: '자동 설계를 접은 건입니다 — 주문서에 FlowTemp 를 다시 넣으면 새로 시작합니다' };
  }
  if (row.step === 'waiting_design' && row.design_stage === 'stalled') {
    const { error } = await admin
      .from('auto_jobs')
      .update({ design_stage: null, design_note: null, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('design_stage', 'stalled');
    return error ? { ok: false, error: error.message } : { ok: true, step: 'waiting_design' };
  }

  const back = retryTo(asJob(row));
  if (!back) return { ok: false, error: '다시 걸 수 있는 상태가 아닙니다' };

  const { error } = await admin
    .from('auto_jobs')
    .update({
      step: back,
      failed_at: null,
      failed_reason: null,
      tries: 0,
      bed_cleared_at: null,
      bed_cleared_by: null,
      claimed_at: null,
      claimed_device_id: null,
      percent: null,
      design_stage: null,
      design_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('step', 'failed');

  return error ? { ok: false, error: error.message } : { ok: true, step: back };
}

/**
 * 폴더에 떨어진 크라운이 어느 주문 것인가 (2026-10-14).
 *
 * ★★ **마지막 사람 손을 없애는 자리입니다.** 덴트버드에서 받은 STL 을
 *   사람이 창에서 골라 줘야 했습니다 — 다른 데는 다 자동인데 그 한 번
 *   때문에 사람이 PC 앞에 있어야 했습니다.
 * ★ 고르는 재료는 **치식**입니다. 덴트버드가 `.constructionInfo` 에 적어
 *   주고, 이미 그 값으로 주문서와 대조하고 있습니다. 같은 재료를 막는 데
 *   말고 **찾는 데**도 씁니다.
 * ★ 디자인센터 기기만. 고르는 규칙은 domain/auto-print 의 matchWaiting —
 *   애매하면 안 고르고 까닭을 돌려줍니다.
 */
export async function matchWaitingJob(
  orgId: string,
  designTeeth: number[],
  /**
   * 설계 일꾼이 붙여 준 이름표 (2026-10-16 점검). 있으면 **그 주문만** 봅니다 —
   * 같은 치식으로 기다리는 주문이 둘이어도 헷갈리지 않습니다. 치식은 그래도 견줍니다.
   */
  expectedOrderId?: string | null,
): Promise<{ ok: true; orderId: string; token: string } | { ok: false; error: string }> {
  const { matchWaiting } = await import('@/server/domain/auto-print');
  const { issueExocadToken } = await import('@/server/exocad/token');

  const admin = createAdminClient();

  const { data: org } = await admin
    .from('organizations')
    .select('org_type')
    .eq('id', orgId)
    .maybeSingle();
  if ((org as { org_type?: string } | null)?.org_type !== 'design_center') {
    return { ok: false, error: '설계 PC 만 물어볼 수 있습니다' };
  }

  /*
    ★★ **작업 줄을 보면 안 됩니다** (2026-10-14 에 고침). `auto_jobs` 는
      파일을 **올릴 때** 생깁니다(openDeliverSlots). 그러니 'waiting_design'
      으로 기다리는 줄은 **영영 없습니다** — 처음 쓴 조회는 늘 빈손이었고,
      실제로 "치식 27 로 기다리는 주문이 없습니다" 만 돌려줬습니다.
      기다리는 것은 작업이 아니라 **주문**입니다.
    ★ 아직 안 보낸 주문만 봅니다 — 줄이 없거나, 있어도 설계를 기다리거나
      실패한 것. 이미 자른 주문에 두 번째 크라운이 떨어져도 다시 안 보냅니다.
  */
  const { data, error } = await admin
    .from('orders')
    .select('id, order_items(tooth_number, type_code), auto_jobs(step)')
    .is('deleted_at', null)
    .not('status', 'in', '(completed,cancelled)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { ok: false, error: error.message };

  type Job = { step: string };
  type Row = {
    id: string;
    order_items: { tooth_number: number; type_code: string }[] | null;
    /**
     * ★★★ **배열이 아니라 객체로 옵니다.** auto_jobs 는 order_id 가 unique 라
     *   PostgREST 가 '하나짜리 관계' 로 보고 `{step:'done'}` 을 줍니다 —
     *   `[{step:'done'}]` 이 아닙니다. 전에는 `(r.auto_jobs ?? [])[0]` 로
     *   꺼냈는데 그러면 **언제나 undefined** 라, **이미 뽑은 주문까지**
     *   '기다리는 중' 으로 잡혔습니다. 같은 치식 크라운이 떨어지면 끝난
     *   주문에 다시 걸려 두 번 뽑힙니다. 둘 다 받아 둡니다.
     */
    auto_jobs: Job | Job[] | null;
  };

  const stepOf = (j: Row['auto_jobs']): string | undefined =>
    Array.isArray(j) ? j[0]?.step : (j?.step ?? undefined);

  /**
   * 아직 **뽑히지 않은** 것으로 보는 단계.
   *
   * ★★ `queued` 도 넣습니다 (2026-10-14). 잘라서 올려 뒀지만 아직 프린터로
   *   안 간 상태입니다. 같은 주문에 **고쳐 자른 파일**이 떨어지면 그것으로
   *   바꿔 줘야 합니다 — 실제로 각도를 잘못 넣어 자른 판을 되돌릴 길이
   *   없었습니다. 덮어써도 잃는 것이 없습니다(아직 안 뽑았으니까요).
   * ★ `sending`·`printing` 은 **안 넣습니다.** 이미 프린터가 쥐고 있어서,
   *   그때 바꾸면 도는 것과 적힌 것이 달라집니다.
   */
  const WAITING = ['waiting_design', 'queued', 'failed'];

  const jobs = ((data ?? []) as unknown as Row[])
    .filter((r) => (r.order_items ?? []).some((i) => i.type_code === 'auto_temp'))
    .filter((r) => {
      const step = stepOf(r.auto_jobs);
      return !step || WAITING.includes(step);
    })
    .map((r) => ({
      orderId: r.id,
      /*
        ★★ **FlowTemp 품목의 치식만** 셉니다 (2026-10-15). 이제 FlowTemp 는
          크라운과 같은 주문에 들어옵니다. 15 크라운 + 16 크라운·FlowTemp 면
          주문 치식은 15·16 인데 설계는 16 뿐이라, 전체를 견주면 짝을 못 찾습니다.
      */
      teeth: (r.order_items ?? []).filter((i) => i.type_code === 'auto_temp').map((i) => i.tooth_number),
    }));

  const pool = expectedOrderId ? jobs.filter((j) => j.orderId === expectedOrderId) : jobs;
  if (expectedOrderId && pool.length === 0) {
    return { ok: false, error: '이름표의 주문이 FlowTemp 를 기다리는 중이 아닙니다' };
  }
  const picked = matchWaiting(pool, designTeeth);
  if (!picked.ok) return { ok: false, error: picked.why };

  const token = issueExocadToken(picked.orderId);
  if (!token) return { ok: false, error: '서버에 열쇠가 없어 토큰을 못 만듭니다' };

  return { ok: true, orderId: picked.orderId, token };
}

// ---------------------------------------------------------------- 설계 PC 일꾼

export interface DesignJob {
  orderId: string;
  orderNo: string;
  /** FlowTemp 가 놓인 치식 전부 — 덴트버드가 잡은 치식과 견줄 것 (옛 일꾼용, groups 를 편 것) */
  teeth: number[];
  /** 설계 묶음 — 싱글은 치아 하나, 브릿지는 지대치+폰틱 (2026-10-26). 일꾼은 묶음마다 한 번 설계합니다 */
  groups: DesignGroup[];
  /** 스캔 파일 — 바로 받는 주소 (우리 서버를 안 지나갑니다) */
  files: { name: string; url: string; size: number | null }[];
  /**
   * 이 주문의 열쇠 (exocad 런처와 같은 것). 설계 PC 가 DS Core 에서 바꾼 ply 를
   * **주문에 되돌려 올릴 때** 씁니다 (2026-10-22) — 크라운 런처가 그 ply 를 보고 DS Core 를 건너뜁니다.
   */
  token: string;
}

/**
 * 설계 PC 가 다음 FlowTemp 일감을 잡아 갑니다 (2026-10-15).
 *
 * ★ **잡는 순간 표시합니다**(design_stage='uploading'). 일꾼이 둘이어도
 *   같은 주문을 둘이 잡지 않게, 읽은 때의 updated_at 이 그대로일 때만 씁니다.
 * ★ 한 번에 하나. 덴트버드 창은 하나뿐입니다.
 * ★ 디자인센터 기기만.
 */
/** 서버 PC 가 3분 안에 안 잡으면 / 잡고 6분 안에 못 끝내면 옛 파일로 (2026-10-23) */
export const RESLICE_PICKUP_MS = 3 * 60_000;
export const RESLICE_FINISH_MS = 6 * 60_000;

/**
 * 묵은 다시 자르기를 **옛 출력 파일(같은 자리)** 로 '출력 대기' 에 올립니다 (2026-10-23).
 *
 * ★ 서버 PC 가 꺼져 있어도 다시 뽑기는 나가야 합니다. 자리만 같습니다.
 * ★ 치과 PC 가 일감을 물을 때(20초마다) 그 치과 것만 봅니다 — cron 없이.
 */
export async function promoteStaleReslices(clinicOrgId: string): Promise<void> {
  const admin = createAdminClient();
  const now = Date.now();
  const pickup = new Date(now - RESLICE_PICKUP_MS).toISOString();
  const finish = new Date(now - RESLICE_FINISH_MS).toISOString();
  const patch = {
    step: 'queued',
    claimed_at: null,
    claimed_device_id: null,
    updated_at: new Date(now).toISOString(),
  };
  // 아무도 안 잡은 것
  await admin
    .from('auto_jobs')
    .update(patch)
    .eq('clinic_org_id', clinicOrgId)
    .eq('step', 'slicing')
    .not('print_file_path', 'is', null)
    .is('claimed_at', null)
    .lt('updated_at', pickup);
  // 잡았는데 못 끝낸 것
  await admin
    .from('auto_jobs')
    .update(patch)
    .eq('clinic_org_id', clinicOrgId)
    .eq('step', 'slicing')
    .not('print_file_path', 'is', null)
    .lt('claimed_at', finish);
}

export interface ResliceJob {
  orderId: string;
  /** 지난번 올린 **놓인** STL — 이미 돌아가 있습니다. 서명 주소(10분) */
  stlUrl: string;
  /** 출력 파일을 올릴 열쇠 (deliver) */
  token: string;
  /** 서버가 견줄 치식 — 주문서 것 */
  teeth: number[];
}

/**
 * 서버 PC(임시치아 지켜보기)가 **다시 자를 것**을 가져갑니다 (2026-10-23).
 *
 * ★ 표시는 단계가 아니라 모양입니다 — 'slicing' 인데 출력 파일이 이미 있는 것.
 *   처음 자를 때는 slicing 을 같은 요청 안에서 지나가므로(finishDeliver) 여기 안 걸립니다.
 *   design_stage 값을 새로 만들면 DB 제약을 고쳐야 해서 이 길을 골랐습니다.
 * ★ 잡는 것은 한 번만 — claimed_at 이 비어 있는 줄만 바꿉니다.
 */
export async function claimNextReslice(
  device: LinkedDevice,
): Promise<{ ok: true; job: ResliceJob | null } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: org } = await admin.from('organizations').select('org_type').eq('id', device.clinicOrgId).maybeSingle();
  if ((org as { org_type?: string } | null)?.org_type !== 'design_center') {
    return { ok: false, error: '설계 PC 만 다시 자를 수 있습니다' };
  }

  const { data: rows, error } = await admin
    .from('auto_jobs')
    .select('id, order_id')
    .eq('step', 'slicing')
    .not('print_file_path', 'is', null)
    .is('claimed_at', null)
    .order('updated_at', { ascending: true })
    .limit(1);
  if (error) return { ok: false, error: error.message };
  const row = ((rows ?? []) as { id: string; order_id: string }[])[0];
  if (!row) return { ok: true, job: null };

  const now = new Date().toISOString();
  const { data: taken, error: takeError } = await admin
    .from('auto_jobs')
    .update({ claimed_at: now, claimed_device_id: device.id })
    .eq('id', row.id)
    .eq('step', 'slicing')
    .is('claimed_at', null)
    .select('id');
  if (takeError) return { ok: false, error: takeError.message };
  if (!taken || taken.length === 0) return { ok: true, job: null };

  // 못 자르면 바로 옛 파일로 출력 대기 — 기다리게 하지 않습니다
  const giveBack = async (why: string) => {
    await moveStep(row.id, 'queued');
    return { ok: false as const, error: why };
  };

  // 놓인 STL — 지난번 deliver 가 'etc' 로 남긴 자동디자인.stl 중 가장 새것
  const { data: files } = await admin
    .from('order_files')
    .select('storage_path, created_at')
    .eq('order_id', row.order_id)
    .eq('kind', 'etc')
    .eq('file_name', '자동디자인.stl')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  const stlPath = ((files ?? []) as { storage_path: string }[])[0]?.storage_path;
  if (!stlPath) return giveBack('놓인 STL 이 없어 같은 자리로 뽑습니다');

  const signed = await admin.storage.from(BUCKET).createSignedUrl(stlPath, 600);
  if (signed.error || !signed.data) return giveBack('놓인 STL 주소를 못 만들어 같은 자리로 뽑습니다');

  const token = issueExocadToken(row.order_id);
  if (!token) return giveBack('올리기 열쇠를 못 만들어 같은 자리로 뽑습니다');

  const { data: items } = await admin.from('order_items').select('tooth_number').eq('order_id', row.order_id);
  const teeth = [
    ...new Set(
      ((items ?? []) as { tooth_number: number }[]).map((i) => i.tooth_number).filter((n) => Number.isInteger(n)),
    ),
  ];

  return { ok: true, job: { orderId: row.order_id, stlUrl: signed.data.signedUrl, token, teeth } };
}

export async function claimNextDesign(
  orgId: string,
  /**
   * 잡지 않고 **있는지만** 봅니다 (2026-10-16). 일꾼이 할 일이 있을 때만 덴트버드
   * 창을 확인하게 — 할 일이 없는데 5분마다 창에 붙어 디자이너 화면 앞으로
   * 덴트버드 창을 끌어왔습니다.
   */
  peek = false,
): Promise<{ ok: true; job: DesignJob | null; available?: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: org } = await admin.from('organizations').select('org_type').eq('id', orgId).maybeSingle();
  if ((org as { org_type?: string } | null)?.org_type !== 'design_center') {
    return { ok: false, error: '설계 PC 만 일감을 받을 수 있습니다' };
  }

  const { data, error } = await admin
    .from('auto_jobs')
    .select(
      'id, order_id, step, design_stage, design_note, design_tries, updated_at, created_at, ' +
        'orders!inner(order_no, status, deleted_at, order_items(id, tooth_number, type_code, is_pontic), ' +
        'order_bridges(order_bridge_members(order_item_id)), ' +
        'order_files(kind, upload_status, deleted_at, file_name, storage_path, file_size))',
    )
    .eq('step', 'waiting_design')
    .is('orders.deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) return { ok: false, error: error.message };

  type File = { kind: string; upload_status: string; deleted_at: string | null; file_name: string; storage_path: string; file_size: number | null };
  type Row = {
    id: string;
    order_id: string;
    step: AutoStep;
    design_stage: string | null;
    design_note: string | null;
    design_tries: number | null;
    updated_at: string;
    orders: {
      order_no: string;
      status: string;
      order_items: { id: string; tooth_number: number; type_code: string; is_pontic: boolean }[] | null;
      order_bridges: { order_bridge_members: { order_item_id: string }[] | null }[] | null;
      order_files: File[] | null;
    };
  };

  const now = Date.now();
  const scansOf = (r: Row) =>
    (r.orders.order_files ?? []).filter((f) => f.kind === 'scan' && f.upload_status === 'uploaded' && !f.deleted_at);

  const rows = (data ?? []) as unknown as Row[];
  for (const r of rows) {
    const ok = canHandDesign(
      {
        orderStatus: r.orders.status,
        step: r.step,
        designStage: isDesignStage(r.design_stage) ? r.design_stage : null,
        updatedAt: r.updated_at,
        scanCount: scansOf(r).length,
        designNote: r.design_note,
        designTries: r.design_tries ?? 0,
      },
      now,
    );
    if (!ok) continue;
    if (peek) return { ok: true, job: null, available: true };

    // ★ 읽은 그대로일 때만 잡습니다 — 그사이 다른 일꾼이 잡았으면 0줄
    const { data: took } = await admin
      .from('auto_jobs')
      .update({ design_stage: 'uploading', design_note: null, updated_at: new Date().toISOString() })
      .eq('id', r.id)
      .eq('updated_at', r.updated_at)
      .eq('step', 'waiting_design')
      .select('id');
    if (!took || took.length === 0) continue;

    const files: DesignJob['files'] = [];
    for (const f of scansOf(r)) {
      const signed = await admin.storage.from(BUCKET).createSignedUrl(f.storage_path, DOWNLOAD_TTL);
      if (signed.data) files.push({ name: f.file_name, url: signed.data.signedUrl, size: f.file_size });
    }

    const autoCodes = await autoTypeCodes();
    const autoItems = (r.orders.order_items ?? []).filter((i) => autoCodes.has(i.type_code));
    // ★ 브릿지·폰틱은 묶음으로 (2026-10-26) — 치식도의 「연결」 띠(order_bridges)가 사실입니다
    const groups = designGroups(
      autoItems.map((i) => ({ itemId: i.id, tooth: i.tooth_number, isPontic: i.is_pontic })),
      (r.orders.order_bridges ?? []).map((b) => (b.order_bridge_members ?? []).map((m) => m.order_item_id)),
    );
    return {
      ok: true,
      job: {
        orderId: r.order_id,
        orderNo: r.orders.order_no,
        teeth: [...new Set(autoItems.map((i) => i.tooth_number))].sort((a, b) => a - b),
        groups,
        files,
        token: issueExocadToken(r.order_id) ?? '',
      },
    };
  }
  return { ok: true, job: null, available: false };
}

// ---------------------------------------------------------------- 스캔 되돌려 올리기 (2026-10-22)

/**
 * 설계 PC 가 DS Core 에서 바꾼 **색 붙은 ply** 를 주문에 올릴 자리.
 *
 * ★ 왜 — 시로나 dxd 는 FlowTemp(서버 PC)와 크라운(디자인 PC 런처)이 **각자** DS Core 를
 *   다녀왔습니다 (3~5분 × 2, 임시 환자 × 2). 먼저 바꾼 쪽이 주문에 올려 두면 뒤는 건너뜁니다.
 * ★ 이름은 보낸 그대로(`<주문>-upperjaw.ply`) — 런처가 상·하악을 이름으로 알아봅니다.
 * ★ 열쇠는 exocad 런처와 같은 주문 열쇠. 치과 스캔 올리기(device/scan)와는 다른 길입니다.
 */
export async function openScanSlots(
  orderId: string,
  body: { files?: unknown },
): Promise<{ ok: true; slots: DeliverSlot[]; bucket: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id').eq('id', orderId).is('deleted_at', null).maybeSingle();
  if (!order) return { ok: false, error: '주문을 찾지 못했습니다' };
  const wanted = (Array.isArray(body.files) ? body.files : []) as { name?: unknown }[];
  const names = wanted.map((f) => (typeof f.name === 'string' ? f.name : '')).filter(Boolean);
  if (names.length === 0 || names.length > 8) return { ok: false, error: '올릴 스캔이 없거나 너무 많습니다' };
  const slots: DeliverSlot[] = [];
  for (const name of names) {
    const safe = name.replace(/[^\w.\-가-힣]/g, '_').slice(-80);
    const path = `orders/${orderId}/${crypto.randomUUID()}_${safe}`;
    const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signed.error || !signed.data) return { ok: false, error: '올릴 주소를 못 받았습니다' };
    slots.push({ role: 'design', name, path, token: signed.data.token });
  }
  return { ok: true, slots, bucket: BUCKET };
}

/** 올린 스캔을 주문 파일(kind 'scan')로 적습니다 — 저장소에 진짜 있는 것만 */
export async function finishScanUpload(
  orderId: string,
  body: { files?: unknown },
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const files = (Array.isArray(body.files) ? body.files : []) as { path?: unknown; name?: unknown; size?: unknown }[];
  const rows: Record<string, unknown>[] = [];
  for (const f of files) {
    if (typeof f.path !== 'string' || !f.path.startsWith(`orders/${orderId}/`)) continue;
    const dir = f.path.slice(0, f.path.lastIndexOf('/'));
    const name = f.path.slice(f.path.lastIndexOf('/') + 1);
    const { data } = await admin.storage.from(BUCKET).list(dir, { search: name });
    if (!data?.some((o) => o.name === name)) return { ok: false, error: `${name} 이 저장소에 없습니다` };
    rows.push({
      order_id: orderId,
      kind: 'scan',
      storage_path: f.path,
      file_name: typeof f.name === 'string' ? f.name : name,
      file_size: typeof f.size === 'number' ? f.size : null,
      mime_type: null,
      upload_status: 'uploaded',
    });
  }
  if (rows.length === 0) return { ok: false, error: '적을 파일이 없습니다' };
  const { error } = await admin.from('order_files').insert(rows);
  if (error) return { ok: false, error: `기록을 남기지 못했습니다: ${error.message}` };
  return { ok: true, added: rows.length };
}

/**
 * FlowTemp 만 있는 주문을 **출력이 끝난 자리에서 완료**로 넘깁니다 (과금 2안, 2026-10-21).
 *
 * ★ 왜 — 임시치아만 주문이 열리면서(크라운 없이 8,000원) 생긴 구멍입니다. 그런 주문은
 *   디자인·제작·배송이 없어 아무도 상태를 못 넘기고 **접수에 영영** 남습니다. 센터 목록을
 *   어지럽히고, 정산은 배송일(shipped_at)로 자르니 **청구도 안 됩니다.**
 * ★ 크라운이 하나라도 있으면 손대지 않습니다 — 그 주문은 평소대로 기공 흐름을 탑니다.
 * ★ 배송 시각은 지금으로 — 그날이 정산 단가의 기준일이 됩니다. 이력은 사람 없이 남깁니다
 *   (밤 자동 완료와 같은 모양).
 */
async function completeAutoOnlyOrder(admin: ReturnType<typeof createAdminClient>, orderId: string): Promise<void> {
  const { data: order } = await admin
    .from('orders')
    .select('id, status, shipped_at, order_items(type_code)')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();
  const row = order as unknown as { status: string; shipped_at: string | null; order_items: { type_code: string }[] | null } | null;
  if (!row || row.status === 'completed' || row.status === 'cancelled') return;
  const items = row.order_items ?? [];
  if (items.length === 0) return;
  const auto = await autoTypeCodes();
  if (!items.every((i) => auto.has(i.type_code))) return;

  const now = new Date().toISOString();
  const { error } = await admin
    .from('orders')
    .update({ status: 'completed', shipped_at: row.shipped_at ?? now })
    .eq('id', orderId);
  if (error) return;
  await admin.from('order_status_history').insert({
    order_id: orderId,
    from_status: row.status,
    to_status: 'completed',
    actor_org_id: null,
    actor_user_id: null,
    reason: '임시치아만 있는 주문 — 출력이 끝나 자동 완료',
  });
}

async function autoTypeCodes(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin.from('prosthesis_types').select('code').eq('auto_pipeline', true);
  return new Set(((data ?? []) as { code: string }[]).map((t) => t.code));
}
