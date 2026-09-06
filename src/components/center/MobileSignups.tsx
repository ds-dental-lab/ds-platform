// =========================================================
// 놓을 위치: src/components/center/MobileSignups.tsx
//
// 폰에서 하는 가입 승인. (사용자 요청 2026-09-06 — 사장님 폰이 치과
//   계정에 잠겨 친구 가입을 승인 못 한 날에서 시작된 화면입니다)
//
// ★ 승인은 한 번, 반려는 사유를 받습니다 (domain/signup — 사유 없이
//   반려하면 그 사람은 뭘 고칠지 모른 채 또 신청합니다).
// ★ 실제 일은 PC 승인 화면과 **같은 액션**이 합니다. 폰용을 따로 만들면
//   한쪽만 고쳐집니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { submitApproveSignup, submitRejectSignup } from '@/server/actions/signup';
import { SECTOR_LABEL } from '@/server/domain/signup';
import type { SignupRow } from '@/server/repositories/signup';

type Asking = { row: SignupRow; mode: 'approve' | 'reject' } | null;

export default function MobileSignups({ rows }: { rows: SignupRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [asking, setAsking] = useState<Asking>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    if (!asking) return;
    setBusy(true);
    setError('');

    const result =
      asking.mode === 'approve'
        ? await submitApproveSignup(asking.row.id)
        : await submitRejectSignup(asking.row.id, reason);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAsking(null);
    setReason('');
    startTransition(() => router.refresh());
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-5">
      <Link href="/m" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
        <span aria-hidden="true">&#8249;</span> 처리할 일
      </Link>

      <h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">
        가입 승인
      </h1>
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">
        {rows.length > 0 ? `${rows.length}곳이 기다립니다 · 먼저 온 순서` : '기다리는 신청이 없습니다'}
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-[#FDECEA] px-4 py-3 text-[13px] text-[#B02A22]">{error}</p>
      )}

      <ul className="mt-5 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white px-4 py-4 shadow-[0_1px_2px_rgba(22,50,79,0.06)]">
            <div className="flex items-center gap-2">
              <b className="min-w-0 flex-1 truncate text-[17px] font-bold text-[var(--ink)]">{r.orgName}</b>
              <span className="shrink-0 rounded-full bg-[#EAF2FE] px-2 py-0.5 text-[11.5px] font-bold text-[#1554C8]">
                {SECTOR_LABEL[r.orgType]}
              </span>
            </div>

            <dl className="mt-2.5 space-y-1 text-[13.5px]">
              <div className="flex gap-3">
                <dt className="w-10 shrink-0 text-[var(--muted)]">이름</dt>
                <dd className="text-[var(--ink)]">{r.name}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-10 shrink-0 text-[var(--muted)]">메일</dt>
                <dd className="truncate text-[var(--ink)]">{r.email}</dd>
              </div>
              {r.tel && (
                <div className="flex gap-3">
                  <dt className="w-10 shrink-0 text-[var(--muted)]">전화</dt>
                  <dd>
                    <a href={`tel:${r.tel.replace(/\D/g, '')}`} className="font-bold tabular-nums text-[#1279E8]">
                      {r.tel}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setAsking({ row: r, mode: 'reject' });
                }}
                className="h-11 flex-1 rounded-xl border border-[var(--line)] text-[14.5px] font-bold text-[var(--muted)]"
              >
                반려
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setAsking({ row: r, mode: 'approve' });
                }}
                className="h-11 flex-[2] rounded-xl bg-[var(--teal)] text-[14.5px] font-bold text-white"
              >
                승인
              </button>
            </div>
          </li>
        ))}
      </ul>

      {asking && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-white p-5 pb-8">
            <b className="text-[16px] font-bold text-[var(--ink)]">
              {asking.row.orgName} · {asking.mode === 'approve' ? '승인할까요?' : '반려할까요?'}
            </b>
            <p className="mt-1.5 text-[13px] text-[var(--muted)]">
              {asking.mode === 'approve'
                ? '승인하면 조직이 만들어지고 바로 쓸 수 있습니다.'
                : '사유는 신청한 사람에게 그대로 보입니다.'}
            </p>

            {asking.mode === 'reject' && (
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="반려 사유"
                className="mt-3 h-12 w-full rounded-xl border border-[var(--line)] px-3.5 text-[14px] outline-none focus:border-[var(--teal)]"
              />
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setAsking(null)}
                disabled={busy}
                className="h-12 flex-1 rounded-xl border border-[var(--line)] text-[15px] font-bold text-[var(--muted)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy || (asking.mode === 'reject' && !reason.trim())}
                className={
                  'h-12 flex-1 rounded-xl text-[15px] font-bold text-white disabled:opacity-50 ' +
                  (asking.mode === 'approve' ? 'bg-[var(--teal)]' : 'bg-[#D8453F]')
                }
              >
                {busy ? '처리 중' : asking.mode === 'approve' ? '승인' : '반려'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
