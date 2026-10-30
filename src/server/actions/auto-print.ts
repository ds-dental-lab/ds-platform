// =========================================================
// 놓을 위치: src/server/actions/auto-print.ts
//
// 자동 템포러리 — 치과가 누르는 것 (사용자 요청 2026-10-06).
//
// ★ 지금은 한 가지뿐입니다 — **「출력판을 비웠습니다」**.
//   치과에는 기공사가 없습니다. 전 출력물이 남아 있으면 그 위에 뽑습니다.
//   기계는 베드가 비었는지 모릅니다. 사람이 한 번 봐 주는 자리입니다.
//
// ★ 누를 수 있는 사람은 **그 치과**뿐입니다. 디자인센터가 대신 눌러 주지
//   않습니다 — 눌러 주는 순간 아무도 베드를 안 봅니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/server/policies/session';
import {
  clearBed,
  applyToothFix,
  clinicTypicalPrintSeconds,
  dismissJob,
  jobOfOrder,
  reprintJob,
  retryJob,
} from '@/server/repositories/auto-print';
import {
  autoProgress,
  autoNotice,
  boardRow,
  canClearBed,
  BOARD_DONE_HOURS,
  deviceOnline,
  withClinicPc,
  isAutoStep,
  isDesignStage,
  type AutoJob,
  type BoardRow,
} from '@/server/domain/auto-print';
import { autoPrintLaunchUrl } from '@/server/domain/exocad';
import { issueExocadToken } from '@/server/exocad/token';

export type ClearBedResult = { ok: true } | { ok: false; error: string };

export async function submitClearBed(orderId: string): Promise<ClearBedResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다' };
  if (session.orgType !== 'clinic') {
    return { ok: false, error: '출력판은 치과에서 확인해 주셔야 합니다' };
  }

  // 자기 주문인지 — RLS 가 한 번 더 봅니다
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('id').eq('id', orderId).maybeSingle();
  if (!data) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const result = await clearBed(orderId, session.user.id);
  if (result.ok) {
    revalidatePath(`/clinic/orders/${orderId}`);
    revalidatePath(`/design/orders/${orderId}`);
  }
  return result;
}

export type RetryResult = { ok: true } | { ok: false; error: string };

/**
 * 멈춘 작업을 다시 겁니다 (사용자 2026-10-12 — 필라멘트가 떨어져 멈춘 건을
 * 다시 걸 길이 아예 없었습니다).
 *
 * ★ **치과와 센터 둘 다** 누를 수 있습니다. 멈추는 까닭은 프린터 쪽이
 *   많아 치과가 고치고 바로 누르는 것이 빠르고, 센터는 흐름을 지켜보는
 *   쪽이라 대신 걸어 줄 수 있어야 합니다.
 *
 * ★ 다시 걸면 **「비웠습니다」를 다시 눌러야** 합니다 (repositories 가
 *   같이 지웁니다). 실패한 판 위에 무엇이 남았는지는 아무도 모릅니다.
 */
export async function submitRetryAutoPrint(orderId: string): Promise<RetryResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다' };
  if (session.orgType === 'lab') {
    return { ok: false, error: '자동 출력은 기공소가 다루지 않습니다' };
  }

  // 자기 주문인지 — RLS 가 한 번 더 봅니다
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('id').eq('id', orderId).maybeSingle();
  if (!data) return { ok: false, error: '주문을 찾을 수 없습니다' };

  /*
    ★ 디자인이 멈춘 것을 다시 거는 것은 **센터만** (2026-10-15). 다시 설계하면
      덴트버드 건수를 씁니다 — 치과가 누를 일이 아닙니다.
  */
  if (session.orgType === 'clinic') {
    const job = await jobOfOrder(orderId);
    if (job?.step === 'waiting_design' && job.designStage === 'stalled') {
      return { ok: false, error: '디자인은 센터에서 확인 후 다시 겁니다' };
    }
  }

  const result = await retryJob(orderId);
  if (result.ok) {
    revalidatePath(`/clinic/orders/${orderId}`);
    revalidatePath(`/design/orders/${orderId}`);
    return { ok: true };
  }
  return result;
}

