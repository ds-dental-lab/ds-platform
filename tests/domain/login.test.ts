// =========================================================
// 놓을 위치: tests/domain/login.test.ts
//
// 로그인이 안 될 때 무엇이라고 말하나. (사용자 신고 2026-08-13)
//
// ★ 실제로 겪은 일입니다.
//   가입·승인까지 끝난 치과가 로그인을 못 했는데, 화면은
//   "비밀번호가 올바르지 않습니다" 라고만 했습니다. 진짜 이유는
//   이메일 확인 링크를 안 누른 것이었습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  loginProblem,
  rememberableEmail,
  shouldDropSession,
  hasAuthCookie,
  keepCookies,
  clearedKeepCookies,
  KEEP_KEY,
  ALIVE_KEY,
  KEEP_MAX_AGE,
  safeNext,
} from '@/server/domain/login';

describe('원인마다 다른 말을 한다', () => {
  it('★ 메일 확인 전이면 그렇게 말한다 — 비밀번호 탓을 하면 안 됩니다', () => {
    const problem = loginProblem('email_not_confirmed');

    expect(problem.message).toContain('확인 링크');
    expect(problem.message).not.toContain('비밀번호');
    expect(problem.canResend).toBe(true);
  });

  it('스팸함도 짚어 준다 — 네이버·다음은 잘 걸립니다', () => {
    expect(loginProblem('email_not_confirmed').message).toContain('스팸함');
  });

  it('비밀번호가 틀렸으면 그대로 말한다', () => {
    const problem = loginProblem('invalid_credentials');

    expect(problem.message).toContain('올바르지 않습니다');
    expect(problem.canResend).toBe(false);
  });

  it('★ 발송 한도에 걸린 것을 "안 눌렀다" 로 오해하면 안 됩니다', () => {
    for (const code of ['over_email_send_rate_limit', 'over_request_rate_limit']) {
      const problem = loginProblem(code);
      expect(problem.message).toContain('잠시 뒤');
      expect(problem.canResend).toBe(false);
    }
  });

  it('정지된 계정은 어디에 문의할지 알려 준다', () => {
    expect(loginProblem('user_banned').message).toContain('디자인센터');
  });

  it('모르는 코드는 가장 흔한 이유로 말한다', () => {
    for (const code of [undefined, null, '', 'weird_new_code']) {
      expect(loginProblem(code).message).toContain('올바르지 않습니다');
      expect(loginProblem(code).canResend).toBe(false);
    }
  });

  it('★ 어떤 코드에도 빈 문구가 나오지 않는다', () => {
    for (const code of [
      'email_not_confirmed',
      'invalid_credentials',
      'over_email_send_rate_limit',
      'user_banned',
      'anything',
    ]) {
      expect(loginProblem(code).message.length).toBeGreaterThan(0);
    }
  });
});

// ---------- 아이디 기억하기 (2026-08-13) ----------

describe('rememberableEmail', () => {
  it('앞뒤 공백을 떼고 소문자로 맞춥니다', () => {
    // 인증 서버가 그렇게 다룹니다. 대문자로 담아 두면 화면과 서버가 달라 보입니다
    expect(rememberableEmail('  Won@Clinic.KR ')).toBe('won@clinic.kr');
  });

  it('빈 값은 안 담습니다', () => {
    expect(rememberableEmail('')).toBeNull();
    expect(rememberableEmail('   ')).toBeNull();
    expect(rememberableEmail(null)).toBeNull();
    expect(rememberableEmail(undefined)).toBeNull();
  });

  it('★ 이메일 모양이 아니면 안 담습니다', () => {
    // 옛 브라우저에 남은 이상한 값이 칸에 채워지면 사람이 지우고 다시 칩니다
    expect(rememberableEmail('won')).toBeNull();
    expect(rememberableEmail('won@clinic')).toBeNull();
    expect(rememberableEmail('a b@c.kr')).toBeNull();
  });

  it('아주 긴 값은 안 담습니다', () => {
    expect(rememberableEmail('a'.repeat(250) + '@b.kr')).toBeNull();
  });

  it('담고 읽은 값이 제자리로 돌아옵니다', () => {
    const once = rememberableEmail('clinic@test.kr');
    expect(rememberableEmail(once)).toBe(once);
  });
});

