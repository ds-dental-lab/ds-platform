// =========================================================
// 놓을 위치: src/server/domain/signal/index.ts
//
// 실시간 신호의 약속. (사용자 요청 2026-08-19 —
//   "치과계정에서 대화창이 새로고침없이 카톡처럼 실시간으로")
//
// ★ 채널에는 **내용을 싣지 않습니다.**
//   "이 주문에 무언가 바뀌었다" — 그게 전부입니다. 받은 쪽은 평소의
//   길(서버 → RLS)로 다시 읽습니다. 메시지 본문이 채널로 지나가면
//   환자 이야기가 RLS 밖 길로 다니게 됩니다. 신호만 흘리면 새는 자리가
//   구조적으로 없습니다.
//
// ★ 신호는 '빠른 길' 이지 '반드시 오는 길' 이 아닙니다.
//   Realtime 연결은 조용히 끊깁니다 (와이파이 전환, 절전). 그래서
//   폴링(AutoRefresh)을 지우지 않고 그대로 둡니다 — 신호가 끊겨도
//   최대 20초 늦을 뿐 잃는 것이 없습니다.
//
// ★ 채널 이름 규칙이 곧 권한 규칙입니다.
//   `order:{uuid}` 하나뿐입니다. DB 의 realtime.messages 정책이 이
//   이름을 쪼개 can_access_order 로 묻습니다 — 주문의 세 자리(치과·
//   디자인센터·기공소)가 아니면 구독 자체가 거절됩니다. 여기의 모양
//   검사(UUID_RE)와 마이그레이션의 정규식은 **같은 것**이어야 합니다.
// =========================================================

/** 채널에 흘리는 사건 이름. 종류를 늘리지 않습니다 — '바뀌었다' 하나면 됩니다 */
export const ORDER_SIGNAL_EVENT = 'changed';

/**
 * 신호를 받고 나서 최소 이만큼 쉽니다.
 *
 * ★ 대화가 몰릴 때 신호마다 화면을 다시 그리면, 서너 명이 연달아
 *   쓰는 순간 refresh 가 줄줄이 쌓입니다. 쉬는 동안 온 신호는
 *   **하나로 뭉쳐** 끝나고 한 번만 그립니다.
 */
export const SIGNAL_COOLDOWN_MS = 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 주문 하나의 채널 이름 */
export function orderTopic(orderId: string): string {
  return `order:${orderId}`;
}

/**
 * 채널 이름에서 주문 id 를 꺼냅니다. 모양이 아니면 null.
 *
 * ★ DB 정책과 같은 검사입니다. 화면 쪽이 더 느슨하면
 *   "구독은 했는데 DB 가 거절" 하는 어긋남이 생깁니다.
 */
export function orderIdFromTopic(topic: string): string | null {
  if (!topic.startsWith('order:')) return null;

  const id = topic.slice('order:'.length);
  return UUID_RE.test(id) ? id : null;
}

/**
 * 신호가 왔을 때 지금 그릴까, 얼마나 기다릴까.
 *
 * 0 이면 지금 그립니다. 양수면 그만큼 기다렸다가 그립니다 —
 * 기다리는 동안 또 신호가 와도 예약은 하나면 됩니다.
 */
export function refreshDelay(
  lastRefreshAt: number | null,
  now: number,
  cooldownMs: number = SIGNAL_COOLDOWN_MS,
): number {
  if (lastRefreshAt === null) return 0;

  const since = now - lastRefreshAt;
  return since >= cooldownMs ? 0 : cooldownMs - since;
}