export interface AutoView {
  job: AutoJob;
  steps: ReturnType<typeof autoProgress>;
  notice: string;
  /** 치과가 지금 눌러야 하는가 */
  needsBed: boolean;
  /** 책갈피와 같은 한 줄 — 출력 중 칸이 남은 시간·층을 여기서 읽습니다 */
  board: BoardRow;
  /**
   * 디자인이 멈춘 까닭 — **센터에만** 채웁니다 (2026-10-15).
   * 설계 프로그램 이름이 들어 있을 수 있어 치과 화면에는 null 입니다.
   */
  designNote: string | null;
}

/** 주문 화면이 쓸 모양. 자동 진행 중이 아니면 null */
export async function getAutoView(orderId: string): Promise<AutoView | null> {
  const job = await jobOfOrder(orderId);
  if (!job) return null;

  const session = await getSession();
  const { designNote, dismissed, ...rest } = job;
  const isCenter = session?.orgType === 'design_center';

  /*
    ★ 기기가 켜져 있나 (2026-10-16 점검). 치과 PC 가 꺼져 있으면 출력이 안 가고,
      설계 PC 가 꺼져 있으면 디자인이 안 됩니다 — 화면이 그 말을 해야 합니다.
      관리자 열쇠로 읽되 **이 주문의 치과·센터 기기만** 봅니다.
  */
  const admin = createAdminClient();
  const now = Date.now();
  const { data: ord } = await admin.from('orders').select('clinic_org_id, design_org_id').eq('id', orderId).maybeSingle();
  const o = ord as { clinic_org_id: string; design_org_id: string | null } | null;
  const lastSeen = async (orgId: string | null | undefined) => {
    if (!orgId) return null;
    const { data } = await admin
      .from('clinic_devices')
      .select('last_seen_at')
      .eq('clinic_org_id', orgId)
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .limit(1);
    return ((data ?? []) as { last_seen_at: string | null }[])[0]?.last_seen_at ?? null;
  };
  const clinicOnline = deviceOnline(await lastSeen(o?.clinic_org_id), now);
  // ★ 준비 구간 남은 시간은 이 치과의 실제 출력 시간으로 (2026-10-23)
  const typical = rest.step === 'printing' && o?.clinic_org_id ? await clinicTypicalPrintSeconds(o.clinic_org_id) : null;
  // ★ 까닭 글은 화면으로 안 나갑니다 — boardRow 가 치과 말과 번호로만 바꿉니다 (2026-10-30)
  const shown = withClinicPc(boardRow({ ...rest, designNote }, now, typical), rest, clinicOnline);
  // ★ 이미 책갈피에서 치운 다 나온 건 — 상세에는 「다시 뽑기」만, 「치우기」는 또 안 띄움 (2026-10-23)
  const board = dismissed ? { ...shown, canDismiss: false } : shown;

  let note = isCenter && job.designStage === 'stalled' ? designNote : null;
  if (isCenter && job.step === 'waiting_design' && job.designStage !== 'stalled') {
    const designOnline = deviceOnline(await lastSeen(o?.design_org_id), now);
    if (!designOnline) note = '설계 PC 소식이 없습니다 — 설계 일꾼이 일감을 못 받습니다. PC 와 덴트버드 창을 확인하세요';
  }

  return {
    job: rest,
    steps: autoProgress(rest),
    // ★ 치과 PC 가 꺼져서 막힌 것이면 그 말이 먼저입니다
    notice: board.status === '치과 PC 꺼짐' ? board.detail : autoNotice({ ...rest, designNote }),
    needsBed: canClearBed(job),
    board,
    designNote: note,
  };
}

// ---------------------------------------------------------------- 보내기 버튼

export type LaunchResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * 기공소 PC 를 여는 주소를 만듭니다.
 *
 * ★ **주소를 미리 받아 둡니다.** 크롬은 denflow:// 같은 바깥 프로토콜을
 *   **클릭 그 순간**에만 엽니다. 눌러 놓고 서버에 토큰을 받으러 갔다 오면
 *   그 순간이 지나 조용히 막힙니다 — 오류도 안 보여 줍니다.
 *   exocad 보내기가 첫 실전에서 그렇게 안 떴습니다 (2026-09-10).
 * ★ 센터 사람만. 실제로 덴트버드 앞에 앉는 사람입니다.
 */
