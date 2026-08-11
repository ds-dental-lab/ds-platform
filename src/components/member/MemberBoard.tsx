// =========================================================
// 놓을 위치: src/components/member/MemberBoard.tsx
//
// 직원 계정 — 우리 조직 사람과 초대장.
//
// ★ 계정을 대신 만들지 않고 **초대장을 놓아 둡니다.**
//   그 사람이 그 이메일로 가입하면 자리에 앉습니다. 화면이 그렇게
//   말해 줘야 "초대했는데 왜 안 들어와요" 를 안 묻습니다.
//
// ★ 지우는 버튼이 없습니다. 끄는 버튼만 있습니다.
//   그 사람이 넣은 주문·조정·열람 기록이 전부 그 id 에 붙어 있어,
//   지우면 지난 기록의 '누가' 가 통째로 사라집니다.
//
// ★ 마지막 대표는 자리도 못 바꾸고 끄지도 못합니다.
//   화면이 먼저 막고 서버가 다시 봅니다 — 목록이 오래된 채로 눌릴 수
//   있습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitInvite,
  submitRevokeInvite,
  submitChangeRole,
  submitToggleMember,
} from '@/server/actions/member';
import {
  ROLE_LABEL,
  ROLE_HINT,
  ROLE_OPTIONS,
  INVITE_LABEL,
  activeOwners,
  canChangeRole,
  canDeactivate,
  type MemberRole,
} from '@/server/domain/member';
import type { MemberBoard as Board } from '@/server/repositories/member';

