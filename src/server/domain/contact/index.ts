// =========================================================
// 놓을 위치: src/server/domain/contact/index.ts
//
// 홈페이지 문의 폼의 규칙.
//
// ★ 막는 것을 최소로 합니다.
//   여기는 관심을 보인 사람이 처음 남기는 자리입니다. 형식을 촘촘히
//   따지면 그 사람은 고치다 말고 창을 닫습니다. 연락이 닿을 수 있는지만
//   봅니다 — 나머지는 전화해서 물어보면 됩니다.
// =========================================================

export type ContactKind = 'price_list' | 'visit';

export const KIND_LABEL: Record<ContactKind, string> = {
  price_list: '수가표만 받겠습니다',
  visit: '방문 상담을 원합니다',
};

export type ContactStatus = 'new' | 'done';

export const STATUS_LABEL: Record<ContactStatus, string> = {
  new: '새 문의',
  done: '처리함',
};

export interface ContactForm {
  clinicName: string;
  personName: string;
  tel: string;
  email: string;
  kind: string;
  message: string;
  agreed: boolean;
}

export type Verdict = { ok: true } | { ok: false; reason: string };

export function isContactKind(value: string): value is ContactKind {
  return value === 'price_list' || value === 'visit';
}

/**
 * ★ 전화번호를 숫자만 남겨 셉니다.
 *   `010-1234-5678` `010 1234 5678` `01012345678` 이 다 옵니다.
 *   모양을 강요하면 맞는 번호를 들고도 못 보냅니다.
 */
export function digits(tel: string): string {
  return tel.replace(/\D/g, '');
}

export function checkContact(form: ContactForm): Verdict {
  if (!form.clinicName.trim()) return { ok: false, reason: '치과명을 넣어 주세요' };
  if (!form.personName.trim()) return { ok: false, reason: '성함을 넣어 주세요' };

  const tel = digits(form.tel);
  if (!tel) return { ok: false, reason: '연락처를 넣어 주세요' };
  if (tel.length < 9) return { ok: false, reason: '연락처를 다시 확인해 주세요' };

  const email = form.email.trim();
  if (!email) return { ok: false, reason: '수가표를 받으실 이메일을 넣어 주세요' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: '이메일 모양이 아닙니다' };
  }

  if (!isContactKind(form.kind)) return { ok: false, reason: '무엇을 원하시는지 골라 주세요' };

  // ★ 동의 없이 개인정보를 받지 않습니다. 표의 제약과 이중으로 막습니다
  if (!form.agreed) return { ok: false, reason: '개인정보 수집·이용에 동의해 주세요' };

  return { ok: true };
}

/**
 * 동의 문구.
 *
 * ★ 화면과 저장이 같은 글을 봐야 합니다.
 *   화면에만 적어 두면, 문구가 바뀌었을 때 "그때 무엇에 동의했는지" 를
 *   아무도 답하지 못합니다.
 */
export const CONSENT = {
  items: '치과명, 담당자 성함, 연락처, 이메일',
  purpose: '수가표 제공 및 상담 응대',
  keep: '목적을 이룬 뒤 파기하며, 동의를 철회하시면 곧바로 파기합니다',
};
