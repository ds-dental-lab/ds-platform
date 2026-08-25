// =========================================================
// 놓을 위치: src/components/shade/ArrivalList.tsx
//
// 오늘 받을 것. (사용자 요청 2026-08-24, 좁힘 2026-08-24)
//
// ★★ 한 가지 질문에만 답합니다 — *오늘 것 중에 아직 안 온 게 있나.*
//
// ★★ **받은 것은 안 세웁니다.** 「수령 완료」는 치과가 자기 손으로
//   누르는 것이라 되돌려 보여 줘도 새 정보가 아닙니다. 목록에 섞이면
//   정작 봐야 할 줄이 그만큼 밀립니다.
// =========================================================

import Link from 'next/link';
import { ARRIVAL_LABEL, pendingSummary, isPending, arrivalRank } from '@/server/domain/arrival';
import type { ArrivalRow } from '@/server/repositories/arrival';

const TONE = {
  making: 'bg-[#FEF3E2] text-[#B45309]',
  onTheWay: 'bg-[#EAF2FE] text-[#1554C8]',
  arrived: 'bg-[var(--mist)] text-[#0E9384]',
} as const;

export default function ArrivalList({ rows }: { rows: ArrivalRow[] }) {
  const summary = pendingSummary(rows.map((r) => r.state));

  // ★ 세우는 것은 아직 안 온 것뿐입니다
  const pending = rows
    .filter((r) => isPending(r.state))
    .sort((a, b) => arrivalRank(a.state) - arrivalRank(b.state));

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-5">
      <Link href="/m" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
        <span aria-hidden="true">&#8249;</span> 오늘 의뢰
      </Link>

      <h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">
        오늘 받을 것
      </h1>
      {/*
        ★ 날짜 기준을 적어 둡니다. '도착일' 이 아니라 **요청시한**
          입니다 — 오늘까지 해 달라고 한 것입니다. 안 적으면 택배
          도착 예정으로 읽습니다.
      */}
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">
        {summary}
        <span className="mt-0.5 block text-[11.5px] text-[#9FB0C0]">
          오늘까지 요청한 것 기준입니다
        </span>
      </p>

      {pending.length === 0 ? (
        <p className="mt-14 text-center text-[14px] text-[var(--muted)]">
          {rows.length === 0 ? '오늘 받기로 한 것이 없습니다' : '오늘 것은 다 받았습니다'}
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {pending.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(22,50,79,0.06)]"
            >
              <div className="flex items-center gap-3">
                <b className="min-w-0 flex-1 truncate text-[17px] font-bold text-[var(--ink)]">
                  {r.patientLabel}
                </b>
                <span
                  className={
                    'shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ' + TONE[r.state]
                  }
                >
                  {ARRIVAL_LABEL[r.state]}
                </span>
              </div>

              <p className="mt-1.5 truncate text-[13px] text-[var(--muted)]">
                {r.workLabel} · {r.orderNo}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
