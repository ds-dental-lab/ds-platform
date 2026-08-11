// =========================================================
// 놓을 위치: src/server/actions/order-message.ts
//
// 주문별 대화 — 쓰기 · 고치기 · 지우기.
// 실제 차단은 RLS 가 합니다 (order_message_* 정책).
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export type MessageResult = { ok: true } | { ok: false; error: string };

const MAX_LENGTH = 200;

function checkBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return '내용을 입력해 주세요';
  if (trimmed.length > MAX_LENGTH) return `${MAX_LENGTH}자까지 쓸 수 있습니다`;
  return null;
}

/** 세 섹터의 상세 화면이 같은 주문을 보므로 전부 다시 그립니다 */
function refreshAll() {
  revalidatePath('/clinic/orders', 'layout');
  revalidatePath('/design/orders', 'layout');
  revalidatePath('/lab/orders', 'layout');
}

export async function submitOrderMessage(
  orderId: string,
  body: string,
): Promise<MessageResult> {
  const session = await getSession();
  if (!session?.orgId || !session.orgType) {
    return { ok: false, error: '소속 조직이 있어야 글을 쓸 수 있습니다' };
  }

  const problem = checkBody(body);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  const { error } = await supabase.from('order_messages').insert({
    order_id: orderId,
    author_org_id: session.orgId,
    author_user_id: session.user.id,
    author_name: session.orgName ?? '',
    author_sector: session.orgType,
    body: body.trim(),
  });

  if (error) return { ok: false, error: `보내지 못했습니다: ${error.message}` };

  refreshAll();
  return { ok: true };
}

export async function submitEditOrderMessage(
  messageId: string,
  body: string,
): Promise<MessageResult> {
  const problem = checkBody(body);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_messages')
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select('id');

  if (error) return { ok: false, error: `고치지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '고칠 수 있는 글이 아닙니다' };
  }

  refreshAll();
  return { ok: true };
}

/**
 * 지우기.
 *
 * ★ 행을 없애지 않고 deleted_at 만 채웁니다.
 *   RLS 의 select 가 deleted_at is null 로 걸러 화면에서는 사라지고,
 *   "누가 무엇을 지웠나" 는 남습니다.
 */
export async function submitDeleteOrderMessage(messageId: string): Promise<MessageResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select('id');

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '지울 수 있는 글이 아닙니다' };
  }

  refreshAll();
  return { ok: true };
}