export async function issueAutoPrintLaunch(orderId: string): Promise<LaunchResult> {
  const session = await getSession();
  if (!session?.orgId || session.orgType !== 'design_center') {
    return { ok: false, error: '디자인센터만 보낼 수 있습니다' };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const token = issueExocadToken(orderId);
  if (!token) return { ok: false, error: '서버에 열쇠가 없어 토큰을 못 만듭니다' };

  return { ok: true, url: autoPrintLaunchUrl(orderId, token) };
}

// ---------------------------------------------------------------- 치과 책갈피

export interface BoardItem extends BoardRow {
  orderId: string;
  orderNo: string;
  patientLabel: string;
  /** FlowTemp 가 놓인 치식 */
  teeth: number[];
}

export interface Board {
  /** 제품 이름 — 표에서 읽습니다 (FlowTemp) */
  productName: string;
  items: BoardItem[];
}

/**
 * 치과 화면 오른쪽 책갈피에 그릴 것 (사용자 요청 2026-10-15).
 *
 * ★ **치과만.** 다른 섹터는 빈 목록입니다.
 * ★ 누구 것인지는 RLS 가 정합니다(auto_jobs_select — 자기 치과 것만).
 *   관리자 열쇠를 쓰지 않습니다.
 * ★ 끝난 것은 BOARD_DONE_HOURS 동안만 남깁니다 — '꺼내 주세요' 가 보일 만큼.
 * ★ 가볍게 — 열어 둔 모든 화면이 몇 초마다 부릅니다. 줄 수를 묶어 둡니다.
 */
export async function getFlowTempBoard(): Promise<Board> {
  const empty: Board = { productName: '', items: [] };

  const session = await getSession();
  if (!session || session.orgType !== 'clinic') return empty;

  const supabase = await createClient();
  const since = new Date(Date.now() - BOARD_DONE_HOURS * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('auto_jobs')
    .select(
      'order_id, step, bed_cleared_at, percent, failed_at, failed_reason, design_stage, design_note, finished_at, updated_at, ' +
        'started_at, remaining_min, layer_now, layer_total, ' +
        'orders!inner(order_no, patient_label, deleted_at, order_items(tooth_number, type_code))',
    )
    .is('orders.deleted_at', null)
    // ★ 치과가 ✕ 로 치운 것은 빼고 (2026-10-15)
    .is('dismissed_at', null)
    .or(`step.neq.done,finished_at.gte.${since}`)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error || !data) return empty;

  type Row = {
    order_id: string;
    step: string;
    bed_cleared_at: string | null;
    percent: number | null;
    failed_at: string | null;
    failed_reason: string | null;
    design_stage: string | null;
    design_note: string | null;
    finished_at: string | null;
    started_at: string | null;
    remaining_min: number | null;
    layer_now: number | null;
    layer_total: number | null;
    orders: {
      order_no: string;
      patient_label: string;
      order_items: { tooth_number: number; type_code: string }[] | null;
    };
  };

  const rows = data as unknown as Row[];
  if (rows.length === 0) return empty;

  const { data: types } = await supabase
    .from('prosthesis_types')
    .select('code, name')
    .eq('auto_pipeline', true);
  const autoTypes = (types ?? []) as { code: string; name: string }[];
  const autoCodes = new Set(autoTypes.map((t) => t.code));

  // ★ 준비 구간 남은 시간은 이 치과의 실제 출력 시간으로 (2026-10-23) — 출력 중인 줄이 있을 때만 묻습니다
  const typical = rows.some((r) => r.step === 'printing') && session.orgId ? await clinicTypicalPrintSeconds(session.orgId) : null;
  const now = Date.now();

  const items: BoardItem[] = rows
    .filter((r) => isAutoStep(r.step))
    .map((r) => {
      const job: AutoJob = {
        step: r.step as AutoJob['step'],
        bedClearedAt: r.bed_cleared_at,
        percent: r.percent,
        failedAt: isAutoStep(r.failed_at) ? r.failed_at : null,
        failedReason: r.failed_reason,
        designStage: isDesignStage(r.design_stage) ? r.design_stage : null,
        designNote: r.design_note,
        finishedAt: r.finished_at,
        startedAt: r.started_at,
        remainingMin: r.remaining_min,
        layerNow: r.layer_now,
        layerTotal: r.layer_total,
      };
      return {
        orderId: r.order_id,
        orderNo: r.orders.order_no,
        patientLabel: r.orders.patient_label,
        teeth: [
          ...new Set(
            (r.orders.order_items ?? [])
              .filter((i) => autoCodes.has(i.type_code))
              .map((i) => i.tooth_number),
          ),
        ].sort((a, b) => a - b),
        ...boardRow(job, now, typical),
      };
    });

  /*
    ★ 급한 것이 위로 — 오류, 치과 할 일, 지연, 진행 순. 같으면 최근 것이 위.
  */
  const order = { error: 0, action: 1, delay: 2, progress: 3, done: 4, info: 5 } as const;
  /*
    ★ 치과 PC 가 꺼져 있으면 그 말로 바꿉니다 (2026-10-16 점검). 자기 치과
      기기는 RLS 로 읽힙니다.
  */
  const { data: devs } = await supabase
    .from('clinic_devices')
    .select('last_seen_at')
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(1);
  const online = deviceOnline(((devs ?? []) as { last_seen_at: string | null }[])[0]?.last_seen_at, Date.now());
  for (let i = 0; i < items.length; i++) {
    const r = rows.find((x) => x.order_id === items[i].orderId);
    if (!r || !isAutoStep(r.step)) continue;
    const fixed = withClinicPc(items[i], {
      step: r.step,
      bedClearedAt: r.bed_cleared_at,
      percent: r.percent,
      failedAt: null,
      failedReason: null,
    }, online);
    items[i] = { ...items[i], ...fixed };
  }
  items.sort((a, b) => order[a.tone] - order[b.tone]);

  return { productName: autoTypes[0]?.name ?? '임시치아', items };
}

/**
 * 다 나온 건을 책갈피에서 치웁니다 — 치과만 (사용자 요청 2026-10-15).
 * 자기 주문인지는 RLS 로 먼저 봅니다. 치우는 것은 관리자 열쇠(dismissJob).
 */
export async function submitDismissAutoJob(orderId: string): Promise<ClearBedResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다' };
  if (session.orgType !== 'clinic') return { ok: false, error: '치과에서만 치울 수 있습니다' };

  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('id').eq('id', orderId).maybeSingle();
  if (!data) return { ok: false, error: '주문을 찾을 수 없습니다' };

  return dismissJob(orderId, session.user.id);
}

