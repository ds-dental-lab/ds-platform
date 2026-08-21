// =========================================================
// 놓을 위치: src/app/login/page.tsx  (기존 내용 전체 교체)
// 프로토타입 dental-auth.html 의 로그인 화면을 옮긴 것입니다.
// 색·글꼴·간격은 프로토타입 값을 그대로 썼습니다.
// =========================================================

'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  loginProblem,
  rememberableEmail,
  REMEMBER_KEY,
  keepCookies,
  hasAuthCookie,
  safeNext,
} from '@/server/domain/login';
import DenFlowLogo from '@/components/brand/DenFlowLogo';

/* 다른 탭에서 지웠을 때도 따라옵니다 */
function subscribeRemembered(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function readRemembered(): string {
  return window.localStorage.getItem(REMEMBER_KEY) ?? '';
}

export default function LoginPage() {
  const router = useRouter();

  /*
    ★ 이미 로그인해 있으면 제 화면으로 보냅니다 (사용자 요청 2026-08-14 —
      "즐겨찾기에 있는 denflow 누를 때마다 로그인 되어있는 상태로").

      `/` 는 원래 그렇게 돕니다. 그런데 즐겨찾기에 **`/login` 을 담아 둔**
      분에게는 로그인해 두어도 매번 빈 칸 두 개가 뜹니다. 사람은 그걸 보고
      "또 풀렸네" 라고 읽습니다.

    ★ 쿠키만 보고 보내지 **않습니다.** 쿠키는 남아 있는데 세션이 죽은
      경우가 있는데, 그때 `/` 로 보내면 회사 홈페이지가 뜨고, 거기서
      로그인을 누르면 다시 여기로 와서 또 보내집니다 — **뱅뱅 돕니다.**
      그래서 토큰을 실제로 풀어 보고, 풀릴 때만 보냅니다.

    ★ 쿠키가 아예 없으면 아무것도 안 합니다. 처음 오는 분이 대부분이고,
      그분들에게 쓸데없는 확인을 시키지 않습니다.

    ★ `replace` 입니다. `push` 로 보내면 뒤로가기가 로그인 화면으로
      돌아오고, 거기서 또 튕겨 나갑니다.
  */
  useEffect(() => {
    if (!hasAuthCookie(document.cookie.split('; ').map((c) => c.split('=')[0]))) return;

    let alive = true;

    createClient()
      .auth.getClaims()
      .then(({ data }) => {
        if (alive && data?.claims?.sub) router.replace('/');
      })
      .catch(() => {
        // 못 풀었으면 그냥 로그인 화면입니다
      });

    return () => {
      alive = false;
    };
  }, [router]);

  /*
    ★ 담아 둔 아이디는 **읽는 값**이지 상태가 아닙니다.
      효과 안에서 setState 로 채우면, 화면이 한 번 빈 칸으로 그려졌다가
      다시 그려집니다(React 19 의 린트도 이것을 막습니다).
      useSyncExternalStore 는 서버에서는 빈 값, 브라우저에서는 담아 둔
      값을 내주어 **그림이 한 번에** 맞습니다.
      [[UnreadPing]] 의 소리 스위치와 같은 방식입니다.
  */
  const savedEmail = useSyncExternalStore(subscribeRemembered, readRemembered, () => '');

  /** 사람이 한 글자라도 치면 그때부터는 담아 둔 값 대신 이쪽입니다 */
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? rememberableEmail(savedEmail) ?? '';
  const setEmail = setTypedEmail;

  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * 아이디 기억하기. (사용자 요청 2026-08-13)
   *
   * ★ 처음 오는 사람에게는 **켜져 있습니다.** 매일 같은 자리에서
   *   같은 계정으로 들어오는 사람들이라, 꺼 두면 아무도 안 켭니다.
   *
   * ★ 담는 것은 **로그인이 된 다음**입니다. 오타 난 주소를 담아 두면
   *   다음에도 그 오타로 시작합니다.
   *
   * ★ 비밀번호는 안 담습니다. 치과 데스크 컴퓨터는 여럿이 같이 씁니다.
   */
  const [remember, setRemember] = useState(true);

  /**
   * 로그인 상태 유지. (사용자 요청 2026-08-14)
   *
   * ★ 켜면 **로그아웃을 누를 때까지** 유지됩니다. 창을 닫아도, 컴퓨터를
   *   껐다 켜도 그대로입니다. 기본은 켜짐 — 매일 같은 자리에서 같은
   *   계정으로 들어오는 분들입니다.
   *
   * ★ 끄면 **창을 닫는 순간 풀립니다.** 치과 데스크 컴퓨터는 여럿이
   *   같이 쓰기 때문에 이 선택지가 필요합니다.
   *
   * ★ 아이디 기억하기와 다릅니다. 저쪽은 **칸을 채워 두는 것**이고,
   *   이쪽은 **다시 안 물어보는 것**입니다. 둘을 하나로 묶으면
   *   "아이디만 채워 두고 비밀번호는 다시 받고 싶다" 가 불가능해집니다.
   */
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  /** 확인 메일을 다시 보낼 수 있는 상황인가 */
  const [canResend, setCanResend] = useState(false);
  const [resent, setResent] = useState('');

  async function handleResend() {
    setResent('');

    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });

    setResent(
      error
        ? '메일을 다시 보내지 못했습니다. 잠시 뒤에 시도해 주세요.'
        : '확인 메일을 다시 보냈습니다. 메일함과 스팸함을 봐 주세요.',
    );
  }

  async function handleLogin() {
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setError('');
    setCanResend(false);
    setResent('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      /*
        ★ 원인마다 다른 말을 합니다 (사용자 신고 2026-08-13).
          전에는 무슨 오류든 "비밀번호가 올바르지 않습니다" 였습니다.
          실제 원인이 **이메일 확인 전**이었던 사람이 비밀번호만
          계속 다시 쳤습니다 — 영원히 안 됩니다.
      */
      const problem = loginProblem(error.code);
      setError(problem.message);
      setCanResend(problem.canResend);
      return;
    }

    /*
      ★ 여기서 담습니다 — 로그인이 **된 다음**입니다.
        끄면 지웁니다. 껐는데 옛 값이 남아 있으면 다음에 또 채워집니다.
    */
    const keep = remember ? rememberableEmail(email) : null;

    if (keep) window.localStorage.setItem(REMEMBER_KEY, keep);
    else window.localStorage.removeItem(REMEMBER_KEY);

    /*
      ★ 유지 여부를 표시 두 장으로 남깁니다 (규칙은 domain/login).
        인증 쿠키 자체는 안 건드립니다 — 라이브러리가 우리 값을
        덮어쓰고, 손으로 만들다 틀리면 아무도 로그인을 못 합니다.
    */
    keepCookies(keepSignedIn, window.location.protocol === 'https:').forEach((c) => {
      document.cookie = c;
    });

    /*
      ★ 오려던 곳이 있으면 그리로 돌려보냅니다 (2026-08-21).
        메일의 '청구서 보기' 를 누른 사람이 로그인 뒤에 HOME 으로
        떨어지지 않게요. 못 쓰는 값이면 safeNext 가 null 을 주고,
        그때는 평소대로 HOME 입니다.

      ★ useSearchParams() 를 안 씁니다. 그 훅을 쓰면 이 화면을
        **미리 만들어 둘 수 없게 되어**(Suspense 필요) 빌드가 막힙니다.
        어차피 누를 때만 필요한 값이고, 그때는 브라우저 안이라
        주소에서 바로 읽으면 됩니다.
    */
    const next = new URLSearchParams(window.location.search).get('next');
    router.push(safeNext(next) ?? '/');
    router.refresh();
  }

  return (
    <div className="auth-stage">
      <style>{css}</style>

      <div className="auth-card">
        <div className="auth-logo">
          <DenFlowLogo markHeight={26} fontSize={24} />
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

          {/*
            ★ 둘은 다른 것입니다.
              '아이디 기억하기' 는 다음에 **칸을 채워 두는** 것이고,
              '로그인 상태 유지' 는 다음에 **안 물어보는** 것입니다.
              하나로 묶으면 "아이디는 채워 두되 비밀번호는 다시 받고
              싶다" 를 못 하게 됩니다 — 데스크 컴퓨터에서 흔한 요구입니다.
          */}
          <div className="keeps">
            <label className="keep">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>아이디 기억하기</span>
            </label>

            <label className="keep">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
              />
              <span>로그인 상태 유지</span>
            </label>
          </div>
        </div>

        {error && <p className="auth-err">{error}</p>}

        {/* ★ 막힌 사람에게 빠져나갈 길을 같이 줍니다 */}
        {canResend && !resent && (
          <button type="button" className="auth-resend" onClick={handleResend}>
            확인 메일 다시 보내기
          </button>
        )}
        {resent && <p className="auth-note">{resent}</p>}

        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? '확인 중…' : '로그인'}
        </button>

        {/*
          ★ 한 줄에 들어가야 합니다 (사용자 요청 2026-08-13).
            전에는 '비밀번호 찾기' 의 끝 글자만 다음 줄로 넘어갔습니다.
            카드가 380px 인데 안쪽은 316px 뿐이라 20px 쯤 모자랐습니다.

            고친 것 둘.
            ① 앞말에서 'DenFlow' 를 뺐습니다. 바로 위에 마크와 이름이
               있어 두 번 말하는 셈이었습니다.
            ② 두 링크와 가운뎃점을 한 덩어리로 묶어 **그 안에서는 안
               쪼개지게** 했습니다. 글자를 키우거나 창을 좁혀도 둘이
               갈라서지 않습니다.
        */}
        <p className="auth-join">
          회원이 아니신가요?{' '}
          <span className="auth-links">
            <Link href="/signup" className="link strong">
              회원가입
            </Link>
            <span className="sep">·</span>
            <Link href="/reset" className="link">
              비밀번호 찾기
            </Link>
          </span>
        </p>

        {/* ★ 약관과 처리방침은 로그인 없이 닿아야 합니다 */}
        <p className="auth-legal">
          <Link href="/terms" className="link">
            이용약관
          </Link>
          <span className="sep">·</span>
          <Link href="/privacy" className="link">
            개인정보 처리방침
          </Link>
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
.auth-err{margin:12px 0 0; font-size:13px; color:var(--danger); line-height:1.5; white-space:pre-line}
/* 막힌 사람이 빠져나갈 길. 로그인 버튼과 헷갈리지 않게 테두리만 둡니다 */
.auth-resend{margin:10px 0 0; width:100%; height:38px; border:1px solid var(--line-2); border-radius:8px; background:#fff; font-size:13px; font-weight:700; color:#4A5567; cursor:pointer}
.auth-resend:hover{background:#F4F6F9}
.auth-note{margin:10px 0 0; font-size:12.5px; color:#4A5567; line-height:1.5}
.btn-primary{
  width:100%; height:48px; margin-top:18px; border-radius:5px; border:none;
  background:var(--brand); color:#fff; font-size:15px; font-weight:700;
  letter-spacing:-0.02em; cursor:pointer; transition:background .12s;
}
.btn-primary:hover:not(:disabled){background:var(--brand-dark)}
.btn-primary:disabled{background:#D5DAE2; color:#8E98A8; cursor:not-allowed}
.auth-join{margin:22px 0 0; text-align:center; font-size:13px; color:var(--ink-2)}
.auth-links{white-space:nowrap}
/* 아이디 기억하기 — 칸들 바로 아래, 왼쪽 맞춤 */
/* ★ 좁은 화면에서는 두 줄로 접힙니다. 한 줄에 우겨 넣으면 글씨가 잘립니다 */
.keeps{display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:3px}
.keep{display:flex; align-items:center; gap:7px; cursor:pointer;
  font-size:12.5px; color:var(--ink-2); user-select:none}
.keep input{width:15px; height:15px; margin:0; cursor:pointer; accent-color:var(--brand)}
.auth-legal{margin:10px 0 0; text-align:center; font-size:12px; color:#98A2B3}
.link{color:var(--ink-2); cursor:pointer; text-decoration:none}
.link:hover{text-decoration:underline}
.link.strong{font-weight:600; color:var(--brand)}
.sep{margin:0 7px; color:#C4CBD6}
`;
