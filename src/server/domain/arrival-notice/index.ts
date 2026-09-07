// =========================================================
// 놓을 위치: src/server/domain/arrival-notice/index.ts
//
// 아침에 치과로 가는 "오늘 도착 예정" 알림톡 문구. (사용자 요청 2026-09-07)
//
//   안녕하세요. 9/15(화) 배송 도착 예정 안내입니다.
//   김민서, 이서준, 박지우 님
//   보철물이 오늘 도착할 예정입니다.
//   [오늘 받을 것 보기] → denflow.kr/m/today
//
// ★ 기준은 폰 홈의 '오늘 받을 것' 과 **같은 요청시한(due_date)** 입니다
//   (domain/arrival). 두 화면이 다른 날짜를 말하면 아무도 못 믿습니다.
// ★ **보낸 것만** 싣습니다 — 배송 중(shipping)·도착(completed). 아직
//   만들고 있는 것을 "오늘 옵니다" 라고 하면 그날 오후에 전화가 옵니다.
// ★ 치과 하나에 하루 한 통. 환자마다 보내면 아침에 다섯 통이 울립니다.
// ★ 순수 함수만 둡니다 — 시계·DB 는 밖에서 받습니다.
// =========================================================

import { getWeekday, WEEKDAY_LABEL, type IsoDate } from '@/server/domain/week';
import { arrivalStateOf } from '@/server/domain/arrival';
import type { OrderStatus } from '@/server/domain/order-status';

/** 알림톡 본문에 이름을 몇 명까지 적나. 넘치면 '외 n명' */
export const MAX_NAMES = 8;

/** 폰의 '오늘 받을 것' 화면 — 알림톡 버튼이 여는 곳 */
export const ARRIVAL_LINK = 'https://denflow.kr/m/today';

/** '9/15(화)' */
export function noticeDate(date: IsoDate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}(${WEEKDAY_LABEL[getWeekday(date)]})`;
}

/** 이 주문이 아침 안내에 실릴 것인가 — 보낸 것만 */
export function isNoticeable(status: OrderStatus): boolean {
  const state = arrivalStateOf(status);
  return state === 'onTheWay' || state === 'arrived';
}

/** '김민서, 이서준 님' · 넘치면 '김민서, … 외 3명 님' */
export function nameLine(names: readonly string[]): string {
  const shown = names.slice(0, MAX_NAMES).join(', ');
  const more = names.length > MAX_NAMES ? ` 외 ${names.length - MAX_NAMES}명` : '';
  return `${shown}${more} 님`;
}

export interface ArrivalNotice {
  title: string;
  body: string;
  link: string;
}

/**
 * 치과 하나에 보낼 문구. 이름이 없으면 null — 보낼 게 없습니다.
 *
 * ★ 카카오 템플릿에서는 이 본문이 변수(#{날짜} #{환자목록})로 들어가고
 *   버튼이 link 를 엽니다. 대기열에는 사람이 읽을 완성문을 남깁니다.
 */
export function composeArrivalNotice(date: IsoDate, names: readonly string[]): ArrivalNotice | null {
  if (names.length === 0) return null;

  return {
    title: `[DenFlow] ${noticeDate(date)} 배송 도착 예정`,
    body:
      `안녕하세요. ${noticeDate(date)} 배송 도착 예정 안내입니다.\n` +
      `${nameLine(names)}\n` +
      '보철물이 오늘 도착할 예정입니다.\n' +
      `오늘 받을 것 보기: ${ARRIVAL_LINK}`,
    link: ARRIVAL_LINK,
  };
}

/** 주문 줄을 치과별 이름 목록으로 — 같은 환자가 둘이면 한 번만 */
export function groupByClinic(
  rows: readonly { clinicOrgId: string; patientLabel: string; status: OrderStatus }[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    if (!isNoticeable(r.status)) continue;
    const names = out.get(r.clinicOrgId) ?? [];
    if (!names.includes(r.patientLabel)) names.push(r.patientLabel);
    out.set(r.clinicOrgId, names);
  }
  return out;
}
