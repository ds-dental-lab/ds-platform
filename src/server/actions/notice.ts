// =========================================================
// 놓을 위치: src/server/actions/notice.ts
//
// 공지 쓰기 · 고치기 · 지우기. 디자인센터만입니다.
//
// ★ 화면이 버튼을 숨기는 것과 서버가 안 받는 것은 다릅니다
//   (설계서 §5.3 결정 2). 여기서 한 번, DB 정책이 또 한 번 봅니다.
//
// ★ 게시와 임시저장을 한 곳에서 가릅니다.
//   published_at 에 값이 들어가는 순간 치과·기공소 화면에 나갑니다.
//   그 한 칸이 '나갔다/안 나갔다' 의 전부라, 다른 데서 손대지 않습니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { checkNotice, type NoticeAudience } from '@/server/domain/notice';

export interface NoticeInput {
  id?: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  isPinned: boolean;
  /** 게시할 것인가. false 면 임시저장 */
  publish: boolean;
}

export type NoticeResult = { ok: true; id: string } | { ok: false; error: string };

export async function submitNotice(input: NoticeInput): Promise<NoticeResult> {
  const session = await getSession();

  if (!session?.orgId || session.orgType !== 'design_center') {
    return { ok: false, error: '공지는 디자인센터만 쓸 수 있습니다' };
  }

  const verdict = checkNotice(input.title, input.body);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createClient();

  const fields = {
    title: input.title.trim(),
    body: input.body.trim(),
    audience: input.audience,
    is_pinned: input.isPinned,
  };

  if (input.id) {
    /*
      ★ 이미 나간 글의 게시 시각은 안 건드립니다.
        고칠 때마다 now() 로 덮어쓰면, 지난달 공지가 목록 맨 위로
        올라옵니다 — 오타 하나 고쳤을 뿐인데.
        내렸다가 다시 올릴 때만 새로 찍습니다.
    */
    const { data: before } = await supabase
      .from('notices')
      .select('published_at')
      .eq('id', input.id)
      .maybeSingle();

    const was = (before as { published_at: string | null } | null)?.published_at ?? null;

    const { data, error } = await supabase
      .from('notices')
      .update({
        ...fields,
        published_at: input.publish ? (was ?? new Date().toISOString()) : null,
      })
      .eq('id', input.id)
      .select('id');

    if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
    if (!data || data.length === 0) return { ok: false, error: '고칠 수 있는 공지가 아닙니다' };

    revalidateEverywhere();

    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from('notices')
    .insert({
      ...fields,
      org_id: session.orgId,
      created_by: session.user.id,
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: `저장하지 못했습니다: ${error?.message ?? '알 수 없는 오류'}` };
  }

  revalidateEverywhere();

  return { ok: true, id: (data as { id: string }).id };
}

export type DeleteNoticeResult = { ok: true } | { ok: false; error: string };

/**
 * 지웁니다 — 실제로는 deleted_at 을 세웁니다.
 *
 * ★ 무엇을 언제 공지했는지는 남아 있어야 합니다.
 *   "그런 안내 받은 적 없다" 는 말이 나올 때 근거가 되는 기록입니다.
 */
export async function removeNotice(id: string): Promise<DeleteNoticeResult> {
  const session = await getSession();

  if (!session?.orgId || session.orgType !== 'design_center') {
    return { ok: false, error: '공지는 디자인센터만 지울 수 있습니다' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '지울 수 있는 공지가 아닙니다' };

  revalidateEverywhere();

  return { ok: true };
}

/** 세 섹터가 같은 글을 봅니다 — HOME 카드까지 함께 새로 그립니다 */
function revalidateEverywhere() {
  for (const path of ['/design', '/clinic', '/lab']) {
    revalidatePath(path);
    revalidatePath(`${path}/notices`);
  }
}
