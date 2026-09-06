// =========================================================
// 놓을 위치: src/server/domain/center-mobile/index.ts
//
// 센터 관리자의 폰 화면 규칙. (사용자 요청 2026-09-06 —
//   "디자이너가 아닌 센터마스터 핸드폰으로 봤을 때 수가표 문의, 사용자
//    승인, 주문목록(유선전화 시 어떤 종류고 어떤 치식인지 확인) 간편하게")
//
// ★★ 세 가지 일만 합니다. 이 화면은 **책상에 없을 때** 폰으로 처리하는
//   것들입니다 — 문의에 전화 걸기, 가입 승인하기, 치과가 전화했을 때
//   "그 케이스 뭐였죠" 를 찾기. 주문을 만들거나 고치는 일은 PC 에서 합니다.
//
// ★ 승인·문의는 **관리자**만 봅니다. 디자이너가 폰으로 열면 주문 찾기
//   하나만 있습니다 — 자기 일이 아닌 카드가 보이면 눌러 봐야 404 입니다.
// =========================================================

import { matchesAny } from '../hangul';
import { formatToothList, type ToothCell } from '../order-list';
import { buildAbbr, type ProsthesisCatalog } from '../prosthesis';

export interface CenterCounts {
  contacts: number;
  signups: number;
}

export interface CenterCard {
  key: 'contacts' | 'signups' | 'orders';
  title: string;
  hint: string;
  href: string;
  /** 기다리는 수. 주문 찾기는 null — 세는 것이 아니라 찾는 것입니다 */
  count: number | null;
}

/**
 * 홈에 세울 카드.
 *
 * ★ 순서는 **급한 것부터**입니다. 문의는 전화를 기다리는 사람이 있고,
 *   승인은 못 들어오고 있는 치과가 있습니다. 주문 찾기는 전화가 왔을 때
 *   여는 것이라 맨 아래여도 됩니다.
 */
export function centerCards(counts: CenterCounts, manager: boolean): CenterCard[] {
  const cards: CenterCard[] = [];

  if (manager) {
    cards.push({
      key: 'contacts',
      title: '수가표 문의',
      hint: counts.contacts > 0 ? '전화 기다리는 곳이 있습니다' : '새 문의가 없습니다',
      href: '/m/contacts',
      count: counts.contacts,
    });
    cards.push({
      key: 'signups',
      title: '가입 승인',
      hint: counts.signups > 0 ? '승인해야 들어올 수 있습니다' : '기다리는 신청이 없습니다',
      href: '/m/signups',
      count: counts.signups,
    });
  }

  cards.push({
    key: 'orders',
    title: '주문 찾기',
    hint: '치과·환자 이름으로 종류와 치식을 봅니다',
    href: '/m/orders',
    count: null,
  });

  return cards;
}

// ---------- 주문 찾기 ----------

export interface SearchableOrder {
  order_no: string;
  clinic_name: string;
  patient_label: string;
}

/**
 * 찾는 말에 걸리는가 — 치과·환자·주문번호 어디든.
 *
 * ★ 초성도 됩니다 (domain/hangul). 전화 받으면서 한 손으로 치는
 *   자리라 'ㅁㅅ' 로 미사치과가 나와야 합니다.
 */
export function matchesOrder(row: SearchableOrder, query: string): boolean {
  return matchesAny([row.clinic_name, row.patient_label, row.order_no], query);
}

/** 목록 한 줄의 치식 — '11 12 X 14' */
export function teethLine(cells: ToothCell[]): string {
  return cells.length === 0 ? '치식 없음' : formatToothList(cells);
}

/**
 * 상세의 항목 한 줄 — '#26 · Zir-Cr' · 폰틱이면 '(폰틱)'.
 *
 * ★ 전화로 "어떤 종류예요" 에 답하는 줄입니다. 코드가 아니라 **약어**로 —
 *   'CR/ZIR' 은 아무도 못 읽습니다. 카탈로그에 없으면 코드 그대로
 *   (buildAbbr 가 그렇게 돌려줍니다 — 화면이 죽지 않게).
 */
export function itemLine(
  catalog: ProsthesisCatalog,
  item: { tooth_number: number; type_code: string; material_code: string; is_pontic: boolean },
): string {
  const abbr = buildAbbr(catalog, item.type_code, item.material_code);
  return `#${item.tooth_number} · ${abbr}${item.is_pontic ? ' (폰틱)' : ''}`;
}

/** 찾기 목록에 세우는 기간. 그보다 오래된 것은 PC 에서 */
export const SEARCH_DAYS = 90;

/** 어느 날부터 세울 것인가 — 'YYYY-MM-DD'. 시계는 여기서만 읽습니다 */
export function searchFrom(now: Date = new Date()): string {
  return new Date(now.getTime() - SEARCH_DAYS * 864e5).toISOString().slice(0, 10);
}

/** 한 번에 내려 주는 최대 줄 수 — 브라우저가 치는 대로 좁힙니다 */
export const SEARCH_LIMIT = 300;
