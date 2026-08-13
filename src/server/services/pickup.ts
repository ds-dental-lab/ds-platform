// =========================================================
// 놓을 위치: src/server/services/pickup.ts
//
// 수거 처리. (설계서 §4.6 pickup_requests, Q-4)
//   치과가 요청하고 기공소가 처리합니다.
//
// ★ 수거완료를 눌렀다는 것은 물건을 실제로 받아봤다는 뜻입니다.
//   그래서 여기서 멈추지 않고 곧바로 제작 단계로 넘깁니다.
//   그 다음부터는 기존 흐름(제작 → 배송 → 완료)을 그대로 탑니다.
//
//   수거만 완료하고 제작은 따로 눌러야 한다면, 기공소는 같은 건을 두 번
//   눌러야 합니다. 실제로 물건을 받은 시점이 곧 제작 시작 시점입니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { changeOrderStatus } from '@/server/services/order-status';
import { canCompletePickup, PENDING_PICKUP } from '@/server/domain/pickup';

export type PickupResult =
  | { ok: true; movedToProduction: boolean }
  | { ok: false; error: string };

/**
 * 수거를 끝냅니다.
 *
 * 물건을 받았으므로 연결된 주문을 제작으로 넘깁니다.
 * 제작대기가 아닌 주문(이미 제작 중이거나 모델만 수거한 경우)은
 * 상태를 건드리지 않고 수거만 닫습니다.
 */
export async function completePickup(pickupId: string): Promise<PickupResult> {
  const session = await getSession();
  if (!session?.orgId) {
    return { ok: false, error: '로그인이 필요합니다' };
  }

  const supabase = await createClient();

  const { data: pickup } = await supabase
    .from('pickup_requests')
    .select('id, order_id, status, lab_org_id')
    .eq('id', pickupId)
    .maybeSingle();

  if (!pickup) return { ok: false, error: '수거요청을 찾을 수 없습니다' };

  /*
    ★ 조직의 종류가 아니라 **이 주문에서 맡은 자리**로 봅니다
      (사용자 지적 2026-08-13).

      전에는 `orgType === 'lab'` 이었습니다. 그런데 자사 제작이면
      디자인센터가 기공소 자리를 겸합니다 — 물건은 디자인센터가 받는데
      계정 종류 때문에 **아무도 수거완료를 못 눌렀습니다.** 수거가 안
      닫히면 제작 시작도 막히므로 그 주문은 그대로 굳습니다.

      치과는 여기서 걸립니다. 물건을 보내는 쪽이라 lab_org_id 가 될 일이
      없습니다 — 보내는 쪽이 도착을 선언하면 그 기록은 값이 없습니다.
  */
  if (
    !canCompletePickup({
      viewerOrgId: session.orgId,
      labOrgId: pickup.lab_org_id as string | null,
      pickupStatus: pickup.status as string,
    })
  ) {
    if (pickup.status !== 'open' && pickup.status !== 'assigned') {
      return { ok: false, error: '이미 처리된 수거요청입니다' };
    }
    if (!pickup.lab_org_id) {
      return { ok: false, error: '기공소가 배정되어야 수거를 처리할 수 있습니다' };
    }
    return { ok: false, error: '이 건을 받는 기공소만 수거를 처리할 수 있습니다' };
  }

  // status 를 조건에 넣어, 그 사이 남이 먼저 눌렀으면 아무것도 하지 않습니다
  const { data: updated, error: updateError } = await supabase
    .from('pickup_requests')
    .update({ status: 'done', handled_at: new Date().toISOString() })
    .eq('id', pickupId)
    .in('status', PENDING_PICKUP)
    .select('id');

  if (updateError) {
    return { ok: false, error: `수거를 처리하지 못했습니다: ${updateError.message}` };
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: '다른 사용자가 먼저 처리했습니다. 새로고침해 주세요' };
  }

  if (!pickup.order_id) return { ok: true, movedToProduction: false };

  // 이 주문에 아직 안 끝난 수거가 남아 있으면 제작으로 넘기지 않습니다
  const { count: stillOpen } = await supabase
    .from('pickup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', pickup.order_id)
    .in('status', PENDING_PICKUP);

  if (stillOpen) return { ok: true, movedToProduction: false };

  const { data: order } = await supabase
    .from('orders')
    .select('status')
    .eq('id', pickup.order_id)
    .maybeSingle();

  if (order?.status !== 'production_wait') {
    return { ok: true, movedToProduction: false };
  }

  // ★ 상태 변경은 반드시 단일 진입점을 지납니다 (설계서 §5.3 결정 5).
  //   여기서 orders 를 직접 update 하면 이력과 알림이 빠집니다.
  const moved = await changeOrderStatus(pickup.order_id, 'production');

  if (!moved.ok) {
    // 수거는 이미 닫혔습니다. 되돌리지 않고 알려만 줍니다 —
    // 물건을 받은 사실 자체는 맞기 때문입니다.
    return { ok: false, error: `수거는 처리했지만 제작으로 넘기지 못했습니다: ${moved.error}` };
  }

  return { ok: true, movedToProduction: true };
}
