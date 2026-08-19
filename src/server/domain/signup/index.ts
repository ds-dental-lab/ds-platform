// =========================================================
// 놓을 위치: src/server/domain/signup/index.ts
//
// 가입 신청과 승인. (사용자 결정 2026-08-12 —
//   "회원가입창에서 유저가 디자인 가입 못하게 화면에서 없애줘",
//    "치과랑 기공사 회원 가입이 완료되면 디자인 센터가 승인을 해줘야
//     이용할수 잇게 해줘")
//
// ★ 디자인센터는 **고를 수조차 없습니다.**
//   이 판은 디자인센터가 가운데에 서서 치과와 기공소를 잇는 구조입니다
//   ([[조직 구조]]). 아무나 디자인센터로 가입하면 승인해 줄 사람이
//   자기 자신이 되어, 승인이라는 절차 자체가 뜻을 잃습니다.
//   화면에서 빼는 것으로 끝내지 않고 **표에 제약**을 겁니다.
//
// ★ 가입했다고 쓸 수 있는 것은 아닙니다.
//   가입은 '문을 두드린 것' 이고, 자리에 앉는 것은 승인입니다.
//   승인 전에는 소속이 없어 RLS 가 전부 가립니다 — 화면을 따로
//   잠글 필요가 없습니다. 대신 **왜 안 보이는지**는 말해 줘야 합니다.
// =========================================================

/** 스스로 가입할 수 있는 곳. 디자인센터는 여기 없습니다 */
export const SIGNUP_SECTORS = ['clinic', 'lab'] as const;

export type SignupSector = (typeof SIGNUP_SECTORS)[number];

export const SECTOR_LABEL: Record<SignupSector, string> = {
  clinic: '치과',
  lab: '기공소',
};

export const SECTOR_HINT: Record<SignupSector, string> = {
  clinic: '스캔을 보내고 보철을 받습니다',
  lab: '디자인을 받아 보철을 만듭니다',
};

export type SignupStatus = 'pending' | 'approved' | 'rejected';

export const STATUS_LABEL: Record<SignupStatus, string> = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '반려',
};

export type Verdict = { ok: true } | { ok: false; reason: string };

/** 최소 비밀번호 길이 — 다른 곳과 같은 값입니다 */
export const MIN_PASSWORD = 8;

export interface SignupForm {
  name: string;
  email: string;
  password: string;
  orgType: string;
  orgName: string;
  /**
   * 이용약관과 개인정보 처리방침에 동의했는가.
   *
   * ★ 약관 제5조 — 이용계약은 **동의하고 신청한 뒤 승인**으로 성립합니다.
   *   동의를 안 받고 가입시키면 그 약관은 그 사람에게 효력이 없습니다.
   *   그래서 화면의 체크박스로 끝내지 않고 규칙으로 막습니다.
   */
  agreed: boolean;
}

/**
 * 가입 신청을 보낼 수 있는가.
 *
 * ★ 순서가 있습니다. 빈 칸부터, 그 다음 모양, 그 다음 길이.
 *   한 번에 다 쏟아 내면 무엇부터 고칠지 모릅니다.
 */
export function checkSignup(form: SignupForm): Verdict {
  if (!form.name.trim()) return { ok: false, reason: '이름을 넣어 주세요' };
  if (!form.orgName.trim()) return { ok: false, reason: '기관 이름을 넣어 주세요' };

  if (!isSignupSector(form.orgType)) {
    return { ok: false, reason: '치과 또는 기공소를 골라 주세요' };
  }

  const email = form.email.trim();
  if (!email) return { ok: false, reason: '이메일을 넣어 주세요' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: '이메일 모양이 아닙니다' };
  }

  if (!form.password) return { ok: false, reason: '비밀번호를 넣어 주세요' };
  if (form.password.length < MIN_PASSWORD) {
    return { ok: false, reason: `비밀번호는 ${MIN_PASSWORD}자 이상으로 해 주세요` };
  }

  // ★ 맨 마지막에 봅니다.
  //   동의는 다 적고 나서 하는 것입니다. 빈 칸이 남았는데 "동의해 주세요"
  //   부터 뜨면, 정작 무엇에 동의하는지 못 읽은 채로 체크하게 됩니다.
  if (!form.agreed) {
    return { ok: false, reason: '이용약관과 개인정보 처리방침에 동의해 주세요' };
  }

  return { ok: true };
}

/**
 * ★ 화면이 보낸 값을 믿지 않는 자리입니다.
 *   셀렉박스에서 디자인센터를 지운 것만으로는 아무것도 못 막습니다.
 *   주소로 직접 보내면 그만입니다.
 */
export function isSignupSector(value: string): value is SignupSector {
  return (SIGNUP_SECTORS as readonly string[]).includes(value);
}

// ---------- 승인 ----------

export interface Reviewer {
  orgType: string | null;
  isManager: boolean;
}

/**
 * 승인·반려를 할 수 있는가.
 *
 * ★ 디자인센터의 **관리자**만입니다.
 *   거래처가 하나 늘어난다는 것은 단가·정산이 걸리는 일이라,
 *   금액을 못 보는 사용자가 결정할 일이 아닙니다.
 */
export function canReview(reviewer: Reviewer): boolean {
  return reviewer.orgType === 'design_center' && reviewer.isManager;
}

/** 이미 처리된 신청을 또 만지지 않도록 */
export function checkReviewable(status: SignupStatus): Verdict {
  if (status === 'pending') return { ok: true };

  return {
    ok: false,
    reason:
      status === 'approved'
        ? '이미 승인된 신청입니다'
        : '이미 반려한 신청입니다. 다시 가입해 달라고 안내해 주세요',
  };
}

/**
 * 반려에는 사유가 있어야 합니다.
 *
 * ★ 이유 없이 반려하면 그 사람은 무엇을 고쳐야 할지 모른 채
 *   같은 내용으로 또 신청합니다. 사유는 본인에게 그대로 보입니다.
 */
export function checkRejectReason(reason: string): Verdict {
  if (!reason.trim()) return { ok: false, reason: '반려 사유를 적어 주세요' };
  return { ok: true };
}

// ---------- 기다리는 사람에게 보여 줄 말 ----------

export interface WaitingView {
  title: string;
  body: string;
  /** 다시 가입하라고 안내할 것인가 */
  canRetry: boolean;
}

/**
 * ★ "소속된 조직이 없습니다" 만 띄우면 안 됩니다.
 *   가입은 했는데 화면이 텅 비어 있으면, 사람은 자기가 뭘 잘못했는지
 *   찾다가 전화를 겁니다. 지금 어느 단계인지 말해 줍니다.
 */
export function waitingView(
  status: SignupStatus | null,
  orgName: string,
  rejectReason: string,
): WaitingView {
  if (status === 'pending') {
    return {
      title: '승인을 기다리는 중입니다',
      body: `${orgName} 로 신청하셨습니다. 디자인센터가 확인하면 바로 쓰실 수 있습니다.`,
      canRetry: false,
    };
  }

  if (status === 'rejected') {
    return {
      title: '가입이 반려됐습니다',
      body: rejectReason.trim() || '사유가 적혀 있지 않습니다. 디자인센터에 문의해 주세요.',
      canRetry: true,
    };
  }

  // 신청 기록이 없습니다 — 초대장으로 들어왔는데 자리가 안 붙은 경우
  return {
    title: '소속된 조직이 없습니다',
    body: '초대받은 이메일로 가입했는지 확인해 주세요. 계속 이러면 관리자에게 문의해 주세요.',
    canRetry: false,
  };
}
