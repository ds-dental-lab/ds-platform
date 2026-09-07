// =========================================================
// 놓을 위치: src/app/(mobile)/m/chats/page.tsx
//
// 폰 — 대화방 목록. 치과·센터 둘 다. (사용자 요청 2026-09-06)
//
// ★ 뒤로 가는 곳이 다릅니다 — 센터는 '처리할 일', 치과는 '쉐이드 촬영'.
//   둘 다 /m 이지만 이름을 맞춰 적어야 어디로 가는지 압니다.
// =========================================================

import { requireSession } from '@/server/policies/session';
import { listChatRooms } from '@/server/repositories/chat-room';
import { nowIso } from '@/server/domain/chat-room';
import MobileChatList from '@/components/chat/MobileChatList';

export const dynamic = 'force-dynamic';
export const metadata = { title: '대화' };

export default async function MobileChatsPage() {
  const session = await requireSession();
  const rooms = await listChatRooms();

  return (
    <MobileChatList
      rooms={rooms}
      now={nowIso()}
      backHref="/m"
      backLabel={session.orgType === 'design_center' ? '처리할 일' : '쉐이드 촬영'}
    />
  );
}
