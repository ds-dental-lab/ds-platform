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
