// =========================================================
// 놓을 위치: src/server/domain/password-reset/index.ts
//
// 비밀번호 찾기. (사용자 요청 2026-08-12 —
//   "가입한 이메일로 인증번호 발송해서 확인버튼 누르거나 입력하면
//    새비밀번호 입력할수 잇게")
//
// ★ 링크가 아니라 **번호**입니다.
//   Supabase 가 기본으로 주는 것은 눌러서 들어오는 링크인데, 그러면
//   메일을 연 기기에서만 됩니다. 병원 컴퓨터에서 로그인하려는데 메일은
//   휴대폰에 와 있는 일이 흔합니다. 번호는 눈으로 옮겨 적을 수 있습니다.
//
// ★ 그 이메일이 있는지 없는지 말하지 않습니다.
//   "없는 이메일입니다" 는 남의 가입 여부를 확인해 주는 창구가 됩니다.
//   무엇을 넣든 "보냈습니다" 라고 답하고, 없으면 아무 일도 안 일어납니다.
// =========================================================

/**
 * 메일로 오는 인증번호 자릿수.
 *
 * ★ 자릿수를 하나로 박지 않습니다.
 *   처음에 6자리로 박았다가 실제로 받아 보니 **8자리**였습니다 —
 *   Supabase 쪽 설정값이고 6~10 사이에서 바뀔 수 있습니다. 박아 두면
 *   칸에 다 들어가지도 않아, 맞는 번호를 들고도 영영 못 들어갑니다.
 *   범위로 받고 "몇 자리" 라고 단정하지 않습니다.
 */
export const MIN_CODE = 6;
export const MAX_CODE = 10;

/** 비밀번호 최소 길이 — 회원가입과 같은 값입니다 */
export const MIN_PASSWORD = 8;

/** 재발송을 다시 누를 수 있을 때까지 (초) */
export const RESEND_COOLDOWN = 60;

/**
 * 걸음.
 *
 * ★ 마지막에 'done' 이 있습니다.
 *   바꾸자마자 로그인 화면으로 튕겨 보내면, 방금 무슨 일이 일어났는지
 *   모른 채 빈 칸 두 개를 마주합니다. 한 번 말해 주고 보냅니다.
 */
export type Step = 'email' | 'code' | 'password' | 'done';

export type Verdict = { ok: true } | { ok: false; reason: string };

/**
 * 보낼 수 있는 이메일인가.
 *
 * ★ 규칙을 촘촘히 쓰지 않습니다. 실제로 쓰이는 주소 중에 규칙에 안 맞는
 *   것이 늘 있고, 막으면 그 사람은 영영 못 들어옵니다 (domain/member 와 같은 판단).
 */
export function checkEmail(email: string): Verdict {
  const trimmed = email.trim();

  if (!trimmed) return { ok: false, reason: '가입한 이메일을 넣어 주세요' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, reason: '이메일 모양이 아닙니다' };
  }

  return { ok: true };
}

/**
 * 손으로 옮겨 적은 번호를 다듬습니다.
 *
 * ★ 메일에서 복사하면 앞뒤 공백이나 사이 하이픈이 딸려 옵니다.
 *   그걸로 "맞지 않습니다" 를 띄우면 사람은 자기가 잘못 본 줄 압니다.
 */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, MAX_CODE);
}

export function checkCode(code: string): Verdict {
  const clean = normalizeCode(code);

  if (!clean) return { ok: false, reason: '메일로 받은 인증번호를 넣어 주세요' };
  if (clean.length < MIN_CODE) {
    return { ok: false, reason: '인증번호가 짧습니다. 메일에 온 번호를 그대로 넣어 주세요' };
  }

  return { ok: true };
}

/**
 * 새 비밀번호.
 *
 * ★ 두 번 받습니다.
 *   한 번만 받으면 오타가 그대로 새 비밀번호가 됩니다 — 그 순간
 *   그 사람은 방금 바꾼 비밀번호로도 못 들어옵니다.
 */
export function checkNewPassword(password: string, confirm: string): Verdict {
  if (!password) return { ok: false, reason: '새 비밀번호를 넣어 주세요' };

  if (password.length < MIN_PASSWORD) {
    return { ok: false, reason: `비밀번호는 ${MIN_PASSWORD}자 이상으로 해 주세요` };
  }

  if (password !== confirm) return { ok: false, reason: '두 번 넣은 비밀번호가 다릅니다' };

  return { ok: true };
}

/**
 * 화면에 보여 줄 안내.
 *
 * ★ 이메일을 그대로 다시 적어 줍니다.
 *   오타로 엉뚱한 곳에 보내 놓고 메일함만 들여다보는 일을 막습니다.
 *
 * ★ 들어오는 길이 둘이라는 것을 말해 줍니다.
 *   메일에 번호가 없을 수도 있습니다 (템플릿 설정에 달렸습니다).
 *   그때 링크를 눌러도 된다는 것을 모르면, 번호를 찾다가 그냥 덮습니다.
 */
export function sentMessage(email: string): string {
  return (
    `${email.trim()} 로 메일을 보냈습니다. ` +
    '메일에 적힌 번호를 넣거나, 메일 속 링크를 눌러도 됩니다. ' +
    '안 보이면 스팸함도 확인해 주세요.'
  );
}

/** 재발송까지 남은 초 */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `재발송 (${secondsLeft}초)` : '인증번호 다시 받기';
}
