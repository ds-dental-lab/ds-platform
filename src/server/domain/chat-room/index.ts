// =========================================================
// 놓을 위치: src/server/domain/chat-room/index.ts
//
// 대화방 목록의 규칙. (사용자 요청 2026-09-06 — "카톡처럼 실시간으로 대응")
//
// ★ 대화방 = 주문 하나. 새로 만드는 표가 없습니다 — order_messages 를
//   주문별로 묶어 **마지막 글**만 세우면 그것이 카톡의 채팅방 목록입니다.
//   안 읽은 수는 notifications 의 미읽음(unreadChatByOrder)이 이미 셉니다.
//
// ★ 순수 함수만 둡니다. 시계는 밖에서 받습니다 (화면 안 Date 금지).
// =========================================================

/** 저장소가 내려주는 글 한 줄 — 최신순으로 옵니다 */
export interface ChatMessageRow {
  orderId: string;
  orderNo: string;
  patientLabel: string;
  /** 상대 조직 이름 — 치과가 보면 센터, 센터가 보면 치과 */
  counterpart: string;
  body: string;
  hasFile: boolean;
  authorName: string;
  /** 내 조직이 쓴 글인가 — 목록 미리보기에 '나:' 를 붙입니다 */
  mine: boolean;
  createdAt: string;
}

export interface ChatRoom {
  orderId: string;
  orderNo: string;
  patientLabel: string;
  counterpart: string;
  preview: string;
  lastAt: string;
  unread: number;
}

/** 미리보기 한 줄. 파일만 보낸 글은 '📎 파일' 로 보입니다 */
export function messagePreview(body: string, hasFile: boolean): string {
  const text = body.trim().replace(/\s+/g, ' ');
  if (text) return text;
  return hasFile ? '📎 파일' : '';
}

/**
 * 최신순 글 목록을 주문별 대화방으로 묶습니다.
 *
 * ★ 첫 등장이 곧 마지막 글입니다 — 입력이 최신순이라는 약속 위에 섭니다.
 * ★ 순서는 마지막 글 시각 내림차순 그대로입니다. 안 읽은 방을 위로
 *   끌어올리지 않습니다 — 카톡도 그렇고, 순서가 튀면 손가락이 헛디딥니다.
 */
export function groupChatRooms(
  rows: ChatMessageRow[],
  unread: Record<string, number>,
): ChatRoom[] {
  const seen = new Set<string>();
  const rooms: ChatRoom[] = [];

  for (const r of rows) {
    if (seen.has(r.orderId)) continue;
    seen.add(r.orderId);

    const preview = messagePreview(r.body, r.hasFile);
    rooms.push({
      orderId: r.orderId,
      orderNo: r.orderNo,
      patientLabel: r.patientLabel,
      counterpart: r.counterpart,
      preview: r.mine ? `나: ${preview}` : preview,
      lastAt: r.createdAt,
      unread: unread[r.orderId] ?? 0,
    });
  }

  return rooms;
}

/** 안 읽은 대화 전부 — 홈 카드의 숫자 */
export function sumUnread(unread: Record<string, number>): number {
  return Object.values(unread).reduce((a, b) => a + b, 0);
}

/**
 * 목록 오른쪽의 시각. 오늘이면 '14:05', 어제면 '어제', 그 전은 '9/4'.
 *
 * ★ 카톡과 같은 규칙입니다 — 날짜 전체를 적으면 폭이 좁은 폰에서
 *   환자 이름이 잘립니다.
 */
export function roomStamp(iso: string, now: Date): string {
  const d = new Date(iso);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, now)) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return '어제';

  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 목록에 실을 글의 상한 — 최근 대화방 수십 개면 충분합니다 */
export const ROOM_MESSAGE_LIMIT = 400;

/** 서버의 지금 — 화면(page)이 Date 를 직접 부르지 않게 여기서 읽습니다 */
export function nowIso(): string {
  return new Date().toISOString();
}
