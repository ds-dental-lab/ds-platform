// =========================================================
// 놓을 위치: src/components/shade/ShadeMatch.tsx
//
// S5 — 어느 의뢰서에 첨부할까요. (명세서 SPEC_shade-photo S5)
//
// ★★ **건너뛸 수 있어야 합니다.** 바쁜 진료실에서 "지금 고르세요" 로
//   막으면, 다음부터는 그냥 카톡을 씁니다. 안내 배너로 미리 말해
//   줍니다 — 건너뛰어도 사진은 안전하다고.
//
// ★ '쉐이드 대기' 인 것을 위에 세웁니다. 방금 찍은 사진이 갈 곳은
//   거의 언제나 아직 사진이 없는 의뢰서입니다.
// =========================================================

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { submitMatchUnsorted } from '@/server/actions/unsorted-photo';
import { SHADE_STATUS_LABEL } from '@/server/domain/shade-photo';
import type { ShadeCase } from '@/server/repositories/shade-photo';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const half = h < 12 ? '오전' : '오후';
  const hour = h % 12 === 0 ? 12 : h % 12;

  return `${half} ${hour}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface ShadeMatchProps {
  sessionId: string;
  count: number;
  cases: ShadeCase[];
  /** 건너뛴 뒤 어디로. 촬영 직후면 홈, 미분류함에서 왔으면 미분류함 */
  skipHref: string;
  skipLabel: string;
}

export default function ShadeMatch({
  sessionId,
  count,
  cases,
  skipHref,
  skipLabel,
}: ShadeMatchProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  // ★ 대기 중인 것이 먼저. 그다음 최근 순
  const sorted = [...cases].sort((a, b) => {
    if (a.shade !== b.shade) return a.shade === 'waiting' ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  async function attach(orderId: string) {
    setError('');
    setBusyId(orderId);

    const result = await submitMatchUnsorted(sessionId, orderId);
    setBusyId('');

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => {
      router.replace(`/m/${orderId}?attached=${result.moved}`);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-28 pt-6">
      <h1 className="text-[23px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">
        어느 의뢰서에 첨부할까요?
      </h1>
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">
        방금 찍은 사진 {count}장 · 최근 의뢰서 순
      </p>

      {/* ★ 건너뛰어도 된다는 것을 **미리** 말해 줍니다 */}
      <p className="mt-4 rounded-xl bg-[var(--mist)] px-4 py-3 text-[12.5px] leading-[1.6] text-[#0E7C6E]">
        지금 건너뛰어도 사진은 <b>미분류함</b>에 안전하게 보관되고, 나중에 분류할 수 있어요.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-[#FDECEA] px-4 py-3 text-[13px] text-[#B02A22]">{error}</p>
      )}

      {sorted.length === 0 ? (
        <p className="mt-10 text-center text-[14px] text-[var(--muted)]">
          붙일 수 있는 의뢰서가 없습니다
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {sorted.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => attach(c.id)}
                disabled={Boolean(busyId)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(22,50,79,0.06)] active:bg-[#F7FAFC] disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[16px] font-bold text-[var(--ink)]">
                    {c.patientLabel}
                  </b>
                  <span className="mt-0.5 block truncate text-[12.5px] text-[var(--muted)]">
                    {c.workLabel} · {timeLabel(c.createdAt)} 작성
                  </span>
                </span>

                <span
                  className={
                    'shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ' +
                    (c.shade === 'done'
                      ? 'bg-[var(--mist)] text-[#0E9384]'
                      : 'bg-[#FEF3E2] text-[#B45309]')
                  }
                >
                  {busyId === c.id ? '붙이는 중' : SHADE_STATUS_LABEL[c.shade]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[480px] bg-gradient-to-t from-[#F4F7FA] via-[#F4F7FA] to-transparent px-5 pb-6 pt-4">
        <button
          type="button"
          onClick={() => router.push(skipHref)}
          disabled={Boolean(busyId)}
          className="w-full rounded-2xl border border-[var(--line)] bg-white py-3.5 text-[15px] font-bold text-[var(--muted)]"
        >
          {skipLabel}
        </button>
      </div>
    </main>
  );
}
