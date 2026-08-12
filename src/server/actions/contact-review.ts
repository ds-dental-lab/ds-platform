// =========================================================
// 놓을 위치: src/server/actions/contact-review.ts
//
// 들어온 문의를 처리했다고 표시합니다. 디자인센터 관리자만.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { canManageMembers, type MemberRole } from '@/server/domain/member';

export type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * ★ 지우지 않고 '처리함' 으로 옮깁니다.
 *   지우면 그 치과가 언제 연락했는지가 사라집니다. 나중에 다시
 *   문의가 오면 "전에도 오셨네요" 를 알 수 있어야 합니다.
 */
export async function submitContactDone(id: string, memo: string): Promise<ReviewResult> {
  const session = await getSession();

  if (session?.orgType !== 'design_center' || !canManageMembers(session.role as MemberRole | null)) {
    return { ok: false, error: '디자인센터 관리자만 처리할 수 있습니다' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contact_requests')
    .update({
      status: 'done',
      handled_by: session.user.id,
      handled_at: new Date().toISOString(),
      memo: memo.trim() || null,
    })
    .eq('id', id)
    .eq('status', 'new')
    .select('id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '이미 처리된 문의입니다' };

  revalidatePath('/design/contacts');
  revalidatePath('/design', 'layout');

  return { ok: true };
}
