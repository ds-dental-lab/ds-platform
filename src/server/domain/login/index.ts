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

// ---------- 아이디 기억하기 ----------
//
// 사용자 요청 2026-08-13 — "매번 로그인할 때 편리성을 위해서".
//
// ★ **아이디만** 담습니다. 비밀번호는 담지 않습니다.
//   담아 두면 그 컴퓨터를 쓰는 사람 누구나 로그인할 수 있고,
//   치과 데스크 컴퓨터는 여럿이 같이 씁니다. 아이디만 채워 두어도
//   손이 가는 일의 절반은 줄어듭니다.
//
// ★ 담는 것은 **로그인이 된 다음**입니다.
//   오타 난 주소를 담아 두면 다음에도 그 오타로 시작합니다.

/** 브라우저에 담아 두는 자리 */
export const REMEMBER_KEY = 'denflow.login.email';

/**
 * 담아 둘 값으로 다듬습니다. 담을 게 못 되면 null.
 *
 * ★ 앞뒤 공백을 떼고 소문자로 맞춥니다 — 인증 서버가 그렇게 다룹니다.
 *   `Won@Clinic.KR` 로 담아 두면 다음에 화면과 서버의 값이 달라 보입니다.
 * ★ 모양이 아닌 것은 안 담습니다. 옛 브라우저에 남은 이상한 값이
 *   칸에 채워지면 사람이 그걸 지우고 다시 쳐야 합니다.
 */
export function rememberableEmail(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim().toLowerCase();

  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;

  /* 너무 긴 값은 담지 않습니다 — 저장소를 채우는 길이 됩니다 */
  if (trimmed.length > 254) return null;

  return trimmed;
}

// ---------- 로그인 상태 유지 ----------
//
// 사용자 요청 2026-08-14 — "실제로 로그아웃 전까지 로그인 유지되게 해줘".
//
// ★ **인증 쿠키는 건드리지 않습니다.** `@supabase/ssr` 은 우리가 준
//   maxAge 를 무시하고 자기 기본값(400일)으로 덮어씁니다
//   (`cookies.js` 의 `setCookieOptions`). 그 자리를 직접 쓰려면 쿠키를
//   손으로 만들어야 하는데, 거기서 한 글자를 틀리면 **모두가 로그인을
//   못 합니다.** 그래서 옆에 표시 두 장을 두고 그것으로 판단합니다.
//
//     denflow.login.keep   '1' 또는 '0'  — 사람이 고른 것. 400일
//     denflow.login.alive  '1'          — **세션 쿠키**. 창을 닫으면 사라짐
//
//   '유지 안 함' 을 골랐는데 alive 가 없다 = **브라우저가 닫혔다**.
//   그때만 세션을 끊습니다.
//
// ★ 표시가 아예 없으면 **끊지 않습니다.** 이 기능이 생기기 전에 로그인해
//   둔 사람들이 있습니다. 없는 것을 '유지 안 함' 으로 읽으면 그 사람들이
//   한 번씩 튕깁니다.

/** 사람이 고른 것 — 400일 */
export const KEEP_KEY = 'denflow.login.keep';

/** 창이 살아 있다는 표시 — 세션 쿠키 */
export const ALIVE_KEY = 'denflow.login.alive';

/** 브라우저가 허용하는 상한입니다. 더 길게 줘도 잘립니다 */
export const KEEP_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * 끊어야 하는가.
 *
 * ★ '유지 안 함' + '창이 닫혔음' 일 때만 true 입니다.
 *   나머지는 전부 그대로 둡니다 — 애매하면 안 끊는 쪽이 맞습니다.
 *   잘못 끊으면 일하던 사람이 로그인 화면으로 튕기고, 잘못 놔두면
 *   다음에 창을 열었을 때 한 번 더 로그인하면 됩니다.
 */
export function shouldDropSession(
  keep: string | null | undefined,
  alive: string | null | undefined,
): boolean {
  return keep === '0' && !alive;
}

/**
 * 심을 쿠키 두 장을 문자열로 만듭니다.
 *
 * ★ 순수 함수라 시험할 수 있습니다. `document.cookie` 를 함수 안에서
 *   만지면 규칙이 화면 코드에 섞여 아무도 확인 못 합니다.
 *
 * ★ `secure` 는 https 일 때만 붙입니다. localhost(http)에서 Secure 를
 *   붙이면 브라우저가 **조용히 버립니다** — 개발 중에만 안 되는,
 *   찾기 어려운 종류의 고장이 됩니다.
 */
export function keepCookies(keep: boolean, secure: boolean): string[] {
  const tail = `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;

  return [
    `${KEEP_KEY}=${keep ? '1' : '0'}; Max-Age=${KEEP_MAX_AGE}; ${tail}`,
    // ★ Max-Age 를 안 붙입니다. 그래야 창을 닫을 때 같이 사라집니다
    `${ALIVE_KEY}=1; ${tail}`,
  ];
}

/**
 * 이 요청이 로그인 쿠키를 들고 있는가.
 *
 * ★ **없으면 물어볼 것도 없습니다.** (2026-08-14)
 *   미들웨어는 토큰이 안 풀릴 때 `getUser()` 로 넘어가는데, 그건
 *   Supabase 인증 서버까지 한 번 다녀온다는 뜻입니다. 로그인한 사람의
 *   만료된 토큰을 되살리려고 둔 갈래인데, **쿠키가 아예 없는 사람**까지
 *   거기로 갑니다.
 *
 *   `/` 를 미들웨어에 넣은 뒤로는 그게 **회사 홈페이지를 여는 모든
 *   손님**이 됩니다. 거래처가 아니라 처음 보러 온 사람들입니다.
 *
 * ★ 쿠키가 없으면 로그인일 수가 없습니다. 세션이 거기 담기기 때문입니다.
 *   그러니 이 지름길은 빠르기만 한 게 아니라 **맞는 답**입니다.
 *
 * ★ 이름으로 알아봅니다 — `sb-<프로젝트>-auth-token`. 값이 길면
 *   `.0` `.1` 로 쪼개져 담기므로 앞부분만 봅니다.
 */
export function hasAuthCookie(names: string[]): boolean {
  return names.some((name) => name.startsWith('sb-') && name.includes('-auth-token'));
}

/** 로그아웃할 때 지웁니다 */
export function clearedKeepCookies(secure: boolean): string[] {
  const tail = `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;

  return [KEEP_KEY, ALIVE_KEY].map((name) => `${name}=; Max-Age=0; ${tail}`);
}
