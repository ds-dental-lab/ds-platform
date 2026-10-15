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
  canMove,
  claimable,
  isAutoStep,
  isDesignStage,
  retryTo,
  teethMismatch,
  type AutoJob,
  type AutoStep,
  type DesignStage,
} from '@/server/domain/auto-print';
import { publishAutoAlert } from '@/server/events/auto-print';
import type { LinkedDevice } from '@/server/repositories/device-link';

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
  'started_at, remaining_min, layer_now, layer_total';

/** 주문 하나의 작업. 없으면 null */
export async function jobOfOrder(
  orderId: string,
): Promise<(AutoJob & { id: string; designNote: string | null }) | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('auto_jobs').select(COLUMNS).eq('order_id', orderId).maybeSingle();
  const row = data as JobRow | null;
  return row ? { id: row.id, designNote: row.design_note, ...asJob(row) } : null;
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
  if (alert) await publishAutoAlert(row.order_id, alert);

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

  const { data, error } = await admin
    .from('auto_jobs')
    .update({
      design_stage: stage,
      design_note: stage === 'stalled' ? (note ?? '').slice(0, 500) || null : null,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .eq('step', 'waiting_design')
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: '디자인 차례인 주문이 아닙니다' };
  return { ok: true };
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

  const { data, error } = await admin
    .from('auto_jobs')
    .update({
      step: 'queued',
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
  const { data, error } = await admin
    .from('auto_jobs')
    .update({ dismissed_at: new Date().toISOString(), dismissed_by: userId })
    .eq('order_id', orderId)
    .eq('step', 'done')
    .is('dismissed_at', null)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: '다 나온 건만 치울 수 있습니다' };
  return { ok: true };
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
  if (row.step !== 'queued') return { ok: false, error: '아직 출력할 차례가 아닙니다' };
  if (row.bed_cleared_at) return { ok: true };

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

export interface ClaimedJob {
  jobId: string;
  orderId: string;
  /** 치과 PC 가 바로 내려받는 주소. 우리 서버를 지나가지 않습니다 */
  downloadUrl: string;
  fileName: string;
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
): Promise<{ ok: true; job: ClaimedJob | null } | { ok: false; error: string }> {
  const admin = createAdminClient();

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
  if (!row) return { ok: true, job: null };
  if (!claimable(asJob(row))) return { ok: true, job: null };
  if (!row.print_file_path) return { ok: false, error: '출력 파일이 없습니다' };

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
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('auto_jobs')
    .select('id, clinic_org_id, step')
    .eq('id', jobId)
    .maybeSingle();

  const row = data as { id: string; clinic_org_id: string; step: AutoStep } | null;
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
    rotate: { x: num(r.x), y: num(r.y), z: num(r.z) },
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

  const picked = matchWaiting(jobs, designTeeth);
  if (!picked.ok) return { ok: false, error: picked.why };

  const token = issueExocadToken(picked.orderId);
  if (!token) return { ok: false, error: '서버에 열쇠가 없어 토큰을 못 만듭니다' };

  return { ok: true, orderId: picked.orderId, token };
}
