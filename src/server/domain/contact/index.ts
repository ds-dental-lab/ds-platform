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

/**
 * 요청 종류 — **옛 문의에만** 남아 있습니다 (2026-09-04 부터 안 묻습니다).
 *
 * ★ "방문 상담" 은 전화로 잡으면 됩니다 (사용자 판단). 폼에서 고르게
 *   하면 고르는 칸 하나가 늘 뿐, 어차피 전화해서 정합니다.
 *   표는 default 'price_list' 라 새 문의는 전부 수가표 요청입니다.
 */
export type ContactKind = 'price_list' | 'visit';

export const KIND_LABEL: Record<ContactKind, string> = {
  price_list: '수가표만 받겠습니다',
  visit: '방문 상담을 원합니다',
};

/**
 * 구강스캐너 보유 여부. (사용자 요청 2026-08-28)
 *
 * ★ 이 하나가 상담 통화를 바꿉니다. 보유중이면 모델리스 흐름을,
 *   미보유면 인상재·수거 이야기를 먼저 꺼내야 합니다. 몰라서
 *   엉뚱한 이야기부터 하면 그 통화는 길어지기만 합니다.
 */
export type ContactScanner = 'owned' | 'planned' | 'none';

export const SCANNER_LABEL: Record<ContactScanner, string> = {
  owned: '보유중',
  planned: '도입예정',
  none: '미보유',
};

/** 현재 거래 기공소에 불만족하는 점. 복수. */
export type PainPoint = 'price' | 'lead_time' | 'quality' | 'other';

export const PAIN_LABEL: Record<PainPoint, string> = {
  price: '비싼 기공수가',
  lead_time: '긴 제작기간',
  quality: '부족한 품질',
  other: '기타',
};

export function isScanner(value: string): value is ContactScanner {
  return value === 'owned' || value === 'planned' || value === 'none';
}

export function isPainPoint(value: string): value is PainPoint {
  return value === 'price' || value === 'lead_time' || value === 'quality' || value === 'other';
}

export type ContactStatus = 'new' | 'done';

export const STATUS_LABEL: Record<ContactStatus, string> = {
  new: '새 문의',
  done: '처리함',
};

export interface ContactForm {
  clinicName: string;
  /*
    ★ 담당자 성함은 안 받습니다 (사용자 요청 2026-09-04). 치과명과
      번호만 있으면 전화해서 물어보면 됩니다 — 칸이 하나 줄면 그만큼
      더 보냅니다. 표의 person_name 열은 옛 문의 때문에 남아 있습니다.
  */
  tel: string;
  email: string;
  message: string;
  agreed: boolean;
  /** 구강스캐너 보유 여부. 꼭 받습니다 */
  scanner: string;
  /** 불만족점. 비워도 됩니다 — 만족하는 사람에게 억지로 고르게 하지 않습니다 */
  painPoints: string[];
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

  const tel = digits(form.tel);
  if (!tel) return { ok: false, reason: '연락처를 넣어 주세요' };
  if (tel.length < 9) return { ok: false, reason: '연락처를 다시 확인해 주세요' };

  const email = form.email.trim();
  if (!email) return { ok: false, reason: '수가표를 받으실 이메일을 넣어 주세요' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: '이메일 모양이 아닙니다' };
  }

  /*
    ★ 스캐너는 꼭 받습니다 — 셋 중 하나를 누르는 일이라 걸림돌이
      아니고, 상담 통화의 첫마디를 정합니다.
    ★ 불만족점은 안 받아도 됩니다. 다만 화면이 보낸 값은 안 믿습니다 —
      목록에 없는 값이 오면 막습니다.
  */
  if (!isScanner(form.scanner)) return { ok: false, reason: '구강스캐너 보유 여부를 골라 주세요' };
  if (!form.painPoints.every(isPainPoint)) return { ok: false, reason: '불만족점 값이 이상합니다' };

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
  // ★ 2026-09-04 부터 성함을 안 받습니다 — 화면·저장·처리방침이 같은 글을 봅니다
  items: '치과명, 연락처, 이메일',
  purpose: '수가표 제공 및 상담 응대',
  keep: '목적을 이룬 뒤 파기하며, 동의를 철회하시면 곧바로 파기합니다',
};
