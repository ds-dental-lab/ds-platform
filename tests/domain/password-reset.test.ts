// =========================================================
// 놓을 위치: tests/domain/password-reset.test.ts
// 기준: 사용자 요청 2026-08-12 — "가입한 이메일로 인증번호 발송해서
//       확인버튼 누르거나 입력하면 새비밀번호 입력할수 잇게"
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  checkEmail,
  normalizeCode,
  checkCode,
  checkNewPassword,
  sentMessage,
  resendLabel,
  MIN_CODE,
  MAX_CODE,
  MIN_PASSWORD,
} from '@/server/domain/password-reset';

describe('이메일', () => {
  it('보통 주소는 통과합니다', () => {
    expect(checkEmail('won@clinic.co.kr')).toEqual({ ok: true });
  });

  it('앞뒤 공백은 봐 줍니다', () => {
    expect(checkEmail('  won@clinic.co.kr  ')).toEqual({ ok: true });
  });

  it('비어 있으면 막습니다', () => {
    expect(checkEmail('   ').ok).toBe(false);
  });

  it('모양이 아니면 막습니다', () => {
    expect(checkEmail('won').ok).toBe(false);
    expect(checkEmail('won@clinic').ok).toBe(false);
  });
});

describe('인증번호 다듬기', () => {
  // ★ 메일에서 복사하면 공백·하이픈이 딸려 옵니다.
  //   그걸로 "맞지 않습니다" 를 띄우면 사람은 자기가 잘못 본 줄 압니다.
  it('★ 공백과 하이픈을 걷어냅니다', () => {
    expect(normalizeCode(' 123-456 ')).toBe('123456');
    expect(normalizeCode('12 34 56')).toBe('123456');
  });

  it('숫자가 아닌 것은 버립니다', () => {
    expect(normalizeCode('abc123456xyz')).toBe('123456');
  });

  // ★ 처음에 6자리로 박았다가 실제로 받아 보니 8자리였습니다.
  //   자릿수를 하나로 박으면 맞는 번호를 들고도 칸에 다 못 넣습니다.
  it('★ 8자리도 그대로 받습니다', () => {
    expect(normalizeCode('12345678')).toBe('12345678');
  });

  it('그래도 한도는 있습니다', () => {
    expect(normalizeCode('1'.repeat(20))).toHaveLength(MAX_CODE);
  });

  it('숫자가 하나도 없으면 빈 값', () => {
    expect(normalizeCode('안녕하세요')).toBe('');
  });
});

describe('인증번호 검사', () => {
  it('여섯 자리면 통과', () => {
    expect(checkCode('123456')).toEqual({ ok: true });
  });

  it('★ 여덟 자리도 통과 — 이 프로젝트가 실제로 보내는 자릿수입니다', () => {
    expect(checkCode('12345678')).toEqual({ ok: true });
  });

  it('다듬은 뒤에 셉니다 — 하이픈이 있어도 통과', () => {
    expect(checkCode('123-456')).toEqual({ ok: true });
  });

  it('비어 있으면 막습니다', () => {
    expect(checkCode('').ok).toBe(false);
  });

  it('모자라면 막습니다', () => {
    const verdict = checkCode('123');

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('짧습니다');
  });

  it('최소 자릿수는 6입니다', () => {
    expect(checkCode('1'.repeat(MIN_CODE)).ok).toBe(true);
    expect(checkCode('1'.repeat(MIN_CODE - 1)).ok).toBe(false);
  });
});

describe('새 비밀번호', () => {
  it('8자 이상이고 두 번이 같으면 통과', () => {
    expect(checkNewPassword('newpass123', 'newpass123')).toEqual({ ok: true });
  });

  it('비어 있으면 막습니다', () => {
    expect(checkNewPassword('', '').ok).toBe(false);
  });

  it('짧으면 막습니다', () => {
    const verdict = checkNewPassword('short', 'short');

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain(String(MIN_PASSWORD));
  });

  // ★ 한 번만 받으면 오타가 그대로 새 비밀번호가 됩니다.
  //   그 순간 그 사람은 방금 바꾼 비밀번호로도 못 들어옵니다.
  it('★ 두 번이 다르면 막습니다', () => {
    const verdict = checkNewPassword('newpass123', 'newpass124');

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('다릅니다');
  });

  // ★ 길이를 먼저 봅니다 — 짧은데 "다릅니다" 만 뜨면 두 번 고칩니다
  it('★ 짧으면 길이를 먼저 말합니다', () => {
    const verdict = checkNewPassword('abc', 'xyz');

    expect(verdict.ok === false && verdict.reason).toContain('8자');
  });
});

describe('화면에 쓰는 글', () => {
  // ★ 오타로 엉뚱한 곳에 보내 놓고 메일함만 들여다보는 일을 막습니다
  it('★ 어디로 보냈는지 그대로 적어 줍니다', () => {
    expect(sentMessage(' won@clinic.co.kr ')).toContain('won@clinic.co.kr');
  });

  it('스팸함도 일러 줍니다', () => {
    expect(sentMessage('a@b.co')).toContain('스팸함');
  });

  // ★ 메일에 번호가 없을 수도 있습니다 (템플릿 설정에 달렸습니다).
  //   링크를 눌러도 된다는 걸 모르면 번호를 찾다가 그냥 덮습니다.
  it('★ 링크를 눌러도 된다고 말해 줍니다', () => {
    expect(sentMessage('a@b.co')).toContain('링크');
  });

  /*
    ★ 인증 서버는 **가입 안 된 주소에도 성공을 돌려줍니다** (2026-08-13 확인:
      /auth/v1/recover → 200 {}). 일부러 그렇습니다 — 오류를 내면 주소를
      하나씩 넣어 보며 회원인지 알아낼 수 있습니다.

      그래서 화면은 늘 다음 칸으로 넘어갑니다. "보냈습니다" 라고 적으면
      오타 난 주소를 넣은 사람이 **오지 않을 메일을 기다립니다.**
  */
  it('★ "보냈습니다" 라고 딱 잘라 말하지 않습니다', () => {
    const msg = sentMessage('typo@gmial.com');

    expect(msg).toContain('가입된 주소라면');
    expect(msg).not.toContain('보냈습니다');
  });

  it('★ 안 오면 주소부터 다시 보라고 합니다', () => {
    expect(sentMessage('a@b.co')).toContain('주소를 다시 확인');
  });

  it('재발송은 남은 초를 보여 줍니다', () => {
    expect(resendLabel(42)).toBe('재발송 (42초)');
    expect(resendLabel(0)).toBe('인증번호 다시 받기');
  });
});
