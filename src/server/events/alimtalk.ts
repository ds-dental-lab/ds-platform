// =========================================================
// 놓을 위치: src/server/events/alimtalk.ts
//
// 알림톡으로 나갈 것을 **줄로 쌓습니다.** (사용자 요청 2026-08-14)
//
// ★ **아직 안 보냅니다.** 사업자등록 · 카카오톡 채널 · 템플릿 사전심사가
//   있어야 나갑니다. 그때까지는 '누구에게 어떤 문구로 갈 뻔했는가' 만
//   정확히 쌓습니다. 발송이 붙으면 이 표를 읽어 내보내면 되고,
//   **이 파일은 안 바뀝니다.**
//
// ★ 받을 사람과 번호를 **그때 박아 둡니다.**
//   나중에 그 사람이 번호를 바꾸거나 알림톡을 꺼도, 이 줄은 '그때
//   누구에게 갔다' 를 그대로 말해야 합니다.
//
// ★ 실패해도 업무를 안 되돌립니다.
//   알림톡 한 줄 못 쌓았다고 이미 넘어간 주문 상태를 되돌리면 더 큰
//   사고입니다. events/index.ts 와 같은 원칙입니다.
//
// ★ service_role 로 넣습니다.
//   alimtalk_queue 에 insert 정책이 **없습니다** — 사용자 열쇠로 남의
//   폰에 알림톡을 꽂는 길을 안 엽니다. 그래서 여기서만 admin 으로
//   들어갑니다.
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ALIMTALK_RULES,
  canReceive,
  normalizePhone,
  type AlimtalkEvent,
} from '@/server/domain/alimtalk';

export interface AlimtalkTarget {
  orderId: string;
  orderNo: string;
  patientLabel: string;
  /** 주문의 세 자리. 아직 배정 전이면 null */
  clinicOrgId: string | null;
  designOrgId: string | null;
  labOrgId: string | null;
  /** 문구에 덧붙일 한 줄 — 리페어의 요청 내용 같은 것 */
  extra?: string;
}

/** 대기열에 적을 문구. 템플릿이 정해지면 이 자리만 바꿉니다 */
function compose(event: AlimtalkEvent, order: AlimtalkTarget): { title: string; body: string } {
  const rule = ALIMTALK_RULES[event];

  const lines = [`${order.orderNo} · ${order.patientLabel}`];
  if (order.extra) lines.push(order.extra);
  // ★ 리페어는 할 일이 문구에 있어야 합니다 — 제목만 보고 넘기면 보철물이 치과에 남습니다
  if (event === 'repair_requested') lines.push('보철물 수거를 접수해 주세요.');

  return {
    title: `[DenFlow] ${rule.label}`,
    body: lines.join('\n'),
  };
}

/**
 * 이 사건으로 알림톡을 받을 사람들을 찾아 줄로 쌓습니다.
 *
 * ★ 받는 **조직**은 규칙이 정하고(ALIMTALK_RULES), 그 조직의 **사람들**
 *   중 번호가 있고 켜 둔 사람만 받습니다. 한 조직에서 셋이 켜 뒀으면
 *   세 줄입니다 — 발송도 재시도도 사람 단위라서요.
 *
 * ★ 받을 조직이 아직 없으면 조용히 넘어갑니다.
 *   기공소 배정 전에 제작대기로 갈 일은 없지만, 없는 것을 없다고
 *   터뜨릴 이유도 없습니다.
 */
export async function queueAlimtalk(
  event: AlimtalkEvent,
  order: AlimtalkTarget,
): Promise<void> {
  const audience = ALIMTALK_RULES[event].audience;
  if (audience === 'applicant') return; // 신청자는 조직이 없습니다 — queueAlimtalkToPhone 로

  const orgId =
    audience === 'clinic'
      ? order.clinicOrgId
      : audience === 'design_center'
        ? order.designOrgId
        : order.labOrgId;

  if (!orgId) return;

  const { title, body } = compose(event, order);
  await queueAlimtalkNotice({ event, orgId, orderId: order.orderId, title, body });
}

/**
 * 조직 하나에 문구 하나를 쌓습니다 — 주문에 묶이지 않는 안내도 여기로
 * (아침 "오늘 도착 예정" 은 주문이 여럿이라 order_id 가 없습니다).
 */
export async function queueAlimtalkNotice(input: {
  event: AlimtalkEvent;
  orgId: string;
  orderId?: string | null;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    /*
      ★ 그 조직에 **지금 붙어 있는** 사람만 봅니다.
        끈 사람(is_active false)이나 지운 사람에게 보내면, 그만둔 직원의
        폰으로 환자 이름이 계속 갑니다.
    */
    const { data } = await admin
      .from('memberships')
      .select('user_id, user:user_profiles!inner(id, phone, alimtalk_on, deleted_at)')
      .eq('org_id', input.orgId)
      .eq('is_active', true)
      .is('deleted_at', null);

    type Row = {
      user: { id: string; phone: string | null; alimtalk_on: boolean; deleted_at: string | null };
    };

    const people = ((data ?? []) as unknown as Row[])
      .map((row) => row.user)
      .filter((u) => u && !u.deleted_at)
      .filter((u) => canReceive({ phone: u.phone, alimtalkOn: u.alimtalk_on }));

    if (people.length === 0) return;

    await admin.from('alimtalk_queue').insert(
      people.map((u) => ({
        event: input.event,
        order_id: input.orderId ?? null,
        to_user_id: u.id,
        to_org_id: input.orgId,
        // ★ 그때의 번호를 박습니다. 나중에 바뀌어도 이 줄은 안 따라갑니다
        phone: normalizePhone(u.phone)!,
        title: input.title,
        body: input.body,
        status: 'pending' as const,
      })),
    );
  } catch (error) {
    // ★ 업무는 이미 끝났습니다. 알림톡 때문에 되돌리지 않습니다
    console.error('[alimtalk] 대기열에 못 넣었습니다', input.event, error);
  }
}

/**
 * 번호 하나에 직접 쌓습니다 — 아직 회원이 아닌 **가입 신청자**용.
 * (사용자 요청 2026-09-08 — "회원 가입 시에도 승인 대기·승인 알림톡")
 *
 * ★ 켬/끔 설정이 없는 사람입니다. 신청서에 번호를 적은 것이 곧 "받겠다" 입니다.
 * ★ 휴대전화가 아니면 조용히 안 쌓습니다 — 발송이 실패할 줄을 만들지 않습니다.
 */
export async function queueAlimtalkToPhone(input: {
  event: AlimtalkEvent;
  phone: string | null | undefined;
  title: string;
  body: string;
}): Promise<void> {
  const phone = normalizePhone(input.phone);
  if (!phone) return;

  try {
    const admin = createAdminClient();
    await admin.from('alimtalk_queue').insert({
      event: input.event,
      order_id: null,
      to_user_id: null,
      to_org_id: null,
      phone,
      title: input.title,
      body: input.body,
      status: 'pending' as const,
    });
  } catch (error) {
    console.error('[alimtalk] 대기열에 못 넣었습니다', input.event, error);
  }
}
