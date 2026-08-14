// =========================================================
// 놓을 위치: src/server/domain/alimtalk/index.ts
//
// 알림톡을 누구에게 보내는가, 번호는 어떻게 다루는가.
// (사용자 요청 2026-08-14)
//
// ★ **대표번호와 다릅니다.**
//   organizations.tel 은 청구서에 찍히는 번호입니다. 알림톡은 사람이
//   받습니다 — 관리자든 사용자든 각자 자기 번호를 넣고 각자 켭니다.
//   한 조직에서 여럿이 동시에 받습니다.
//
// ★ 저장은 **숫자만**, 화면은 **하이픈**.
//   `010-1234-5678` 과 `01012345678` 이 섞여 들어오면 같은 사람이
//   두 번 받거나, 발송 대행사가 거부합니다. 담을 때 한 모양으로
//   눕히고, 보여 줄 때만 다시 세웁니다.
//
// ★ 아직 **보내지는 않습니다.**
//   알림톡은 사업자등록 · 카카오 채널 · 템플릿 사전심사가 있어야
//   나갑니다. 그 전까지는 '누구에게 갈 뻔했는가' 만 정확히 정해 둡니다.
//   발송이 붙을 때 이 파일은 안 바뀝니다.
// =========================================================

import type { OrderStatus } from '@/server/domain/order-status';

// ---------- 번호 ----------

/**
 * 저장할 모양으로 다듬습니다. 담을 게 못 되면 null.
 *
 * ★ 숫자만 남깁니다. 하이픈·괄호·공백·`+82` 를 사람마다 다르게 씁니다.
 * ★ `+82 10 …` 은 `010 …` 으로 되돌립니다 — 국내 발송이라 0 이 있어야 합니다.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');

  // +82-10-… → 8210… 으로 들어옵니다. 앞의 82 를 0 으로 바꿉니다
  if (digits.startsWith('82') && digits.length >= 11) digits = `0${digits.slice(2)}`;

  if (!isValidPhone(digits)) return null;

  return digits;
}

/**
 * 알림톡을 보낼 수 있는 번호인가.
 *
 * ★ **휴대전화만** 받습니다. 알림톡은 카카오톡을 쓰는 기기로 갑니다 —
 *   유선번호를 넣으면 저장은 되고 발송만 조용히 실패합니다.
 *   그 실패는 아무 화면에도 안 보이므로 여기서 막습니다.
 */
export function isValidPhone(digits: string): boolean {
  return /^01[016789]\d{7,8}$/.test(digits);
}

/** 화면에 보여 줄 모양 — `010-1234-5678` */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return '';

  if (/^01\d{9}$/.test(digits)) return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
  if (/^01\d{8}$/.test(digits)) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');

  return digits;
}

/** 이 사람에게 지금 보낼 수 있는가 */
export function canReceive(person: { phone: string | null; alimtalkOn: boolean }): boolean {
  return person.alimtalkOn && normalizePhone(person.phone) !== null;
}

// ---------- 무슨 일에 누가 받는가 ----------

/** 알림톡이 나가는 순간들 (사용자 확정 2026-08-14) */
export type AlimtalkEvent = 'order_received' | 'production_requested' | 'rescan_requested';

export interface AlimtalkRule {
  /** 어느 자리의 사람들이 받는가 */
  audience: 'clinic' | 'design_center' | 'lab';
  /** 화면·기록에 쓰는 이름 */
  label: string;
}

export const ALIMTALK_RULES: Record<AlimtalkEvent, AlimtalkRule> = {
  // 치과가 주문을 넣었습니다 → 받아서 시작할 곳
  order_received: { audience: 'design_center', label: '새 주문 접수' },
  // 디자인센터가 제작을 넘겼습니다 → 만들 곳
  production_requested: { audience: 'lab', label: '제작 의뢰' },
  // 디자인센터가 스캔을 다시 요청했습니다 → 다시 찍을 곳
  rescan_requested: { audience: 'clinic', label: '재스캔 요청' },
};

/**
 * 상태가 이렇게 바뀌면 어떤 알림톡이 나가는가. 없으면 null.
 *
 * ★ **바뀐 순간에만** 봅니다. 같은 상태로 다시 저장하는 일이 있어서,
 *   'now 가 무엇인가' 로 보면 한 건에 여러 번 나갑니다.
 *
 * ★ 접수는 **주문이 생길 때**입니다(from 이 없음). 상태가 접수로
 *   '되돌아온' 경우까지 새 주문이라고 알리면 안 됩니다.
 */
export function eventFor(from: OrderStatus | null, to: OrderStatus): AlimtalkEvent | null {
  if (from === to) return null;

  if (from === null) return to === 'received' ? 'order_received' : null;
  if (to === 'production_wait') return 'production_requested';
  if (to === 'rescan') return 'rescan_requested';

  return null;
}
