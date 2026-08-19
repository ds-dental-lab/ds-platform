// =========================================================
// 놓을 위치: src/server/domain/push/index.ts
//
// 웹푸시에 실을 내용. (사용자 요청 2026-08-19 —
//   "디자인 계정이 다른 일을 하고 있을 때 대화가 온지 알 수 없어")
//
// ★ 환자 이름과 글 내용을 **받지도 않습니다.**
//   푸시는 구글·모질라의 푸시 서버를 지나 잠금화면에까지 뜹니다 —
//   우리 RLS 도 열람 기록도 안 닿는 길입니다. 그래서 "실지 말자" 로
//   끝내지 않고 **타입이 못 싣게** 막습니다. 인자에 환자 이름 칸이
//   없으면 실수로도 못 싣습니다. 인앱 알림(planMessageNotifications)이
//   환자·본문 미리보기를 싣는 것과 일부러 다릅니다.
//
// ★ 주문 하나 = 알림 하나 (tag).
//   같은 주문에 글이 연달아 오면 알림이 쌓이지 않고 **바꿔치기** 됩니다.
//   퇴근 후 대화 다섯 건이 알림 다섯 개로 쌓이면 다음날 아침에
//   전부 지우는 일부터 하게 됩니다.
// =========================================================

export interface ChatPushInput {
  orderNo: string;
  /** 쓴 곳의 조직 이름 — '어디가 말했나' 만 알립니다 */
  authorName: string;
  /** 눌렀을 때 갈 곳 (받는 섹터마다 다릅니다) */
  link: string;
  orderId: string;
}

/** 서비스워커(public/push-sw.js)가 받는 모양. 바꾸면 그쪽도 바꿔야 합니다 */
export interface PushPayload {
  title: string;
  body: string;
  link: string;
  /** 같은 값이면 브라우저가 알림을 갈아끼웁니다 */
  tag: string;
}

export function chatPushPayload(input: ChatPushInput): PushPayload {
  return {
    title: `새 대화 · ${input.orderNo}`,
    body: `${input.authorName}에서 대화를 남겼습니다`,
    link: input.link,
    tag: `order-${input.orderId}`,
  };
}
