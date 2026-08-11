// =========================================================
// 놓을 위치: src/components/member/MemberBoard.tsx
//
// 사용자 관리 — 관리자가 계정을 **바로 만듭니다**.
// (사용자 결정 2026-08-12 — "각 섹터 관리자 계정에서 추가", "너무 복잡해")
//
// ★ 초대장을 없앴습니다.
//   전에는 초대장을 놓고 본인이 가입해야 했습니다. 두 사람이 두 번
//   움직여야 하고, 그 사이에 "가입했는데 안 보여요" 가 반드시 생깁니다.
//   이제 관리자가 이름·이메일만 넣으면 계정이 생기고, 임시 비밀번호가
//   한 번 나옵니다. 그걸 알려 주면 끝입니다.
//
// ★ 임시 비밀번호는 **그 자리에서 한 번만** 보입니다.
//   어딘가에 남겨 두면 그 목록이 곧 열쇠 꾸러미가 됩니다.
//   잃어버리면 다시 만들어 주면 됩니다.
//
// ★ 자리는 둘뿐입니다 — 관리자 · 사용자.
//   차이는 금액이 보이느냐 하나입니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitCreateMember,
  submitResetPassword,
  submitChangeRole,
  submitToggleMember,
} from '@/server/actions/member';
import {
  ROLE_LABEL,
  ROLE_HINT,
  ROLE_OPTIONS,
  activeOwners,
  canChangeRole,
  canDeactivate,
  normalizeRole,
  type MemberRole,
} from '@/server/domain/member';
import type { MemberBoard as Board } from '@/server/repositories/member';

