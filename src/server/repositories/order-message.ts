// =========================================================
// 놓을 위치: src/server/repositories/order-message.ts
//
// 주문별 대화. 치과 · 디자인센터 · 기공소 셋이 함께 봅니다.
// 누가 볼 수 있는지는 RLS 가 정합니다 (order_message_select).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import type { Sector } from '@/server/domain/order-status';

export interface OrderMessage {
  id: string;
  body: string;
  authorName: string;
  authorSector: Sector;
  createdAt: string;
  editedAt: string | null;
  /** 내가 쓴 글인가 — 오른쪽에 붙여 그립니다 */
  mine: boolean;
  /** 내가 고치고 지울 수 있는가 (글쓴이 본인 또는 디자인센터) */
  canManage: boolean;
}

interface RawMessage {
  id: string;
  body: string;
  author_org_id: string;
  author_name: string;
  author_sector: Sector;
  created_at: string;
  edited_at: string | null;
}

export async function listOrderMessages(orderId: string): Promise<OrderMessage[]> {
  const supabase = await createClient();
  const session = await getSession();

  const { data, error } = await supabase
    .from('order_messages')
    .select('id, body, author_org_id, author_name, author_sector, created_at, edited_at')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('created_at');

  if (error || !data) return [];

  const myOrgId = session?.orgId ?? null;

  // ★ 디자인센터는 남의 글도 정리합니다 (사용자 결정 2026-08-11).
  //   가운데에서 조율하는 자리라 잘못 적힌 글을 치울 수 있어야 합니다.
  //   실제 차단은 RLS 가 하고, 여기서는 버튼을 보일지만 정합니다.
  const isDesign = session?.orgType === 'design_center';

  return (data as unknown as RawMessage[]).map((row) => ({
    id: row.id,
    body: row.body,
    authorName: row.author_name,
    authorSector: row.author_sector,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    mine: row.author_org_id === myOrgId,
    canManage: row.author_org_id === myOrgId || isDesign,
  }));
}
