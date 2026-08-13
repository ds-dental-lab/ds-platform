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
import { loginProblem, rememberableEmail } from '@/server/domain/login';

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
