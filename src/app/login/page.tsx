// =========================================================
// 놓을 위치: src/app/login/page.tsx  (기존 내용 전체 교체)
// 프로토타입 dental-auth.html 의 로그인 화면을 옮긴 것입니다.
// 색·글꼴·간격은 프로토타입 값을 그대로 썼습니다.
// =========================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    router.push('/');
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

        <div className="auth-fields">
          <input
            className="ctl"
            type="email"
            placeholder="이메일"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />

          <div className="pw-wrap">
            <input
              className="ctl"
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
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
        </div>

        {error && <p className="auth-err">{error}</p>}

        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? '확인 중…' : '로그인'}
        </button>

        <p className="auth-join">
          DS Flow 회원이 아니신가요? <span className="link strong">회원가입</span>
        </p>
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
.auth-logo{display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:30px}
.logo-mark{width:46px; height:32px; flex-shrink:0}
.logo-txt{display:inline-flex; align-items:baseline; gap:.30em; font-size:24px; font-weight:800; letter-spacing:-0.045em; line-height:1}
.logo-txt b{color:#1B2A4A; font-weight:800}
.logo-txt i{color:#9AA3AE; font-weight:600; font-style:normal; letter-spacing:.01em}
.auth-fields{display:flex; flex-direction:column; gap:9px}
.ctl{
  width:100%; height:44px; padding:0 13px; border-radius:5px;
  border:1px solid var(--line-2); background:var(--surface); outline:none; font-size:14px;
  transition:border-color .12s, box-shadow .12s;
}
.ctl:focus{border-color:var(--brand); box-shadow:0 0 0 3px rgba(18,121,232,.12)}
.ctl::placeholder{color:#BAC2CE}
.pw-wrap{position:relative}
.pw-wrap .ctl{padding-right:44px}
.eye{
  position:absolute; right:11px; top:50%; transform:translateY(-50%);
  width:26px; height:26px; border-radius:5px; display:grid; place-items:center;
  color:#98A2B3; background:none; border:none; cursor:pointer;
}
.eye:hover{color:var(--ink-2); background:var(--bg)}
.auth-err{margin:12px 0 0; font-size:13px; color:var(--danger); line-height:1.5}
.btn-primary{
  width:100%; height:48px; margin-top:18px; border-radius:5px; border:none;
  background:var(--brand); color:#fff; font-size:15px; font-weight:700;
  letter-spacing:-0.02em; cursor:pointer; transition:background .12s;
}
.btn-primary:hover:not(:disabled){background:var(--brand-dark)}
.btn-primary:disabled{background:#D5DAE2; color:#8E98A8; cursor:not-allowed}
.auth-join{margin:22px 0 0; text-align:center; font-size:13px; color:var(--ink-2)}
.link{color:var(--ink-2); cursor:pointer}
.link.strong{font-weight:600; color:var(--brand)}
`;
