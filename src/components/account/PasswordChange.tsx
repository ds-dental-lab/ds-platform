// =========================================================
// 놓을 위치: src/components/account/PasswordChange.tsx
//
// 로그인한 사람이 제 비밀번호를 바꿉니다. (사용자 요청 2026-08-25)
//
// ★★ **전에는 이 길이 없었습니다.** 바꾸려면 로그아웃하고 '비밀번호
//   찾기' 로 들어가 메일을 기다렸다가 인증번호를 받아야 했습니다 —
//   잊어버린 것도 아니고 그냥 바꾸고 싶은 사람에게 그건 너무 멉니다.
//   그래서 대부분 안 바꿉니다. 안 바꾸는 비밀번호가 제일 위험합니다.
//
// ★★ **지금 비밀번호를 먼저 받습니다.** 인증 서버는 로그인만 되어
//   있으면 그냥 바꿔 줍니다. 그러면 자리를 비운 사이 남이 와서
//   비밀번호를 바꾸고 그 계정을 가져갈 수 있습니다 — 진료실 컴퓨터는
//   대개 로그인된 채로 있습니다.
//   맞는지 확인하는 방법은 **그 비밀번호로 한 번 로그인해 보는 것**
//   입니다. 서버에 물어볼 다른 길이 없습니다.
//
// ★ 규칙은 '비밀번호 찾기' 와 **같은 것**을 씁니다 (domain/password-reset).
//   두 곳에 따로 적으면 한쪽만 고쳐집니다.
//
// ★ 바꾼 뒤에 로그아웃하지 **않습니다.** 찾기 화면과 다릅니다 —
//   거기는 인증번호로 들어온 참이라 새 비밀번호를 한 번 쳐 보게 하는
//   것이 맞지만, 여기는 이미 자기 계정으로 일하던 중입니다. 하던 일을
//   끊을 이유가 없습니다.
// =========================================================

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { checkNewPassword, passwordSaveFailure } from '@/server/domain/password-reset';

const FIELD =
  'h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] text-[#1A2130] ' +
  'placeholder:text-[#B6BECB] focus:border-[#1279E8] focus:outline-none';

export default function PasswordChange({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
  }

  async function save() {
    const verdict = checkNewPassword(next, confirm);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }

    if (!current) {
      setError('지금 쓰시는 비밀번호를 넣어 주세요');
      return;
    }

    setError('');
    setBusy(true);

    const client = createClient();

    /*
      ★ 지금 비밀번호가 맞는지 **로그인으로** 확인합니다. 맞으면 같은
        계정으로 다시 로그인된 것이라 하던 일이 안 끊깁니다.
    */
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: current,
    });

    if (signInError) {
      setBusy(false);
      setError('지금 비밀번호가 맞지 않습니다.');
      setCurrent('');
      return;
    }

    const { error: saveError } = await client.auth.updateUser({ password: next });
    setBusy(false);

    if (saveError) {
      // ★ 고칠 수 있는 것과 처음부터 해야 하는 것을 갈라 말합니다
      setError(passwordSaveFailure(saveError.message).message);
      setNext('');
      setConfirm('');
      return;
    }

    reset();
    setOpen(false);
    setDone(true);
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
          className="h-10 rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
        >
          비밀번호 변경
        </button>

        {done && <span className="text-[13px] font-semibold text-[#0E9384]">바꿨습니다.</span>}
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[#DDE2EA] bg-[#FAFBFC] p-4">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-[#4A5567]">
            지금 비밀번호
          </span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-[#4A5567]">
            새 비밀번호
          </span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            placeholder="8자 이상"
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-[#4A5567]">
            새 비밀번호 확인
          </span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            /* ★ 엔터로 끝냅니다 — 칸이 셋뿐인데 마우스까지 잡게 하지 않습니다 */
            onKeyDown={(e) => e.key === 'Enter' && !busy && void save()}
            className={FIELD}
          />
        </label>
      </div>

      {error && <p className="mt-2.5 text-[13px] text-[#B02A22]">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="h-10 rounded-md px-4 text-[13.5px] font-bold text-white disabled:bg-[#C4CBD6]"
          style={busy ? undefined : { background: 'var(--brand)' }}
        >
          {busy ? '바꾸는 중…' : '바꾸기'}
        </button>

        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={busy}
          className="h-10 rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
        >
          그만두기
        </button>

        {/* ★ 지금 것을 모르면 여기서 막힙니다 — 그때 갈 곳을 적어 둡니다 */}
        <a
          href="/reset"
          className="ml-auto text-[12.5px] text-[#98A2B3] underline underline-offset-2 hover:text-[#4A5567]"
        >
          지금 비밀번호가 기억 안 나세요?
        </a>
      </div>
    </div>
  );
}
