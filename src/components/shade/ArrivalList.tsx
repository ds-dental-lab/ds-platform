// =========================================================
// 놓을 위치: src/components/shade/ArrivalList.tsx
//
// 오늘 도착할 보철물. (사용자 요청 2026-08-24)
//
// ★★ 아침에 **서서 보는** 화면입니다. 데스크톱 배송조회는 한 주를
//   달력으로 펼친 것이라 앉아서 보는 것이고요. 여기서 알고 싶은 것은
//   딱 하나 — 오늘 뭐 오나.
//
// ★ 안 온 것이 위입니다. 도착한 것은 이미 손에 있어서 볼 이유가
//   없습니다.
// =========================================================

import Link from 'next/link';
import { ARRIVAL_LABEL, arrivalSummary } from '@/server/domain/arrival';
import type { ArrivalRow } from '@/server/repositories/arrival';

const TONE = {
  making: 'bg-[#FEF3E2] text-[#B45309]',
  onTheWay: 'bg-[#EAF2FE] text-[#1554C8]',
  arrived: 'bg-[var(--mist)] text-[#0E9384]',
} as const;

export default function ArrivalList({ rows }: { rows: ArrivalRow[] }) {
  const summary = arrivalSummary(rows.map((r) => r.state));

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-5">
      <Link href="/m" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
        <span aria-hidden="true">&#8249;</span> 오늘 의뢰
      </Link>

      <h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">
        오늘 도착
      </h1>
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">{summary}</p>

      {rows.length === 0 ? (
        <p className="mt-14 text-center text-[14px] text-[var(--muted)]">
          오늘 받기로 한 것이 없습니다
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {rows.map((r) => (
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