export default function MemberBoard({ board }: { board: Board }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [inviting, setInviting] = useState(false);

  const seats = board.members.map((m) => ({
    userId: m.userId,
    role: m.role,
    isActive: m.isActive,
  }));
  const owners = activeOwners(seats);

  const waiting = board.invites.filter((i) => i.state === 'pending');
  const past = board.invites.filter((i) => i.state !== 'pending');

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setError('');
    setNote('');
    setBusy(true);

    const result = await fn();
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? '실패했습니다');
      return;
    }

    if (ok) setNote(ok);
    startTransition(() => router.refresh());
  }

  const working = busy || refreshing;

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-[#FDECEA] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#B3312C]">
          {error}
        </p>
      )}
      {note && (
        <p className="rounded-md bg-[#E7EEFA] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#1279E8]">
          {note}
        </p>
      )}

      {/* ---------- 사람 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <header className="flex flex-wrap items-center gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
          <h1 className="text-[15px] font-bold tracking-tight text-[#1A2130]">직원</h1>
          <span className="text-[12.5px] text-[#98A2B3]">
            {board.members.filter((m) => m.isActive).length}명
          </span>

          {board.canManage && (
            <button
              type="button"
              onClick={() => setInviting(true)}
              disabled={working}
              className="ml-auto h-8 rounded-md bg-[#1279E8] px-3.5 text-[12.5px] font-bold text-white hover:bg-[#0F68C9] disabled:opacity-60"
            >
              직원 부르기
            </button>
          )}
        </header>

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
                    value={m.role}
                    disabled={working || roleLocked || !m.isActive}
                    onChange={(e) =>
                      run(() => submitChangeRole(m.userId, e.target.value as MemberRole))
                    }
                    title={
                      roleLocked
                        ? '대표가 한 명뿐입니다. 다른 사람을 먼저 대표로 올려 주세요'
                        : ROLE_HINT[m.role]
                    }
                    className="h-8 rounded-md border border-[#DDE2EA] px-2 text-[12.5px] outline-none focus:border-[#1279E8] disabled:bg-[#F8F9FB] disabled:text-[#98A2B3]"
                  >
                    {ROLE_OPTIONS[board.sector].map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[12.5px] text-[#4A5567]">{ROLE_LABEL[m.role]}</span>
                )}

                {board.canManage && (
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
                      'h-8 w-[64px] rounded-md border text-[12px] font-semibold disabled:opacity-40 ' +
                      (m.isActive
                        ? 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#FDECEA] hover:text-[#D8453F]'
                        : 'border-[#1279E8] text-[#1279E8] hover:bg-[#E7EEFA]')
                    }
                  >
                    {m.isActive ? '끄기' : '켜기'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {owners === 1 && (
          <p className="border-t border-[#E8EBF0] bg-[#FBFCFD] px-5 py-2.5 text-[12px] text-[#98A2B3]">
            대표가 한 명뿐입니다. 그 사람의 자리는 바꿀 수 없습니다 — 조직에 주인이 없어지면
            아무도 사람을 늘리지 못합니다.
          </p>
        )}
      </section>

      {/* ---------- 초대장 ---------- */}
      {(waiting.length > 0 || past.length > 0) && (
        <section className="rounded-lg border border-[#E8EBF0] bg-white">
          <header className="flex items-baseline gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
            <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">초대장</h2>
            <span className="text-[12px] text-[#98A2B3]">기다리는 중 {waiting.length}</span>
          </header>

          {/* ★ 초대장이 저절로 메일을 보내지 않습니다. 화면이 그렇게 말합니다 */}
          {waiting.length > 0 && (
            <p className="border-b border-[#E8EBF0] bg-[#FEF8EC] px-5 py-2.5 text-[12px] leading-relaxed text-[#8A6320]">
              초대 메일은 아직 자동으로 안 나갑니다. 아래 주소를 알려 주고{' '}
              <b className="font-bold">그 이메일로 가입</b>하라고 전해 주세요 — 가입하는 순간
              자리에 앉습니다.
            </p>
          )}

          <ul className="divide-y divide-[#F0F2F5]">
            {[...waiting, ...past].map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-[#1A2130]">
                    {i.name || i.email}
                  </span>
                  {i.name && (
                    <span className="ml-1.5 text-[12px] text-[#98A2B3]">{i.email}</span>
                  )}
                  <span className="block text-[11.5px] text-[#98A2B3]">
                    {ROLE_LABEL[i.role]}
                    {i.inviterName && ` · ${i.inviterName} 이(가) 부름`}
                    {i.state === 'pending' && ` · ${i.expiresAt.slice(0, 10)} 까지`}
                  </span>
                </div>

                <span
                  className={
                    'rounded-full px-2.5 py-1 text-[11.5px] font-bold ' +
                    (i.state === 'pending'
                      ? 'bg-[#FEF3E7] text-[#C2721B]'
                      : i.state === 'accepted'
                        ? 'bg-[#E6F4EE] text-[#12855B]'
                        : 'bg-[#F0F3F7] text-[#98A2B3]')
                  }
                >
                  {INVITE_LABEL[i.state]}
                </span>

                {board.canManage && i.state === 'pending' && (
                  <button
                    type="button"
                    onClick={() => run(() => submitRevokeInvite(i.id), '초대장을 물렸습니다.')}
                    disabled={working}
                    className="h-8 rounded-md border border-[#DDE2EA] px-2.5 text-[12px] font-semibold text-[#4A5567] hover:bg-[#FDECEA] hover:text-[#D8453F] disabled:opacity-40"
                  >
                    물리기
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {inviting && (
        <InviteDialog
          sector={board.sector}
          onClose={() => setInviting(false)}
          onSaved={(email) => {
            setInviting(false);
            setNote(`${email} 앞으로 초대장을 놓았습니다. 그 이메일로 가입하면 들어옵니다.`);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

// ---------- 부르기 ----------

function InviteDialog({
  sector,
  onClose,
  onSaved,
}: {
  sector: Board['sector'];
  onClose: () => void;
  onSaved: (email: string) => void;
}) {
  const options = ROLE_OPTIONS[sector];

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>(
    options.includes('designer') ? 'designer' : options.includes('technician') ? 'technician' : 'staff',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    setSaving(true);

    const result = await submitInvite({ email, name, role });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved(email.trim().toLowerCase());
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14.5px] font-bold tracking-tight text-[#1A2130]">직원 부르기</h2>
        </header>

        <div className="space-y-3.5 px-5 py-4">
          <label className="block">
            <span className="text-[12.5px] font-semibold text-[#4A5567]">이메일</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kim@example.com"
              className="mt-1 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
            />
            <span className="mt-1 block text-[11.5px] text-[#98A2B3]">
              이 주소로 가입해야 들어옵니다. 대소문자는 상관없습니다.
            </span>
          </label>

          <label className="block">
            <span className="text-[12.5px] font-semibold text-[#4A5567]">이름 (선택)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="가입 전에도 목록에서 알아보려고"
              className="mt-1 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
            />
          </label>

          <div>
            <span className="mb-1 block text-[12.5px] font-semibold text-[#4A5567]">자리</span>
            <div className="grid grid-cols-2 gap-1.5">
              {options.map((r) => (
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
                    {ROLE_HINT[r]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[12.5px] font-semibold text-[#D8453F]">{error}</p>}
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
            disabled={saving || !email.trim()}
            className="h-10 rounded-md bg-[#1279E8] px-5 text-[13px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#C4CBD6]"
          >
            {saving ? '놓는 중…' : '초대장 놓기'}
          </button>
        </footer>
      </div>
    </div>
  );
}
