// =========================================================
// 놓을 위치: src/components/center/MobileContacts.tsx
//
// 폰에서 보는 수가표 문의. (사용자 요청 2026-09-06)
//
// ★★ 이 화면의 일은 **전화를 거는 것**입니다. 번호가 제일 크고, 누르면
//   바로 걸립니다. 스캐너 보유·불만족점은 통화 첫마디를 정하는 것이라
//   번호 바로 아래에 둡니다. 나머지는 PC 문의 목록에 있습니다.
//
// ★ '처리함' 은 한 번 누르면 끝입니다. 메모는 받되 비워도 됩니다 —
//   통화 직후 한 손으로 적기엔 칸 하나가 한계입니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { submitContactDone } from '@/server/actions/contact-review';
import { SCANNER_LABEL, PAIN_LABEL } from '@/server/domain/contact';
import type { ContactRow } from '@/server/repositories/contact';

function when(iso: string): string {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export default function MobileContacts({ rows }: { rows: ContactRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [asking, setAsking] = useState<ContactRow | null>(null);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    if (!asking) return;
    setBusy(true);
    setError('');

    const result = await submitContactDone(asking.id, memo);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAsking(null);
    setMemo('');
    startTransition(() => router.refresh());
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-5">
      <Link href="/m" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
        <span aria-hidden="true">&#8249;</span> 처리할 일
      </Link>

      <h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">
        수가표 문의
      </h1>
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">
        {rows.length > 0 ? `${rows.length}곳이 전화를 기다립니다` : '새 문의가 없습니다'}
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-[#FDECEA] px-4 py-3 text-[13px] text-[#B02A22]">{error}</p>
      )}

      <ul className="mt-5 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white px-4 py-4 shadow-[0_1px_2px_rgba(22,50,79,0.06)]">
            <div className="flex items-baseline justify-between gap-2">
              <b className="min-w-0 truncate text-[17px] font-bold text-[var(--ink)]">{r.clinicName}</b>
              <span className="shrink-0 text-[11.5px] tabular-nums text-[#9FB0C0]">{when(r.createdAt)}</span>
            </div>

            {/* ★ 번호가 곧 단추입니다 — 누르면 걸립니다 */}
            <a
              href={`tel:${r.tel.replace(/\D/g, '')}`}
              className="mt-2.5 flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] py-3 text-[17px] font-extrabold tabular-nums text-white active:bg-[#0F2439]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              </svg>
              {r.tel}
            </a>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {r.scanner && (
                <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[12px] font-semibold text-[#334155]">
                  스캐너 {SCANNER_LABEL[r.scanner]}
                </span>
              )}
              {r.painPoints.map((p) => (
                <span key={p} className="rounded bg-[#FDF1E7] px-1.5 py-0.5 text-[12px] font-semibold text-[#C67717]">
                  {PAIN_LABEL[p]}
                </span>
              ))}
            </div>

            <p className="mt-2 truncate text-[12.5px] text-[var(--muted)]">{r.email}</p>

            <button
              type="button"
              onClick={() => {
                setError('');
                setMemo('');
                setAsking(r);
              }}
              className="mt-3 h-10 w-full rounded-xl border border-[var(--line)] text-[14px] font-bold text-[var(--muted)] active:bg-[#F7FAFC]"
            >
              처리함
            </button>
          </li>
        ))}
      </ul>

      {asking && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-white p-5 pb-8">
            <b className="text-[16px] font-bold text-[var(--ink)]">{asking.clinicName} · 처리함으로</b>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모 (선택) — 예: 수가표 발송, 다음 주 방문"
              className="mt-3 h-12 w-full rounded-xl border border-[var(--line)] px-3.5 text-[14px] outline-none focus:border-[var(--teal)]"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setAsking(null)}
                disabled={busy}
                className="h-12 flex-1 rounded-xl border border-[var(--line)] text-[15px] font-bold text-[var(--muted)]"
              >
                그대로 두기
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                disabled={busy}
                className="h-12 flex-1 rounded-xl bg-[var(--teal)] text-[15px] font-bold text-white disabled:opacity-50"
              >
                {busy ? '저장 중' : '처리함'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
