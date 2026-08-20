// =========================================================
// 놓을 위치: src/components/home/UnreadChatStrip.tsx
//
// HOME 맨 위의 안 읽은 대화 띠 — **읽어 오는 부분.**
// (사용자 요청 2026-08-19 — "확실하게 알림을 줄 수 있는 게 필요해 보여"
//  → 보완 2026-08-19 — "환자명(님)으로, 좀더 눈에 띄게")
//
// ★ 카드 세 칸에 안 끼웁니다.
//   HOME 왼쪽·가운데·오른쪽은 아래끝을 맞추는 균형이 잡혀 있어서
//   (HomeScreen 머리말), 카드 하나를 끼우면 그 균형을 다시 잡아야
//   합니다. 띠는 그 위에 따로 삽니다 — 있을 때만 나타나고, 없으면
//   화면이 전과 완전히 같습니다.
//
// ★★ **환자 이름으로 부릅니다.**
//   전에는 `ORD-260819-004` 였습니다. 볼 권한을 따질 필요가 없는 값만
//   두려던 것인데, 정작 **누구 이야기인지 알 수 없어** 눈이 그냥
//   지나갔습니다. 알림은 읽혀야 알림입니다. 이름이 없는 주문은
//   주문번호로 돌아갑니다(domain/notification 의 patientCall).
//
// ★ 그리는 것은 UnreadChatBanner 가 합니다 — 그래야 시연 화면에서
//   눈으로 확인할 수 있습니다.
//
// ★ 서버 컴포넌트입니다. 스스로 읽어 오므로 HOME 페이지는 한 줄만
//   얹으면 됩니다. HOME 의 AutoRefresh 가 갱신도 같이 해 줍니다.
// =========================================================

import { listUnreadChatOrders } from '@/server/repositories/notification';
import UnreadChatBanner from '@/components/home/UnreadChatBanner';

export default async function UnreadChatStrip({ orderPath }: { orderPath: string }) {
  const orders = await listUnreadChatOrders();

  return <UnreadChatBanner orders={orders} orderPath={orderPath} />;
}
