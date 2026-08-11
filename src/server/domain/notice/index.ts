// =========================================================
// 놓을 위치: src/server/domain/notice/index.ts
//
// 공지사항 규칙. (사용자 결정 2026-08-12 — 디자인센터가 씁니다)
//
// ★ 쓰는 곳은 디자인센터 하나입니다.
//   치과가 치과에게, 기공소가 치과에게 하는 말은 공지가 아니라
//   그 주문의 대화입니다 (order_messages). 공지는 '위에서 아래로' 만
//   갑니다 — 그래야 아무도 안 읽는 게시판이 안 됩니다.
//
// ★ 받는 쪽을 고릅니다.
//   "이번 주 배송 일정" 은 치과에게, "재료 입고 지연" 은 기공소에게
//   가는 말입니다. 모두에게 보내는 버릇이 들면 아무도 안 읽습니다.
// =========================================================

import type { Sector } from '../order-status';

/** 누구에게 가는 말인가 */
export type NoticeAudience = 'all' | 'clinic' | 'lab';

export const AUDIENCE_LABEL: Record<NoticeAudience, string> = {
  all: '전체',
  clinic: '치과',
  lab: '기공소',
};

export const AUDIENCE_OPTIONS: NoticeAudience[] = ['all', 'clinic', 'lab'];

export const MAX_TITLE = 60;
export const MAX_BODY = 4000;

export type NoticeVerdict = { ok: true } | { ok: false; reason: string };

/**
 * 쓸 수 있는 글인가.
 *
 * ★ 제목을 60자로 자릅니다.
 *   HOME 카드와 사이드바 목록이 한 줄로 보여 줍니다. 길면 어차피
 *   잘려서, 뒷부분은 아무도 못 읽는데 쓴 사람만 썼다고 믿습니다.
 *
 * ★ 공백만 있는 글을 막습니다.
 *   스페이스 한 칸으로 제목을 채운 공지가 목록에서 빈 줄로 보입니다.
 */
export function checkNotice(title: string, body: string): NoticeVerdict {
  const t = title.trim();
  const b = body.trim();

  if (!t) return { ok: false, reason: '제목을 적어 주세요' };
  if (t.length > MAX_TITLE) return { ok: false, reason: `제목은 ${MAX_TITLE}자까지입니다` };
  if (!b) return { ok: false, reason: '내용을 적어 주세요' };
  if (b.length > MAX_BODY) return { ok: false, reason: `내용은 ${MAX_BODY}자까지입니다` };

  return { ok: true };
}

/**
 * 이 공지가 저 섹터에 보이는가.
 *
 * ★ DB 의 notice_select 정책과 같은 규칙입니다.
 *   여기서 한 번 더 거르는 것은 '두 곳에서 검사한다' 는 약속 때문입니다
 *   (설계서 §5.3 결정 2). 둘이 어긋나면 화면과 실제가 달라지므로
 *   고칠 때 반드시 같이 고쳐야 합니다.
 */
export function isVisibleTo(
  notice: { audience: NoticeAudience; publishedAt: string | null; deletedAt?: string | null },
  sector: Sector,
  authorOrg: boolean,
): boolean {
  // 쓴 조직은 임시저장까지 다 봅니다
  if (authorOrg) return true;

  if (notice.deletedAt) return false;
  if (!notice.publishedAt) return false;

  return notice.audience === 'all' || notice.audience === sector;
}

/** 목록에 쓰는 한 줄 */
export interface SortableNotice {
  isPinned: boolean;
  publishedAt: string | null;
  createdAt: string;
}

/**
 * 고정 먼저, 그 다음 최근 먼저.
 *
 * ★ 임시저장은 게시된 글보다 위입니다 (글쓴이 화면에서만 보입니다).
 *   쓰다 만 글이 목록 아래로 가라앉으면 영영 안 끝납니다.
 */
export function sortNotices<T extends SortableNotice>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (!a.publishedAt !== !b.publishedAt) return a.publishedAt ? 1 : -1;

    return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt);
  });
}
