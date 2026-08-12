// =========================================================
// 놓을 위치: src/server/actions/order-delete.ts
//
// 주문 삭제.
//
// ★ 행을 없애지 않고 deleted_at 만 채웁니다.
//   주문에는 파일·항목·이력·대화가 매달려 있어 실제로 지우면
//   "왜 사라졌는지" 를 아무도 못 찾습니다. 조회 쪽은 이미 전부
//   deleted_at is null 로 거르고 있어 화면에서는 사라집니다.
//
// ★ 화면이 버튼을 감춰도 여기서 다시 봅니다. (설계서 §5.3 결정 2)
//   버튼을 숨기는 건 UX 이고, 막는 건 서버와 RLS 입니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { canDeleteOrder, STATUS_LABEL, type OrderStatus } from '@/server/domain/order-status';

export type DeleteOrderResult = { ok: true } | { ok: false; error: string };

export async function submitDeleteOrder(orderId: string): Promise<DeleteOrderResult> {
  const session = await getSession();

  // 기공소는 남이 낸 주문서를 지울 자리가 아닙니다
  if (session?.orgType !== 'clinic' && session?.orgType !== 'design_center') {
    return { ok: false, error: '치과와 디자인센터만 주문을 지울 수 있습니다' };
  }

  const supabase = await createClient();

  // RLS 가 이미 관련 조직만 읽게 해 줍니다 — 여기서는 상태만 다시 봅니다
  const { data: order } = await supabase
    .from('orders')
    .select('status, is_remake, parent_order_id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!order) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const status = order.status as OrderStatus;
  /*
    ★ 디자인센터는 단계를 안 가립니다 (사용자 결정 2026-08-12).
      화면에서 버튼을 보여 주는 것과 별개로 여기서 다시 봅니다.
  */
  if (!canDeleteOrder(status, session.orgType ?? undefined)) {
    return {
      ok: false,
      error: `${STATUS_LABEL[status]} 단계에서는 지울 수 없습니다. 이미 작업이 시작된 주문입니다`,
    };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('deleted_at', null)
    .select('id');

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '지울 수 있는 주문이 아닙니다' };
  }

  // 리메이크였다면 원주문에 남긴 흔적을 되돌립니다
  if (order.is_remake && order.parent_order_id) {
    await rollbackParent(supabase, order.parent_order_id as string);
  }

  revalidatePath('/clinic', 'layout');
  revalidatePath('/clinic/orders', 'layout');
  revalidatePath('/design', 'layout');
  revalidatePath('/design/orders', 'layout');
  revalidatePath('/lab/orders', 'layout');

  return { ok: true };
}

/**
 * 리메이크를 지운 뒤 원주문 되돌리기.
 *
 * ★ 빼지 않고 다시 셉니다.
 *   remake_count 를 1 씩 깎으면 어딘가에서 한 번 어긋났을 때 영영 틀립니다.
 *   살아 있는 리메이크를 세어 그 값으로 덮으면 셀 때마다 제자리를 찾습니다.
 *
 * ★ 리메이크가 하나도 안 남으면 이슈도 내립니다.
 *   원주문이 '리메이크' 로 계속 걸려 있으면 HOME 의 진행중 이슈와
 *   목록 필터에 계속 잡힙니다 — 실제로는 다시 만든 적이 없는데도.
 */
async function rollbackParent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
): Promise<void> {
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('parent_order_id', parentId)
    .eq('is_remake', true)
    .is('deleted_at', null);

  const live = count ?? 0;

  await supabase.from('orders').update({ remake_count: live }).eq('id', parentId);

  if (live === 0) {
    await supabase
      .from('order_issues')
      .update({ resolved_at: new Date().toISOString() })
      .eq('order_id', parentId)
      .eq('issue_type', 'remake')
      .is('resolved_at', null);
  }
}