/**
 * 스캔에서 읽은 치식으로 주문서를 바꾸고 설계를 이어 갑니다 (사용자 2026-10-30).
 * ★ 치과만 — 환자 입을 아는 것은 치과입니다. 번호는 서버가 저장된 값에서 읽습니다.
 */
export async function submitToothFix(orderId: string): Promise<ClearBedResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다' };
  if (session.orgType !== 'clinic') return { ok: false, error: '치과에서만 바꿀 수 있습니다' };

  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('id').eq('id', orderId).maybeSingle();
  if (!data) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const result = await applyToothFix(orderId);
  if (result.ok) {
    revalidatePath(`/clinic/orders/${orderId}`);
    revalidatePath(`/design/orders/${orderId}`);
  }
  return result;
}

/**
 * 같은 디자인을 다시 뽑습니다 (사용자 요청 2026-10-15).
 *
 * ★ 치과·센터 둘 다 누릅니다 — 치과가 센터에 전화로 부탁하는 일이 있습니다.
 *   어느 쪽이 눌러도 출력은 치과가 「비웠습니다」를 눌러야 시작합니다.
 * ★ 기공소는 못 누릅니다 (다시 걸기와 같은 규칙).
 */
export async function submitReprint(orderId: string): Promise<ClearBedResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다' };
  if (session.orgType === 'lab') return { ok: false, error: '자동 출력은 기공소가 다루지 않습니다' };

  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('id').eq('id', orderId).maybeSingle();
  if (!data) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const result = await reprintJob(orderId, { orgId: session.orgId ?? null, userId: session.user.id });
  if (!result.ok) return result;

  revalidatePath(`/clinic/orders/${orderId}`);
  revalidatePath(`/design/orders/${orderId}`);
  return { ok: true };
}
