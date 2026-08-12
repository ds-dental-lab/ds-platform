// =========================================================
// 놓을 위치: src/app/(auth)/signup/page.tsx
//
// 가입. 로그인 화면과 같은 모양을 씁니다.
//
// ★ 가입만으로는 아무 데도 못 들어갑니다.
//   소속이 있어야 자리에 앉습니다. 소속이 없으면 볼 화면도 데이터도
//   없습니다 — RLS 가 전부 가립니다. 그래서 가입 자체를 잠글 필요가
//   없습니다. 막는 것은 소속입니다.
//
// ★ 들어오는 길이 둘입니다.
//   ① 스스로 신청 — 치과·기공소가 기관 이름을 적고 신청하면
//      **디자인센터가 승인**해야 자리가 생깁니다 (사용자 결정 2026-08-12).
//   ② 초대장 — 이미 있는 조직의 관리자가 직원을 부른 경우.
//      이때는 초대받은 그 이메일로 가입해야 합니다.
//
// ★ 디자인센터는 고를 수 없습니다.
//   *"회원가입창에서 유저가 디자인 가입 못하게 화면에서 없애줘"*.
//   화면에서 지우는 것으로 끝내지 않습니다 — signup_requests 의 check
//   제약이 마지막으로 막습니다. 주소로 직접 보내면 그만이니까요.
//
// ★ 메일 확인이 켜져 있으면 가입 직후 세션이 없습니다.
//   그때는 "메일함을 확인해 주세요" 로 갈라 줍니다. 그냥 로그인 화면으로
//   보내면 왜 안 되는지 모른 채 비밀번호만 다시 칩니다.
// =========================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  SIGNUP_SECTORS,
  SECTOR_LABEL,
  SECTOR_HINT,
  checkSignup,
  MIN_PASSWORD,
  type SignupSector,
} from '@/server/domain/signup';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState<SignupSector>('clinic');
  const [orgName, setOrgName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [mailSent, setMailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    const verdict = checkSignup({ name, email, password, orgType, orgName });
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }

    setError('');
    setLoading(true);

    const supabase = createClient();
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
      /*
        ★ 기관 정보를 여기 실어 보냅니다.
          가입 직후에는 세션이 없어(메일 확인) 서버 액션을 부를 수
          없습니다. DB 트리거(handle_new_user)가 이 값을 읽어
          신청서를 만듭니다 — 사람 손을 한 번도 안 거칩니다.
      */
      options: { data: { name: name.trim(), org_type: orgType, org_name: orgName.trim() } },
    });

    setLoading(false);

    if (signError) {
      setError(
        signError.message.includes('already')
          ? '이미 가입된 이메일입니다. 로그인해 주세요.'
          : `가입하지 못했습니다: ${signError.message}`,
      );
      return;
    }

    // 메일 확인이 켜져 있으면 여기서 세션이 없습니다
    if (!data.session) {
      setMailSent(true);
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

        {mailSent ? (
          <>
            <p className="auth-done">
              <b>{email}</b> 으로 확인 메일을 보냈습니다.
              <br />
              메일 안의 링크를 누르면 가입이 끝납니다.
            </p>

            {/* ★ 여기서 끝이 아니라는 것을 지금 말해 줍니다.
                메일 확인만 하고 "왜 안 들어가지네" 하며 기다리는 일을 막습니다 */}
            <p className="auth-hint">
              그다음 <b>디자인센터의 승인</b>이 있어야 이용할 수 있습니다. 승인되면
              바로 로그인하실 수 있습니다.
            </p>
            <Link href="/login" className="btn-primary btn-link">
              로그인으로
            </Link>
          </>
        ) : (
          <>
            {/* ★ 승인이 필요하다는 것을 누르기 전에 알려 줍니다 */}
            <p className="auth-hint">
              가입하면 <b>디자인센터의 승인</b> 뒤에 이용할 수 있습니다. 직원으로
              초대받으셨다면 <b>초대받은 그 이메일</b>로 가입해 주세요.
            </p>

            {/* ★ 디자인센터는 여기 없습니다 (domain/signup 의 SIGNUP_SECTORS) */}
            <div className="sector-pick">
              {SIGNUP_SECTORS.map((sector) => (
                <button
                  key={sector}
                  type="button"
                  className={'sector' + (orgType === sector ? ' on' : '')}
                  aria-pressed={orgType === sector}
                  onClick={() => setOrgType(sector)}
                >
                  <b>{SECTOR_LABEL[sector]}</b>
                  <i>{SECTOR_HINT[sector]}</i>
                </button>
              ))}
            </div>

            <div className="auth-fields">
              <input
                className="ctl"
                type="text"
                placeholder={`${SECTOR_LABEL[orgType]} 이름`}
                value={orgName}
                autoComplete="organization"
                onChange={(e) => setOrgName(e.target.value)}
              />

              <input
                className="ctl"
                type="text"
                placeholder="이름 (담당자)"
                value={name}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
              />

              <input
                className="ctl"
                type="email"
                placeholder="이메일"
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="pw-wrap">
                <input
                  className="ctl"
                  type={showPw ? 'text' : 'password'}
                  placeholder={`비밀번호 (${MIN_PASSWORD}자 이상)`}
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
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

            <button className="btn-primary" onClick={handleSignup} disabled={loading}>
              {loading ? '가입 중…' : '가입'}
            </button>

            <p className="auth-join">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="link strong">
                로그인
              </Link>
            </p>
          </>
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
.auth-hint{
  margin:0 0 16px; padding:10px 12px; border-radius:6px; background:#FEF8EC;
  font-size:12.5px; line-height:1.6; color:#8A6320;
}
.auth-hint b{font-weight:700}
.sector-pick{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:9px}
.sector{
  display:flex; flex-direction:column; gap:3px; align-items:flex-start;
  padding:11px 12px; border-radius:6px; border:1px solid var(--line-2);
  background:var(--surface); cursor:pointer; text-align:left;
  transition:border-color .12s, background .12s;
}
.sector b{font-size:14px; font-weight:700; color:var(--ink)}
.sector i{font-size:11.5px; font-style:normal; color:#98A2B3; line-height:1.4}
.sector:hover{border-color:#BAC2CE}
.sector.on{border-color:var(--brand); background:#F2F7FE; box-shadow:0 0 0 3px rgba(18,121,232,.10)}
.sector.on b{color:var(--brand)}
.auth-done{margin:0 0 20px; text-align:center; font-size:13.5px; line-height:1.7; color:var(--ink-2)}
.auth-done b{color:var(--ink); font-weight:700}
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
  display:block; width:100%; height:48px; margin-top:18px; border-radius:5px; border:none;
  background:var(--brand); color:#fff; font-size:15px; font-weight:700;
  letter-spacing:-0.02em; cursor:pointer; transition:background .12s; text-align:center;
}
.btn-link{line-height:48px; text-decoration:none}
.btn-primary:hover:not(:disabled){background:var(--brand-dark)}
.btn-primary:disabled{background:#D5DAE2; color:#8E98A8; cursor:not-allowed}
.auth-join{margin:22px 0 0; text-align:center; font-size:13px; color:var(--ink-2)}
.link{color:var(--ink-2); cursor:pointer; text-decoration:none}
.link.strong{font-weight:600; color:var(--brand)}
`;