export default function MemberBoard({ board }: { board: Board }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  const seats = board.members.map((m) => ({
    userId: m.userId,
    role: m.role,
    isActive: m.isActive,
  }));
  const owners = activeOwners(seats);
  const working = busy || refreshing;

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    setBusy(true);

    const result = await fn();
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? '실패했습니다');
      return;
    }

    startTransition(() => router.refresh());
  }

  async function resetPassword(userId: string, email: string) {
    setError('');
    setBusy(true);

    const result = await submitResetPassword(userId);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSecret({ email, password: result.password });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-[#FDECEA] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#B3312C]">
          {error}
        </p>
      )}

      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <header className="flex flex-wrap items-center gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
          <h1 className="text-[15px] font-bold tracking-tight text-[#1A2130]">사용자</h1>
          <span className="text-[12.5px] text-[#98A2B3]">
            {board.members.filter((m) => m.isActive).length}명
          </span>

          {board.canManage && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={working}
              className="ml-auto h-8 rounded-md bg-[#1279E8] px-3.5 text-[12.5px] font-bold text-white hover:bg-[#0F68C9] disabled:opacity-60"
            >
              사용자 추가
            </button>
          )}
        </header>

        {/* ★ 자리가 둘뿐이라, 그 차이를 한 줄로 적어 둡니다 */}
        <p className="border-b border-[#E8EBF0] bg-[#FBFCFD] px-5 py-2.5 text-[12px] text-[#98A2B3]">
          <b className="font-semibold text-[#4A5567]">관리자</b>는 금액과 정산까지 봅니다.{' '}
          <b className="font-semibold text-[#4A5567]">사용자</b>는 주문·배송·파일만 보고 금액은
          안 보입니다.
        </p>

        <ul className="divide-y divide-[#F0F2F5]">
          {board.members.map((m) => {
            const roleLocked = !canChangeRole(seats, m.userId, 'staff').ok;
            const offLocked = !canDeactivate(seats, m.userId).ok || m.isMe;

            return (
              <li
                key={m.userId}
                className={
                  'flex flex-wrap items-center gap-3 px-5 py-3 ' + (m.isActive ? '' : 'bg-[#FBFCFD]')
                }
              >
                <div className="min-w-0 flex-1">
                  <span
                    className={
                      'text-[13.5px] font-semibold ' +
                      (m.isActive ? 'text-[#1A2130]' : 'text-[#98A2B3] line-through')
                    }
                  >
                    {m.name}
                  </span>
                  {m.isMe && (
                    <span className="ml-1.5 rounded bg-[#E7EEFA] px-1.5 py-0.5 text-[10.5px] font-bold text-[#1279E8]">
                      나
                    </span>
                  )}
                  <span className="block truncate text-[12px] text-[#98A2B3]">{m.email}</span>
                </div>

                {board.canManage ? (
                  <select
                    value={normalizeRole(m.role)}
                    disabled={working || roleLocked || !m.isActive}
                    onChange={(e) =>
                      run(() => submitChangeRole(m.userId, e.target.value as MemberRole))
                    }
                    title={
                      roleLocked
                        ? '관리자가 한 명뿐입니다. 다른 사람을 먼저 관리자로 올려 주세요'
                        : ROLE_HINT[normalizeRole(m.role)]
                    }
                    className="h-8 rounded-md border border-[#DDE2EA] px-2 text-[12.5px] outline-none focus:border-[#1279E8] disabled:bg-[#F8F9FB] disabled:text-[#98A2B3]"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[12.5px] text-[#4A5567]">{ROLE_LABEL[m.role]}</span>
                )}

                {board.canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => resetPassword(m.userId, m.email)}
                      disabled={working || !m.isActive}
                      title="새 임시 비밀번호를 만들어 알려 줍니다"
                      className="h-8 rounded-md border border-[#DDE2EA] px-2.5 text-[12px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9] disabled:opacity-40"
                    >
                      비밀번호
                    </button>

                    <button
                      type="button"
                      onClick={() => run(() => submitToggleMember(m.userId, !m.isActive))}
                      disabled={working || (m.isActive && offLocked)}
                      title={
                        m.isMe
                          ? '자기 자신은 끌 수 없습니다'
                          : m.isActive
                            ? '끄면 로그인해도 아무 데도 못 들어갑니다'
                            : '다시 켭니다'
                      }
                      className={
                        'h-8 w-[58px] rounded-md border text-[12px] font-semibold disabled:opacity-40 ' +
                        (m.isActive
                          ? 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#FDECEA] hover:text-[#D8453F]'
                          : 'border-[#1279E8] text-[#1279E8] hover:bg-[#E7EEFA]')
                      }
                    >
                      {m.isActive ? '끄기' : '켜기'}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {owners === 1 && board.canManage && (
          <p className="border-t border-[#E8EBF0] bg-[#FBFCFD] px-5 py-2.5 text-[12px] text-[#98A2B3]">
            관리자가 한 명뿐입니다. 그 사람의 자리는 바꿀 수 없습니다 — 조직에 주인이 없어지면
            아무도 사용자를 늘리지 못합니다.
          </p>
        )}
      </section>

      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onCreated={(email, password) => {
            setAdding(false);
            setSecret({ email, password });
            startTransition(() => router.refresh());
          }}
        />
      )}

      {/* ★ 임시 비밀번호는 여기서 한 번만 보입니다. 닫으면 다시 못 봅니다 */}
      {secret && <SecretDialog {...secret} onClose={() => setSecret(null)} />}
    </div>
  );
}

// ---------- 사용자 추가 ----------

function AddDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (email: string, password: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('staff');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    setSaving(true);

    const result = await submitCreateMember({ name, email, role });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onCreated(email.trim().toLowerCase(), result.password);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14.5px] font-bold tracking-tight text-[#1A2130]">사용자 추가</h2>
        </header>

        <div className="space-y-3.5 px-5 py-4">
          <label className="block">
            <span className="text-[12.5px] font-semibold text-[#4A5567]">이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="김디자"
              className="mt-1 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
            />
          </label>

          <label className="block">
            <span className="text-[12.5px] font-semibold text-[#4A5567]">이메일</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kim@example.com"
              className="mt-1 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
            />
            <span className="mt-1 block text-[11.5px] text-[#98A2B3]">
              이 주소로 로그인합니다. 메일은 안 나갑니다.
            </span>
          </label>

          <div>
            <span className="mb-1 block text-[12.5px] font-semibold text-[#4A5567]">자리</span>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={
                    'rounded-md border px-2.5 py-2 text-left ' +
                    (role === r
                      ? 'border-[#1279E8] bg-[#E7EEFA]'
                      : 'border-[#DDE2EA] hover:bg-[#F4F6F9]')
                  }
                >
                  <b
                    className={
                      'block text-[12.5px] font-bold ' +
                      (role === r ? 'text-[#1279E8]' : 'text-[#1A2130]')
                    }
                  >
                    {ROLE_LABEL[r]}
                  </b>
                  <span className="block text-[11px] leading-tight text-[#98A2B3]">
                    {ROLE_HINT[r as 'owner' | 'staff']}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="whitespace-pre-line text-[12.5px] font-semibold text-[#D8453F]">
              {error}
            </p>
          )}
        </div>

        <footer className="flex gap-2 border-t border-[#E8EBF0] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-auto h-10 rounded-md px-4 text-[13px] font-semibold text-[#98A2B3] hover:text-[#4A5567]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim() || !email.trim()}
            className="h-10 rounded-md bg-[#1279E8] px-5 text-[13px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#C4CBD6]"
          >
            {saving ? '만드는 중…' : '만들기'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---------- 임시 비밀번호 ----------

function SecretDialog({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="px-6 pb-5 pt-6 text-center">
          <h2 className="text-[15px] font-bold tracking-tight text-[#1A2130]">
            이 비밀번호를 알려 주세요
          </h2>
          <p className="mt-1 text-[12.5px] text-[#98A2B3]">{email}</p>

          <p className="mt-4 select-all rounded-md bg-[#F4F6F9] px-3 py-3 text-[19px] font-bold tracking-[0.06em] text-[#1A2130]">
            {password}
          </p>

          {/* ★ 어딘가에 남겨 두면 그 목록이 곧 열쇠 꾸러미가 됩니다 */}
          <p className="mt-3 text-[12px] leading-relaxed text-[#8A6320]">
            이 창을 닫으면 <b className="font-bold">다시 볼 수 없습니다.</b>
            <br />
            잃어버리면 목록에서 &lsquo;비밀번호&rsquo; 를 눌러 새로 만들면 됩니다.
          </p>
        </div>

        <div className="flex gap-2 border-t border-[#E8EBF0] px-5 py-3.5">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(password);
              setCopied(true);
            }}
            className="h-10 flex-1 rounded-md border border-[#DDE2EA] text-[13px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            {copied ? '복사했습니다' : '복사'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-md bg-[#1279E8] text-[13px] font-bold text-white hover:bg-[#0F68C9]"
          >
            알려 줬습니다
          </button>
        </div>
      </div>
    </div>
  );
}
