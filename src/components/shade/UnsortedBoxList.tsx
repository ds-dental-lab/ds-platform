// =========================================================
// 놓을 위치: src/components/shade/UnsortedBoxList.tsx
//
// S6 — 미분류함. 묶음 목록. (명세서 SPEC_shade-photo S6)
//
// ★ 묶음 단위로 보여 줍니다. 한 환자를 세 장 찍었으면 한 줄입니다 —
//   장마다 줄이 서면 그게 곧 카톡 대화방입니다.
//
// ★ 버리는 길도 둡니다. 잘못 찍은 것이 계속 쌓이면, 진짜로 붙여야 할
//   묶음이 그 사이에 묻힙니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { submitDiscardUnsorted } from '@/server/actions/unsorted-photo';
import type { UnsortedBox } from '@/server/repositories/unsorted-photo';

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();

  const two = (n: number) => String(n).padStart(2, '0');
  const key = (x: Date) => `${x.getFullYear()}-${two(x.getMonth() + 1)}-${two(x.getDate())}`;

  const y = new Date(now);
  y.setDate(y.getDate() - 1);

  const h = d.getHours();
  const half = h < 12 ? '오전' : '오후';
  const time = `${half} ${h % 12 === 0 ? 12 : h % 12}:${two(d.getMinutes())}`;

  if (key(d) === key(now)) return `오늘 ${time}`;
  if (key(d) === key(y)) return `어제 ${time}`;

  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

export default function UnsortedBoxList({ boxes }: { boxes: UnsortedBox[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [asking, setAsking] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function discard(sessionId: string) {
    setBusy(true);
    setError('');

    const result = await submitDiscardUnsorted(sessionId);
    setBusy(false);
    setAsking('');

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-5">
      <Link href="/m" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
        <span aria-hidden="true">&#8249;</span> 오늘 의뢰
      </Link>

      <h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">
        미분류함
      </h1>
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">
        아직 의뢰서에 안 붙은 사진 묶음입니다. 눌러서 붙이세요.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-[#FDECEA] px-4 py-3 text-[13px] text-[#B02A22]">{error}</p>
      )}

      {boxes.length === 0 ? (
        <p className="mt-14 text-center text-[14px] text-[var(--muted)]">
          미분류함이 비어 있습니다
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {boxes.map((b) => (
            <li
              key={b.sessionId}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(22,50,79,0.06)]"
            >
              <Link href={`/m/unsorted/${b.sessionId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F1F5F9]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#94A3B8" strokeWidth="1.7" />
                    <path
                      d="M4.5 17l4.5-4.5 3.5 3 3-2.5 4 4"
                      stroke="#94A3B8"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                <span className="min-w-0">
                  <b className="block text-[16px] font-bold text-[var(--ink)]">사진 {b.count}장</b>
                  <span className="mt-0.5 block truncate text-[12.5px] text-[var(--muted)]">
                    {whenLabel(b.takenAt)} 촬영
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setAsking(b.sessionId)}
                disabled={busy}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#C4CBD6] active:text-[#D8453F]"
              >
                버리기
              </button>
            </li>
          ))}
        </ul>
      )}

      {asking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-6">
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-5">
            <b className="text-[16px] font-bold text-[var(--ink)]">이 묶음을 버릴까요?</b>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--muted)]">
              사진이 저장소에서 지워집니다. 되돌릴 수 없습니다.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setAsking('')}
                disabled={busy}
                className="flex-1 rounded-xl border border-[var(--line)] py-3 text-[14.5px] font-bold text-[var(--muted)]"
              >
                그대로 두기
              </button>
              <button
                type="button"
                onClick={() => discard(asking)}
                disabled={busy}
                className="flex-1 rounded-xl bg-[#D8453F] py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
              >
                {busy ? '버리는 중' : '버리기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
