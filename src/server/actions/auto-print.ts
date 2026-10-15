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
import { getSession } from '@/server/policies/session';
import { clearBed, dismissJob, jobOfOrder, retryJob } from '@/server/repositories/auto-print';
import {
  autoProgress,
  autoNotice,
  boardRow,
  BOARD_DONE_HOURS,
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
  const { designNote, ...rest } = job;

  return {
    job: rest,
    steps: autoProgress(rest),
    notice: autoNotice(rest),
    needsBed: job.step === 'queued' && job.bedClearedAt === null,
    designNote:
      session?.orgType === 'design_center' && job.designStage === 'stalled' ? designNote : null,
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
      'order_id, step, bed_cleared_at, percent, failed_at, failed_reason, design_stage, finished_at, updated_at, ' +
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
        ...boardRow(job),
      };
    });

  /*
    ★ 급한 것이 위로 — 오류, 치과 할 일, 지연, 진행 순. 같으면 최근 것이 위.
  */
  const order = { error: 0, action: 1, delay: 2, progress: 3, done: 4 } as const;
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
