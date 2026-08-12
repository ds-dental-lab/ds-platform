// =========================================================
// 놓을 위치: src/server/repositories/repair.ts
//
// 주문상세의 리페어 칸이 읽는 것. (사용자 요청 2026-08-13 —
//   "리페어 이슈가 달린 주문 클릭 시 리페어 내용을 상세페이지에서도
//    확인할수 있게 해줘")
//
// ★ 리페어는 주문이 둘입니다.
//   고쳐 달라고 새로 만들어진 주문(이것이 리페어 건)과, 원래의 주문.
//   화면을 여는 사람은 둘 중 어느 쪽에서든 들어옵니다. 그래서 양쪽을
//   서로 가리키게 합니다 — 한 쪽에서만 보이면 "이게 무슨 리페어지" 를
//   찾으러 목록으로 되돌아가야 합니다.
//
// ★ 내용은 order_issues.reason 을 먼저 봅니다.
//   신청할 때 적은 그 글이 딱지의 근거이자 기공소가 읽는 내용입니다.
//   지난 건이라 비어 있으면 주문의 notes 로 물러섭니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/server/domain/order-status';

/** 이 주문이 고치려는 원주문 */
export interface RepairParent {
  id: string;
  orderNo: string;
  status: OrderStatus;
  dueDate: string;
}

/** 이 주문에서 갈라져 나간 리페어 건 */
export interface RepairChild {
  id: string;
  orderNo: string;
  status: OrderStatus;
  dueDate: string;
  notes: string;
  createdAt: string;
}

export interface RepairContext {
  /** 이 주문 자신이 리페어일 때, 신청할 때 적은 내용 */
  reason: string;
  /** 언제 신청됐나 (ISO) */
  openedAt: string | null;
  /** 고치려는 원주문. 지워졌거나 볼 수 없으면 null */
  parent: RepairParent | null;
  /** 이 주문에서 갈라져 나간 리페어들. 최근 먼저 */
  children: RepairChild[];
}

const EMPTY: RepairContext = { reason: '', openedAt: null, parent: null, children: [] };

/**
 * 리페어 칸에 채울 것.
 *
 * ★ 안쪽 셋을 **동시에** 보냅니다. 서로의 결과를 하나도 안 씁니다.
 *   주문상세는 이미 여러 곳을 읽으므로, 부르는 쪽에서도 이 함수를
 *   기존 Promise.all 에 함께 넣어야 왕복이 안 늘어납니다.
 *
 * ★ 리페어가 아닌 주문에서는 앞의 둘을 아예 안 묻습니다.
 *   갈라져 나간 리페어가 있는지는 물어봐야 알 수 있어 그것만 봅니다.
 */
export async function getRepairContext(order: {
  id: string;
  is_repair: boolean;
  parent_order_id: string | null;
  notes: string | null;
}): Promise<RepairContext> {
  const supabase = await createClient();

  const [issue, parent, children] = await Promise.all([
    order.is_repair ? findIssue(supabase, order.id) : Promise.resolve(null),
    order.is_repair && order.parent_order_id
      ? findParent(supabase, order.parent_order_id)
      : Promise.resolve(null),
    findChildren(supabase, order.id),
  ]);

  if (!order.is_repair && children.length === 0) return EMPTY;

  return {
    // 신청할 때 적은 글 → 없으면 주문에 적힌 요청사항
    reason: issue?.reason?.trim() || order.notes?.trim() || '',
    openedAt: issue?.opened_at ?? null,
    parent,
    children,
  };
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function findIssue(
  supabase: Client,
  orderId: string,
): Promise<{ reason: string | null; opened_at: string } | null> {
  const { data } = await supabase
    .from('order_issues')
    .select('reason, opened_at')
    .eq('order_id', orderId)
    .eq('issue_type', 'repair')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { reason: string | null; opened_at: string } | null) ?? null;
}

async function findParent(supabase: Client, parentId: string): Promise<RepairParent | null> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_no, status, due_date')
    .eq('id', parentId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    id: string;
    order_no: string;
    status: OrderStatus;
    due_date: string;
  };

  return { id: row.id, orderNo: row.order_no, status: row.status, dueDate: row.due_date };
}

async function findChildren(supabase: Client, orderId: string): Promise<RepairChild[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_no, status, due_date, notes, created_at')
    .eq('parent_order_id', orderId)
    .eq('is_repair', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  type Raw = {
    id: string;
    order_no: string;
    status: OrderStatus;
    due_date: string;
    notes: string | null;
    created_at: string;
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    orderNo: row.order_no,
    status: row.status,
    dueDate: row.due_date,
    notes: row.notes ?? '',
    createdAt: row.created_at,
  }));
}
