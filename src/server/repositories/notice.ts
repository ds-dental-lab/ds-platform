// =========================================================
// 놓을 위치: src/server/repositories/notice.ts
//
// 공지사항 조회.
//
// ★ 누가 무엇을 보는지는 RLS 가 정합니다 (notice_select).
//   쓴 조직은 임시저장까지, 읽는 쪽은 '게시됐고 · 안 지워졌고 · 나에게 온'
//   것만 돌아옵니다. 여기서 조건을 다시 적으면 두 곳이 어긋납니다.
//
//   다만 **지운 글**은 조회가 거릅니다 — 쓴 조직에게는 RLS 가 그것도
//   주기 때문입니다 (무엇을 언제 공지했는지는 남아 있어야 해서).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { sortNotices, type NoticeAudience } from '@/server/domain/notice';

export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  isPinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  authorName: string;
}

interface RawNotice {
  id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
  org: { name: string } | null;
}

const COLUMNS =
  'id, title, body, audience, is_pinned, published_at, created_at, ' +
  'org:organizations!notices_org_id_fkey(name)';

/**
 * 볼 수 있는 공지 전부. 고정 먼저, 최근 먼저.
 *
 * ★ 차례는 화면이 아니라 domain 이 정합니다 (sortNotices).
 *   DB 의 order by 로만 두면 '임시저장이 게시된 글보다 위' 같은 규칙을
 *   테스트로 잠글 수 없습니다.
 */
export async function listNotices(limit?: number): Promise<NoticeRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notices')
    .select(COLUMNS)
    .is('deleted_at', null)
    .order('published_at', { ascending: false, nullsFirst: true })
    .limit(limit ?? 100);

  if (error || !data) return [];

  const rows = (data as unknown as RawNotice[]).map(toRow);

  return limit ? sortNotices(rows).slice(0, limit) : sortNotices(rows);
}

/** 고쳐 쓰려고 한 건만 */
export async function getNotice(id: string): Promise<NoticeRow | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('notices')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  return data ? toRow(data as unknown as RawNotice) : null;
}

function toRow(raw: RawNotice): NoticeRow {
  return {
    id: raw.id,
    title: raw.title,
    body: raw.body,
    audience: raw.audience,
    isPinned: raw.is_pinned,
    publishedAt: raw.published_at,
    createdAt: raw.created_at,
    authorName: raw.org?.name ?? '',
  };
}
