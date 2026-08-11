// =========================================================
// 놓을 위치: src/server/services/order-status.ts
//
// 상태 전이의 단일 진입점. (설계서 §5.3 결정 5)
//
// ★ 주문 상태를 바꾸는 길은 이 함수 하나뿐입니다.
//   여기서 전이 검증 · 이력 기록을 한 번에 처리합니다.
//   화면마다 update 를 흩뿌리면 "누가 언제 왜 바꿨는지"가 사라집니다.
//
//   이벤트 발행 · 알림 큐 적재는 Sprint 5 에서 여기에 붙습니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { publishOrderStatusChanged } from '@/server/events';
import {
  canTransition,
  requiresDesignFile,
  requiresLabAssignment,
  type OrderStatus,
  type Sector,
} from '@/server/domain/order-status';

export type ChangeStatusResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; error: string };

export interface ChangeStatusOptions {
  reason?: string;
  /** 제작대기로 넘길 때 지정하는 기공소 (설계서 Q-2) */
  labOrgId?: string;
}

/**
 * 이 주문에서 그 조직이 맡은 자리들.
 *
 * 한 조직이 둘을 겸할 수 있습니다 — 자사 제작이면 디자인센터가
 * design_center 이면서 동시에 lab 입니다.
 */
function rolesOf(
  order: { clinic_org_id: string; design_org_id: string | null; lab_org_id: string | null },
  orgId: string,
): Sector[] {
  const roles: Sector[] = [];

  if (order.clinic_org_id === orgId) roles.push('clinic');
  if (order.design_org_id === orgId) roles.push('design_center');
  if (order.lab_org_id === orgId) roles.push('lab');

  return roles;
}

/** 사유를 반드시 받아야 하는 전이 */
/**
 * 사유를 받아야 하는 전이인가.
 *
 * ★ 재스캔과 취소만입니다.
 *   둘 다 상대에게 무언가를 다시 하라고 시키는 일이라, 무엇 때문인지가
 *   없으면 받는 쪽이 손을 못 댑니다.
 *
 * ★ 디자인으로 되돌리는 것은 안 묻습니다 (사용자 결정 2026-08-12).
 *   기공소가 이미 대화로 말한 뒤에 누르는 버튼입니다. 같은 말을 창에
 *   또 적게 하면 손만 늘어납니다.
 *   누가 언제 되돌렸는지는 order_status_history 에 그대로 남습니다.
 */
function needsReason(to: OrderStatus): boolean {
  return to === 'rescan' || to === 'cancelled';
}

