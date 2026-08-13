// =========================================================
// 놓을 위치: src/server/domain/login/index.ts
//
// 로그인이 안 될 때 무엇이라고 말할 것인가. (사용자 신고 2026-08-13 —
//   "치과 회원가입하고 승인해줬는데 비밀번호가 올바르지 않다고 한다")
//
// ★ 원인이 달라도 화면은 한 문장만 말하고 있었습니다.
//   실제 원인은 **이메일 확인을 아직 안 한 것**이었는데,
//   "이메일 또는 비밀번호가 올바르지 않습니다" 로 나왔습니다.
//   그 말을 본 사람은 비밀번호를 계속 다시 칩니다 — 영원히 안 됩니다.
//
// ★ "확인 안 됨" 을 알려 주는 것이 정보를 흘리는 것은 아닙니다.
//   Supabase 는 비밀번호가 **맞았을 때만** email_not_confirmed 를
//   돌려줍니다. 틀리면 그냥 invalid_credentials 입니다. 그러니 이
//   문구를 본 사람은 이미 그 계정의 비밀번호를 아는 사람입니다.
// =========================================================

export interface LoginProblem {
  message: string;
  /** 확인 메일을 다시 보낼 수 있는 상황인가 */
  canResend: boolean;
}

const WRONG: LoginProblem = {
  message: '이메일 또는 비밀번호가 올바르지 않습니다.',
  canResend: false,
};

/**
 * @param code Supabase 가 준 오류 코드
 */
export function loginProblem(code: string | null | undefined): LoginProblem {
  switch (code) {
    case 'email_not_confirmed':
      return {
        message:
          '가입하신 메일로 보낸 확인 링크를 아직 안 누르셨습니다.\n' +
          '메일함(스팸함도)을 확인해 주세요.',
        canResend: true,
      };

    /*
      ★ 메일 발송에는 한도가 있습니다.
        기본 메일 서비스는 시간당 몇 통뿐이라, 여러 명이 잇따라
        가입하면 뒤에 온 사람에게는 메일이 아예 안 갑니다.
        "안 왔다" 를 "안 눌렀다" 로 오해하면 한참을 헤맵니다.
    */
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return {
        message: '요청이 몰렸습니다. 잠시 뒤에 다시 시도해 주세요.',
        canResend: false,
      };

    case 'user_banned':
      return { message: '이용이 정지된 계정입니다. 디자인센터에 문의해 주세요.', canResend: false };

    case 'invalid_credentials':
    default:
      return WRONG;
  }
}