describe('로그인 상태 유지', () => {
  it('★ 유지를 골랐으면 창을 닫아도 안 끊습니다', () => {
    expect(shouldDropSession('1', '1')).toBe(false);
    expect(shouldDropSession('1', null)).toBe(false); // 창을 닫았다 다시 연 상황
  });

  it('★ 유지를 껐고 창이 살아 있으면 안 끊습니다 — 일하는 중입니다', () => {
    expect(shouldDropSession('0', '1')).toBe(false);
  });

  it('★ 유지를 껐고 창이 닫혔으면 끊습니다 — 이것 하나뿐입니다', () => {
    expect(shouldDropSession('0', null)).toBe(true);
    expect(shouldDropSession('0', undefined)).toBe(true);
    expect(shouldDropSession('0', '')).toBe(true);
  });

  it('★ 표시가 아예 없으면 안 끊습니다 — 이 기능 전에 로그인한 사람들', () => {
    expect(shouldDropSession(null, null)).toBe(false);
    expect(shouldDropSession(undefined, undefined)).toBe(false);
    expect(shouldDropSession(null, '1')).toBe(false);
  });

  it('★ alive 에는 Max-Age 가 없습니다 — 있으면 창을 닫아도 안 사라집니다', () => {
    const [keep, alive] = keepCookies(false, true);

    expect(keep).toContain(`${KEEP_KEY}=0`);
    expect(keep).toContain(`Max-Age=${KEEP_MAX_AGE}`);

    expect(alive).toContain(`${ALIVE_KEY}=1`);
    expect(alive).not.toContain('Max-Age');
  });

  it('유지를 켜면 keep 이 1 입니다', () => {
    expect(keepCookies(true, true)[0]).toContain(`${KEEP_KEY}=1`);
  });

  it('★ http 에서는 Secure 를 안 붙입니다 — 붙이면 브라우저가 조용히 버립니다', () => {
    keepCookies(true, false).forEach((c) => expect(c).not.toContain('Secure'));
    keepCookies(true, true).forEach((c) => expect(c).toContain('Secure'));
  });

  it('★ 쿠키가 없으면 인증 서버에 안 묻습니다 — 홈페이지 손님이 여기 걸립니다', () => {
    expect(hasAuthCookie([])).toBe(false);
    expect(hasAuthCookie(['denflow.login.keep', 'denflow.login.alive'])).toBe(false);
  });

  it('쿠키가 있으면 묻습니다 — 쪼개져 담긴 것도 알아봅니다', () => {
    expect(hasAuthCookie(['sb-dzliwedyqkondvcwnvbh-auth-token'])).toBe(true);
    // 값이 길면 .0 .1 로 나뉩니다
    expect(hasAuthCookie(['sb-abc-auth-token.0', 'sb-abc-auth-token.1'])).toBe(true);
  });

  it('비슷하게 생긴 남의 쿠키에는 안 속습니다', () => {
    expect(hasAuthCookie(['sb-something-else'])).toBe(false);
    expect(hasAuthCookie(['my-auth-token'])).toBe(false);
  });

  it('로그아웃하면 둘 다 지웁니다', () => {
    const cleared = clearedKeepCookies(true);

    expect(cleared).toHaveLength(2);
    cleared.forEach((c) => expect(c).toContain('Max-Age=0'));
    expect(cleared.join(' ')).toContain(KEEP_KEY);
    expect(cleared.join(' ')).toContain(ALIVE_KEY);
  });
});


/*
  ★★ 로그인 뒤에 갈 곳 (2026-08-21 — 청구서 메일을 붙이며 생겼습니다).

    치과가 메일의 '청구서 보기' 를 누르면 로그인 화면이 뜹니다.
    어디로 가려 했는지를 기억해야 로그인 뒤에 그 청구서로 갑니다.

    ★ 그런데 이 칸은 **열린 문**이 되기 쉽습니다.
      `?next=https://가짜덴플로우.kr` 을 넣은 링크를 뿌리면, 우리
      도메인을 달고 있는 로그인 화면이 사람을 남의 사이트로 보내 줍니다.
*/
describe('로그인 뒤에 갈 곳', () => {
  it('우리 화면이면 그대로 갑니다', () => {
    expect(safeNext('/clinic/billing/2026-08')).toBe('/clinic/billing/2026-08');
    expect(safeNext('/design/orders')).toBe('/design/orders');
    expect(safeNext('/lab')).toBe('/lab');
    expect(safeNext('/clinic/orders?status=received')).toBe('/clinic/orders?status=received');
  });

  /*
    ★★ 진료실 폰 화면. 이게 빠져 있어서 폰에서 로그인하면 촬영 화면이
      아니라 데스크톱 홈으로 떨어졌습니다 (2026-08-23).
  */
  it('★ 진료실 폰 화면도 갑니다', () => {
    expect(safeNext('/m')).toBe('/m');
    expect(safeNext('/m/unsorted')).toBe('/m/unsorted');
  });

  // ★ 앞글자만 같은 남의 길에는 안 속습니다
  it('★ /m 으로 시작만 하는 딴 주소는 아닙니다', () => {
    expect(safeNext('/mail')).toBeNull();
    expect(safeNext('/master')).toBeNull();
  });

  // ★★ 여기가 이 함수의 전부입니다
  it('남의 사이트로는 절대 안 보냅니다', () => {
    for (const evil of [
      'https://evil.com',
      'http://evil.com',
      '//evil.com',
      '//denflow.kr.evil.com',
      '/\evil.com',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '\evil.com',
    ]) {
      expect(safeNext(evil)).toBeNull();
    }
  });

  // ★ 로그인 화면으로 되돌리면 제자리걸음입니다
  it('우리 화면이라도 로그인·가입으로는 안 보냅니다', () => {
    expect(safeNext('/login')).toBeNull();
    expect(safeNext('/signup')).toBeNull();
    expect(safeNext('/reset')).toBeNull();
    expect(safeNext('/')).toBeNull();
  });

  // ★ 앞에 비슷한 글자를 붙여 지나가려는 것
  it('비슷한 이름으로 지나가지 못합니다', () => {
    expect(safeNext('/clinicX')).toBeNull();
    expect(safeNext('/designer-evil')).toBeNull();
    expect(safeNext('/labs')).toBeNull();
  });

  it('빈 값이면 조용히 null — 로그인 자체는 막지 않습니다', () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext('   ')).toBeNull();
  });

  it('앞뒤 공백은 걷어냅니다', () => {
    expect(safeNext('  /clinic/billing/2026-08  ')).toBe('/clinic/billing/2026-08');
  });
});
