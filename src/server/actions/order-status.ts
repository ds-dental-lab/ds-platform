// =========================================================
// 놓을 위치: src/server/actions/order-status.ts
//
// 기공소 배정. 상태를 넘기지 않고 '누가 만들 것인가' 만 정합니다.
//
// ★ 제작주문을 누를 때 함께 보내지 않고 미리 정해 둡니다.
//   전에는 버튼을 눌러야 기공소를 묻는 창이 떴습니다. 그러면
//   "지금 이 주문은 누가 만드는가" 를 화면에서 알 수 없습니다.
//   주문상세 아래 칸에서 골라 두면 언제든 보입니다.
//
// ★ 디자인 단계까지만 바꿉니다.
//   제작대기로 넘어가면 기공소는 이미 일을 받았습니다.
//   그 뒤에 바꾸면 두 곳이 같은 물건을 만듭니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import type { OrderStatus } from '@/server/domain/order-status';
import { checkAssign, assignable } from '@/server/domain/designer';
import { canManageMembers, type MemberRole } from '@/server/domain/member';

export type AssignLabResult = { ok: true } | { ok: false; error: string };

/** 배정을 바꿀 수 있는 상태. 넘긴 뒤에는 못 바꿉니다 */
const ASSIGNABLE: OrderStatus[] = ['received', 'rescan', 'designing'];

export async function submitAssignLab(
  orderId: string,
  labOrgId: string,
): Promise<AssignLabResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, error: '디자인센터만 기공소를 정할 수 있습니다' };
  }

  if (!labOrgId) return { ok: false, error: '기공소를 골라 주세요' };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('status, design_org_id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  const found = order as { status: OrderStatus; design_org_id: string | null } | null;
  if (!found) return { ok: false, error: '주문을 찾을 수 없습니다' };

  if (found.design_org_id !== session.orgId) {
    return { ok: false, error: '이 주문의 디자인센터가 아닙니다' };
  }

  if (!ASSIGNABLE.includes(found.status)) {
    return { ok: false, error: '이미 제작으로 넘어가 기공소를 바꿀 수 없습니다' };
  }

  // ★ 자사 제작이면 자기 자신입니다 (통합 조직 모델). 거래 관계를 볼 것이 없습니다
  if (labOrgId !== session.orgId) {
    // 화면이 보낸 id 를 믿지 않습니다 — 남의 기공소에 일감을 꽂을 수 없어야 합니다
    const { data: partner } = await supabase
      .from('partnerships')
      .select('id')
      .eq('from_org_id', session.orgId)
      .eq('to_org_id', labOrgId)
      .eq('relation', 'design_lab')
      .eq('status', 'active')
      .maybeSingle();

    if (!partner) return { ok: false, error: '거래 중인 기공소가 아닙니다' };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ lab_org_id: labOrgId })
    .eq('id', orderId)
    .select('id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  // RLS 는 오류가 아니라 0행으로 막습니다
  if (!data || data.length === 0) return { ok: false, error: '바꿀 수 있는 주문이 아닙니다' };

  revalidatePath(`/design/orders/${orderId}`);
  revalidatePath('/design/orders', 'layout');
  revalidatePath('/lab/orders', 'layout');

  return { ok: true };
}

// ---------- 담당 디자이너 ----------

export type AssignDesignerResult = { ok: true } | { ok: false; error: string };

/**
 * 담당 디자이너를 정하거나 비웁니다.
 * (사용자 결정 2026-08-12 — "두명의 디자이너가 한 주문을 하면 안되잖아")
 *
 * ★ 보통은 이 함수를 안 부릅니다.
 *   디자인을 잡는 순간 changeOrderStatus 가 알아서 배정합니다. 여기는
 *   **넘겨주는 길**입니다 — 담당자가 자리를 비웠거나, 잘못 잡았을 때.
 *
 * ★ 화면이 보낸 사람 id 를 믿지 않습니다.
 *   우리 디자인센터에 살아 있는 사람인지 확인합니다. 안 그러면 남의
 *   조직 사람에게 우리 주문을 붙일 수 있습니다.
 */
export async function submitAssignDesigner(
  orderId: string,
  designerUserId: string | null,
): Promise<AssignDesignerResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, error: '디자인센터만 담당을 정할 수 있습니다' };
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('status, design_org_id, designer_user_id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  const found = order as {
    status: OrderStatus;
    design_org_id: string | null;
    designer_user_id: string | null;
  } | null;

  if (!found) return { ok: false, error: '주문을 찾을 수 없습니다' };

  if (found.design_org_id !== session.orgId) {
    return { ok: false, error: '이 주문의 디자인센터가 아닙니다' };
  }

  if (!assignable(found.status)) {
    return { ok: false, error: '끝난 주문의 담당은 바꿀 수 없습니다' };
  }

  // 넘길 상대가 우리 사람인지 — 화면이 보낸 id 를 그대로 쓰지 않습니다
  if (designerUserId) {
    const { data: seat } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('user_id', designerUserId)
      .eq('org_id', session.orgId)
      .eq('is_active', true)
      .maybeSingle();

    if (!seat) return { ok: false, error: '우리 디자인센터 사람이 아닙니다' };
  }

  const name = await currentDesignerName(supabase, found.designer_user_id);

  const verdict = checkAssign(
    { designerId: found.designer_user_id, designerName: name },
    { userId: session.user.id, isManager: canManageMembers(session.role as MemberRole | null) },
    designerUserId,
  );

  if (!verdict.ok) return { ok: false, error: verdict.reason };

  /*
    ★ 지금 담당을 조건에 넣습니다.
      읽고 나서 누르기까지 사이에 남이 먼저 잡았으면, 그 사람을 조용히
      덮어쓰지 않고 아무것도 하지 않습니다. 트리거가 또 한 번 봅니다.
  */
  let query = supabase.from('orders').update({ designer_user_id: designerUserId }).eq('id', orderId);

  query = found.designer_user_id
    ? query.eq('designer_user_id', found.designer_user_id)
    : query.is('designer_user_id', null);

  const { data, error } = await query.select('id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '그 사이 담당이 바뀌었습니다. 새로고침해 주세요' };
  }

  revalidatePath(`/design/orders/${orderId}`);
  revalidatePath('/design/orders', 'layout');
  revalidatePath('/design');

  return { ok: true };
}

async function currentDesignerName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
): Promise<string> {
  if (!userId) return '';

  const { data } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', userId)
    .maybeSingle();

  return (data as { name: string | null } | null)?.name ?? '';
}
