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
  canMove,
  claimable,
  isAutoStep,
  teethMismatch,
  type AutoJob,
  type AutoStep,
} from '@/server/domain/auto-print';
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
}

const asJob = (row: JobRow): AutoJob => ({
  step: row.step,
  bedClearedAt: row.bed_cleared_at,
  percent: row.percent,
  failedAt: row.failed_at,
  failedReason: row.failed_reason,
});

const COLUMNS =
  'id, order_id, clinic_org_id, printer_id, step, bed_cleared_at, ' +
  'percent, tries, failed_at, failed_reason, print_file_path';

/** 주문 하나의 작업. 없으면 null */
export async function jobOfOrder(orderId: string): Promise<(AutoJob & { id: string }) | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('auto_jobs').select(COLUMNS).eq('order_id', orderId).maybeSingle();
  const row = data as JobRow | null;
  return row ? { id: row.id, ...asJob(row) } : null;
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

  if (row.step === to) return { ok: true }; // 같은 말을 두 번 해도 탈이 없게
  if (!canMove(row.step, to)) {
    return { ok: false, error: `${row.step} 에서 ${to} 로는 갈 수 없습니다` };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { step: to, updated_at: now };

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
  }
  if (to === 'done') {
    patch.finished_at = now;
    patch.percent = 100;
  }

  const { error } = await admin.from('auto_jobs').update(patch).eq('id', jobId);
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

  const moved = await moveStep(row.id, 'sending', { deviceId: device.id });
  if (!moved.ok) return { ok: false, error: moved.error };

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
  body: { step?: unknown; percent?: unknown; reason?: unknown },
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

  // 숫자만 올리는 것은 단계를 안 건드립니다
  if (!body.step && percent !== null) {
    await reportPercent(jobId, percent);
    return { ok: true };
  }

  if (!isAutoStep(body.step)) return { ok: false, error: 'step 이 올바르지 않습니다' };

  // ★ 치과 PC 가 옮길 수 있는 자리는 셋뿐입니다. 'queued' 로 되돌리거나
  //   'slicing' 으로 가는 것은 치과 PC 가 할 일이 아닙니다.
  const allowed: AutoStep[] = ['printing', 'done', 'failed'];
  if (!allowed.includes(body.step)) return { ok: false, error: '그 단계는 보낼 수 없습니다' };

  return moveStep(jobId, body.step, {
    percent,
    reason: typeof body.reason === 'string' ? body.reason : null,
  });
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

  // 기록으로 남길 것 — 디자인 STL 과 놓인 모습
  const keep: Array<{ role: string; kind: string }> = [
    { role: 'design', kind: 'design' },
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
