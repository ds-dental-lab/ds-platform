// =========================================================
// 놓을 위치: src/app/(auth)/reset/page.tsx
//
// 비밀번호 찾기. (사용자 요청 2026-08-12)
//   ① 가입한 이메일 → 인증번호 발송
//   ② 메일로 온 인증번호 → 확인
//   ③ 새 비밀번호 → 저장하고 로그인 화면으로
//
// ★ 한 화면에서 세 걸음을 걷습니다.
//   페이지를 옮기면 새로고침 한 번에 인증이 날아갑니다. 사람은 메일을
//   보러 창을 왔다 갔다 하므로, 그 사이에 화면이 초기화되면 안 됩니다.
//
// ★ 규칙은 domain/password-reset 이 쥡니다. 여기는 그리기만 합니다.
// =========================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  checkEmail,
  checkCode,
  checkNewPassword,
  normalizeCode,
  sentMessage,
  resendLabel,
  MAX_CODE,
  MIN_PASSWORD,
  RESEND_COOLDOWN,
  type Step,
} from '@/server/domain/password-reset';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 재발송까지 남은 시간
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /**
   * ★ 그 이메일이 있는지 없는지 말하지 않습니다.
   *   "가입되지 않은 이메일입니다" 는 남의 가입 여부를 확인해 주는
   *   창구가 됩니다. 무엇을 넣든 보냈다고 답합니다.
   */
  async function sendCode() {
    const verdict = checkEmail(email);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }

    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim());

    setLoading(false);

    // 너무 자주 누른 것만은 알려 줍니다 — 기다리면 되는 일이라서
    if (sendError?.message?.toLowerCase().includes('rate limit')) {
      setError('메일을 너무 자주 보냈습니다. 잠시 뒤에 다시 눌러 주세요.');
      return;
    }

    setNotice(sentMessage(email));
    setCooldown(RESEND_COOLDOWN);
    setStep('code');
  }

  async function verify() {
    const verdict = checkCode(code);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }

    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: normalizeCode(code),
      type: 'recovery',
    });

    setLoading(false);

    if (otpError) {
      setError('인증번호가 맞지 않거나 시간이 지났습니다. 다시 받아 주세요.');
      return;
    }

    setNotice('');
    setStep('password');
  }

  async function save() {
    const verdict = checkNewPassword(password, confirm);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }

    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: saveError } = await supabase.auth.updateUser({ password });

    if (saveError) {
      setLoading(false);
      setError('비밀번호를 바꾸지 못했습니다. 처음부터 다시 해 주세요.');
      return;
    }

    /*
      ★ 바꾸고 나서 로그아웃합니다.
        인증번호를 확인하는 순간 이미 로그인된 상태가 됩니다. 그대로
        들여보내면 **새 비밀번호가 진짜 되는지 아무도 확인하지 않은 채**
        넘어갑니다. 한 번 쳐 보고 들어가는 편이 안전합니다.
    */
    await supabase.auth.signOut();
    setLoading(false);
    setStep('done');
    router.refresh();
  }

  return (
    <div className="auth-stage">
      <style>{css}</style>

      <div className="auth-card">
        <div className="auth-logo">
          <svg className="logo-mark" viewBox="0 0 142 100" fill="none" aria-label="DS Flow">
            <path d="M10 8 H40 A42 42 0 0 1 40 92 H10 Z" stroke="#1B2A4A" strokeWidth="12" strokeLinejoin="miter" fill="none" />
            <path d="M126 58 C126 78 108 92 88 92 C74 92 62 84 58 72 C54 60 62 50 74 46" stroke="#1B2A4A" strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M74 46 C86 42 100 40 108 34" stroke="#1B2A4A" strokeWidth="12" strokeLinecap="round" fill="none" />
          </svg>
          <span className="logo-txt">
            <b>DS</b>
            <i>FLOW</i>
          </span>
        </div>

        <h1 className="auth-title">{step === 'done' ? '비밀번호를 바꿨습니다' : '비밀번호 찾기'}</h1>
        <p className="auth-lead">
          {step === 'email' && '가입할 때 쓴 이메일로 인증번호를 보내 드립니다.'}
          {step === 'code' && '메일로 받은 번호를 그대로 넣어 주세요.'}
          {step === 'password' && '새 비밀번호를 정해 주세요.'}
          {step === 'done' && '새 비밀번호로 로그인해 주세요.'}
        </p>

        <div className="auth-fields">
          {step === 'email' && (
            <input
              className="ctl"
              type="email"
              placeholder="가입한 이메일"
              value={email}
              autoComplete="username"
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            />
          )}

          {step === 'code' && (
            <input
              className="ctl code"
              type="text"
              inputMode="numeric"
              placeholder="인증번호"
              maxLength={MAX_CODE}
              value={code}
              autoFocus
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
          )}

          {step === 'password' && (
            <>
              <div className="pw-wrap">
                <input
                  className="ctl"
                  type={showPw ? 'text' : 'password'}
                  placeholder={`새 비밀번호 (${MIN_PASSWORD}자 이상)`}
                  value={password}
                  autoComplete="new-password"
                  autoFocus
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="eye"
                  aria-label="비밀번호 표시"
                  onClick={() => setShowPw(!showPw)}
                >
                  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M1.8 10S4.7 4.8 10 4.8 18.2 10 18.2 10 15.3 15.2 10 15.2 1.8 10 1.8 10Z" />
                    <circle cx="10" cy="10" r="2.6" />
                  </svg>
                </button>
              </div>

              <input
                className="ctl"
                type={showPw ? 'text' : 'password'}
                placeholder="새 비밀번호 확인"
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            </>
          )}
        </div>

        {notice && step === 'code' && <p className="auth-notice">{notice}</p>}
        {error && <p className="auth-err">{error}</p>}

        {step === 'email' && (
          <button className="btn-primary" onClick={sendCode} disabled={loading}>
            {loading ? '보내는 중…' : '인증번호 받기'}
          </button>
        )}

        {step === 'code' && (
          <>
            <button className="btn-primary" onClick={verify} disabled={loading}>
              {loading ? '확인 중…' : '확인'}
            </button>

            <button
              className="btn-ghost"
              onClick={sendCode}
              disabled={loading || cooldown > 0}
            >
              {resendLabel(cooldown)}
            </button>
          </>
        )}

        {step === 'password' && (
          <button className="btn-primary" onClick={save} disabled={loading}>
            {loading ? '저장 중…' : '비밀번호 바꾸기'}
          </button>
        )}

        {step === 'done' && (
          <Link href="/login" className="btn-primary btn-link">
            로그인하기
          </Link>
        )}

        {step !== 'done' && (
          <p className="auth-join">
            <Link href="/login" className="link strong">
              로그인으로 돌아가기
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

const css = `
.auth-stage{
  --surface:#FFFFFF; --line-2:#DDE2EA; --ink:#1A2130; --ink-2:#4A5567;
  --brand:#1279E8; --brand-dark:#0F68C9; --danger:#D8453F; --bg:#F4F6F9;
  min-height:100vh; background:var(--bg); color:var(--ink);
  display:grid; place-items:center; padding:24px;
  font-family:Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;
}
.auth-card{
  width:100%; max-width:380px; background:var(--surface);
  border:1px solid #E8EBF0; border-radius:10px; padding:38px 32px 30px;
  box-shadow:0 1px 3px rgba(26,33,48,.04);
}
.auth-logo{display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:26px}
.logo-mark{width:46px; height:32px; flex-shrink:0}
.logo-txt{display:inline-flex; align-items:baseline; gap:.30em; font-size:24px; font-weight:800; letter-spacing:-0.045em; line-height:1}
.logo-txt b{color:#1B2A4A; font-weight:800}
.logo-txt i{color:#9AA3AE; font-weight:600; font-style:normal; letter-spacing:.01em}
.auth-title{margin:0 0 6px; text-align:center; font-size:17px; font-weight:800; letter-spacing:-0.03em}
.auth-lead{margin:0 0 20px; text-align:center; font-size:13px; line-height:1.6; color:var(--ink-2)}
.auth-fields{display:flex; flex-direction:column; gap:9px}
.ctl{
  width:100%; height:44px; padding:0 13px; border-radius:5px;
  border:1px solid var(--line-2); background:var(--surface); outline:none; font-size:14px;
  transition:border-color .12s, box-shadow .12s;
}
.ctl:focus{border-color:var(--brand); box-shadow:0 0 0 3px rgba(18,121,232,.12)}
.ctl::placeholder{color:#BAC2CE}
.ctl.code{
  text-align:center; font-size:22px; font-weight:700;
  letter-spacing:.28em; text-indent:.28em; font-variant-numeric:tabular-nums;
}
.pw-wrap{position:relative}
.pw-wrap .ctl{padding-right:44px}
.eye{
  position:absolute; right:11px; top:50%; transform:translateY(-50%);
  width:26px; height:26px; border-radius:5px; display:grid; place-items:center;
  color:#98A2B3; background:none; border:none; cursor:pointer;
}
.eye:hover{color:var(--ink-2); background:var(--bg)}
.auth-notice{margin:12px 0 0; font-size:12.5px; color:var(--ink-2); line-height:1.6}
.auth-err{margin:12px 0 0; font-size:13px; color:var(--danger); line-height:1.5}
.btn-primary{
  width:100%; height:48px; margin-top:18px; border-radius:5px; border:none;
  background:var(--brand); color:#fff; font-size:15px; font-weight:700;
  letter-spacing:-0.02em; cursor:pointer; transition:background .12s;
}
.btn-primary:hover:not(:disabled){background:var(--brand-dark)}
.btn-primary:disabled{background:#D5DAE2; color:#8E98A8; cursor:not-allowed}
.btn-link{display:grid; place-items:center; text-decoration:none; box-sizing:border-box}
.btn-ghost{
  width:100%; height:40px; margin-top:8px; border-radius:5px;
  border:1px solid var(--line-2); background:var(--surface);
  color:var(--ink-2); font-size:13.5px; font-weight:600; cursor:pointer;
}
.btn-ghost:hover:not(:disabled){background:var(--bg)}
.btn-ghost:disabled{color:#B4BCC8; cursor:not-allowed}
.auth-join{margin:22px 0 0; text-align:center; font-size:13px; color:var(--ink-2)}
.link{color:var(--ink-2); cursor:pointer; text-decoration:none}
.link.strong{font-weight:600; color:var(--brand)}
`;
