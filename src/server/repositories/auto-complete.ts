// =========================================================
// 놓을 위치: src/server/repositories/auto-complete.ts
//
// 요청시한이 된 제작·배송 건을 '완료' 로 넘깁니다 (사용자 요청 2026-10-01).
// 아침 9시(KST)에 DB 시계가 /api/jobs/auto-complete 를 부릅니다.
//
// ★ 배송 시각(shipped_at)이 비어 있으면 **지금으로 채웁니다** — 정산이 그 시각으로
//   달을 가릅니다. 안 채우면 완료됐는데 영원히 청구가 안 되는 주문이 생깁니다.
// ★ 이미 마감한 기간에는 금액을 못 넣습니다. 그래서 날짜를 소급해 적지 않습니다
//   (domain/auto-complete 의 shippedAtFor).
// ★ 누가 넘겼는지는 order_status_history 에 사람 없이(시계) 남습니다.
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayInKst } from '@/server/domain/week';
import { AUTO_COMPLETE_FROM, shippedAtFor } from '@/server/domain/auto-complete';

export interface AutoCompleteResult {
  /** 오늘(한국 날짜) 기준 */
  today: string;
  /** 완료로 넘긴 건수 */
  completed: number;
  /** 그중 배송 시각을 새로 적은 건수 (배송 버튼을 안 누른 것들) */
  shippedStamped: number;
  orderNos: string[];
}

const BATCH = 200;

export async function runAutoComplete(now: Date = new Date()): Promise<AutoCompleteResult> {
  const admin = createAdminClient();
  const today = todayInKst(now);

  const { data } = await admin
    .from('orders')
    .select('id, order_no, status, due_date, shipped_at')
    .in('status', AUTO_COMPLETE_FROM)
    .not('due_date', 'is', null)
    .lte('due_date', today)
    .is('deleted_at', null)
    .limit(BATCH);

  const rows = (data ?? []) as {
    id: string;
    order_no: string;
    status: 'production' | 'shipping';
    due_date: string;
    shipped_at: string | null;
  }[];

  const result: AutoCompleteResult = { today, completed: 0, shippedStamped: 0, orderNos: [] };

  for (const row of rows) {
    const shippedAt = shippedAtFor(row.shipped_at, now);

    const { error } = await admin
      .from('orders')
      .update({ status: 'completed', shipped_at: shippedAt })
      .eq('id', row.id)
      /*
        ★ 그 사이에 사람이 손댔으면 건너뜁니다 — 상태가 그대로일 때만 바꿉니다.
          (치과가 방금 완료를 눌렀거나, 센터가 재스캔으로 되돌렸을 수 있습니다)
      */
      .eq('status', row.status);

    if (error) continue;

    result.completed += 1;
    if (!row.shipped_at) result.shippedStamped += 1;
    result.orderNos.push(row.order_no);

    // 이력은 실패해도 상태를 되돌리지 않습니다 (services/order-status 와 같은 판단)
    await admin.from('order_status_history').insert({
      order_id: row.id,
      from_status: row.status,
      to_status: 'completed',
      actor_org_id: null,
      actor_user_id: null,
      reason: `요청시한(${row.due_date}) 도달 — 자동 완료`,
    });
  }

  return result;
}
