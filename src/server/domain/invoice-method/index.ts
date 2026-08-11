// =========================================================
// 놓을 위치: src/server/domain/invoice-method/index.ts
//
// 정산서를 어디로 받는가. (사용자 요청 2026-08-12)
//
// ★ 고른 곳은 값이 있어야 합니다.
//   '이메일로 받겠다' 고 해 놓고 이메일 칸이 비어 있으면 정산서가 갈
//   데가 없습니다. 마감을 눌러 놓고 며칠 뒤에야 "안 왔다" 는 전화를
//   받습니다 — 그때는 이미 다른 거래처 것도 다 나간 뒤입니다.
//
// ★ '둘 다' 가 기본값입니다.
//   아직 안 정한 거래처에 한쪽만 박아 두면, 그 한쪽이 비어 있을 때
//   조용히 아무 데도 안 갑니다.
// =========================================================

/** organizations.invoice_method 와 같습니다 */
export type InvoiceMethod = 'all' | 'email' | 'fax';

export const INVOICE_METHODS: InvoiceMethod[] = ['all', 'email', 'fax'];

export const INVOICE_METHOD_LABEL: Record<InvoiceMethod, string> = {
  all: '둘 다',
  email: '이메일',
  fax: '팩스',
};

/** 이 방법이 이메일을 쓰는가 */
export function wantsEmail(method: InvoiceMethod): boolean {
  return method !== 'fax';
}

/** 이 방법이 팩스를 쓰는가 */
export function wantsFax(method: InvoiceMethod): boolean {
  return method !== 'email';
}

export interface InvoiceContact {
  method: InvoiceMethod;
  email: string | null;
  fax: string | null;
}

/**
 * 지금 이대로 정산서를 보낼 수 있는가. 빠진 곳을 돌려줍니다.
 *
 * ★ '고른 곳' 만 봅니다.
 *   팩스로 받겠다는 곳에 이메일이 없다고 경고하면, 고칠 것이 없는데
 *   빨간 글씨만 남습니다. 그런 경고는 곧 아무도 안 봅니다.
 */
export function missingContact(contact: InvoiceContact): ('email' | 'fax')[] {
  const missing: ('email' | 'fax')[] = [];

  if (wantsEmail(contact.method) && !contact.email?.trim()) missing.push('email');
  if (wantsFax(contact.method) && !contact.fax?.trim()) missing.push('fax');

  return missing;
}