export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  options: ChangeStatusOptions = {},
): Promise<ChangeStatusResult> {
  const { reason, labOrgId } = options;
  const session = await getSession();
  if (!session?.orgId || !session.orgType) {
    return { ok: false, error: '로그인이 필요합니다' };
  }

  const supabase = await createClient();

  // RLS 가 걸러주므로, 못 읽으면 볼 권한이 없는 주문입니다
  const { data: orderRow } = await supabase
    .from('orders')
    .select('id, status, clinic_org_id, design_org_id, lab_org_id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!orderRow) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const order = orderRow as unknown as {
    id: string;
    status: OrderStatus;
    clinic_org_id: string;
    design_org_id: string | null;
    lab_org_id: string | null;
  };

  const from = order.status;

  // ★ 이 주문에서 내가 맡은 자리들.
  //   통합 모델이라 한 조직이 두 자리를 겸할 수 있습니다 —
  //   자사 제작이면 디자인센터가 기공소 자리도 함께 맡습니다.
  const roles = rolesOf(order, session.orgId);
  if (roles.length === 0) {
    return { ok: false, error: '이 주문에 관여하지 않는 조직입니다' };
  }

  // ★ 화면에서 버튼을 숨기는 것은 UX 일 뿐입니다. 여기서 다시 검사합니다.
  //   맡은 자리 중 하나라도 허용하면 진행합니다.
  const verdicts = roles.map((role) => canTransition(from, to, role));
  if (!verdicts.some((v) => v.allowed)) {
    return { ok: false, error: verdicts[0].reason ?? '진행할 수 없습니다' };
  }

  if (needsReason(to) && !reason?.trim()) {
    return { ok: false, error: '사유를 입력해 주세요' };
  }

  // 디자인 파일 없이 제작대기로 넘길 수 없습니다
  if (requiresDesignFile(from, to)) {
    const { count } = await supabase
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .eq('kind', 'design')
      .is('deleted_at', null);

    if (!count) {
      return { ok: false, error: '디자인 파일을 올린 뒤에 제작대기로 넘길 수 있습니다' };
    }
  }

  // ★ 물건을 받기 전에 제작을 시작할 수 없습니다.
  //   리페어는 고칠 보철물이 기공소에 도착해야 손을 댈 수 있습니다.
  //   화면에서도 버튼을 가리지만, 여기서 한 번 더 막습니다.
  if (to === 'production') {
    const { count } = await supabase
      .from('pickup_requests')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .eq('status', 'open');

    if (count) {
      return {
        ok: false,
        error: '수거가 끝난 뒤에 제작을 시작할 수 있습니다',
      };
    }
  }

  // 제작대기로 넘길 때 기공소를 지정합니다 (Q-2)
  const patch: { status: OrderStatus; lab_org_id?: string; shipped_at?: string } = {
    status: to,
  };

  /**
   * ★ 배송으로 넘어간 시각을 남깁니다. 정산 기간을 가르는 기준입니다.
   *   요청시한은 바뀔 수 있지만 물건이 나간 날은 바뀌지 않습니다.
   *
   *   되돌아왔다 다시 배송되면 마지막 시각으로 덮습니다 — 실제로 나간
   *   날이 그날이기 때문입니다.
   */
  if (to === 'shipping') {
    patch.shipped_at = new Date().toISOString();
  }

  if (requiresLabAssignment(from, to)) {
    if (!labOrgId) {
      return { ok: false, error: '제작을 맡길 기공소를 골라 주세요' };
    }

    // ★ 자사 제작이면 자기 자신을 가리킵니다 (통합 조직 모델).
    //   이때는 거래 관계를 볼 것이 없습니다 — 지급도 발생하지 않습니다.
    const inHouse = labOrgId === session.orgId;

    if (!inHouse) {
      // ★ 화면이 보낸 조직 id 를 그대로 믿지 않습니다.
      //   내 거래 기공소가 맞는지 확인해야 남의 기공소에 일감을 꽂을 수 없습니다.
      const { data: partner } = await supabase
        .from('partnerships')
        .select('id')
        .eq('from_org_id', session.orgId)
        .eq('to_org_id', labOrgId)
        .eq('relation', 'design_lab')
        .eq('status', 'active')
        .maybeSingle();

      if (!partner) {
        return { ok: false, error: '거래 중인 기공소가 아닙니다' };
      }
    }

    patch.lab_org_id = labOrgId;
  }

  // status 를 조건에 넣어, 그 사이 남이 먼저 바꿨으면 아무것도 하지 않습니다
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update(patch)
    .eq('id', orderId)
    .eq('status', from)
    .select('id');

  if (updateError) {
    return { ok: false, error: `상태를 바꾸지 못했습니다: ${updateError.message}` };
  }

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: `다른 사용자가 먼저 상태를 바꿨습니다. 새로고침해 주세요`,
    };
  }

  // 이력은 실패해도 상태 변경을 되돌리지 않습니다.
  // 이력이 빠지는 것보다 상태가 어긋나는 쪽이 더 위험하기 때문입니다.
  await supabase.from('order_status_history').insert({
    order_id: orderId,
    from_status: from,
    to_status: to,
    actor_org_id: session.orgId,
    actor_user_id: session.user.id,
    reason: reason?.trim() || null,
  });

  // 이벤트 발행 · 알림 적재 (설계서 §3.4, §5.3 결정 5)
  await publishOrderStatusChanged({
    orderId,
    from,
    to,
    // 자사 제작 건이면 기공소 자리로 움직인 것입니다
    actorSector: verdicts.findIndex((v) => v.allowed) >= 0
      ? roles[verdicts.findIndex((v) => v.allowed)]
      : session.orgType,
    actorOrgId: session.orgId,
    actorUserId: session.user.id,
    reason: reason?.trim() || null,
  });

  return { ok: true, status: to };
}
