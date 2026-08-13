// =========================================================
// 놓을 위치: src/components/billing/BulkClosePanel.tsx
//
// 기준일이 같은 거래처를 한 번에 마감합니다.
//
// ★ 하나씩 누를 수 없습니다.
//   거래 치과가 쉰 곳이면 매달 쉰 번을 눌러야 합니다.
//   기준일이 같으면 마감일도 같으니 묶는 것이 자연스럽습니다.
//
// ★ 하나가 실패해도 나머지는 갑니다.
//   한 곳의 단가가 비었다고 마흔아홉 곳이 멈추면 안 됩니다.
//   무엇이 안 됐는지는 줄마다 보여 줍니다 — 그것만 따로 손보면 됩니다.
//
// ★ 기간이 끝난 묶음만 누를 수 있습니다.
//   일찍 닫으면 남은 날에 나간 물건이 조용히 다음 달로 밀립니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitCloseMany } from '@/server/actions/billing';
import type { BulkCloseRow } from '@/server/services/billing';

export interface ClosingGroup {
  closingDay: number;
  /** 이 기준일을 쓰는 거래처 수 */
  total: number;
  /** 이미 마감한 수 */
  closed: number;
  from: string;
  to: string;
  /** 아직 마감할 수 없으면 그 이유 */
  blockedReason?: string;
}

export interface BulkClosePanelProps {
  yearMonth: string;
  groups: ClosingGroup[];
}

export default function BulkClosePanel({ yearMonth, groups }: BulkClosePanelProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [running, setRunning] = useState<number | null>(null);
  const [result, setResult] = useState<BulkCloseRow[] | null>(null);

  const busy = running !== null || refreshing;

  async function run(closingDay: number) {
    setResult(null);
    setRunning(closingDay);

    const out = await submitCloseMany(yearMonth, closingDay);

    setRunning(null);
    setResult(out.rows);
    startTransition(() => router.refresh());
  }

  if (groups.length === 0) return null;

  return (
    <section className="rounded-lg border border-[#E8EBF0] bg-white">
      <div className="border-b border-[#E8EBF0] px-5 py-3.5">
        <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">
          {yearMonth} 마감
        </h2>
        <p className="mt-0.5 text-[13px] text-[#98A2B3]">
          정산 기준일이 같은 거래처를 한 번에 마감합니다.
        </p>
      </div>

      <ul className="divide-y divide-[#F0F2F5]">
        {groups.map((group) => {
          const left = group.total - group.closed;
          const done = left === 0;

          return (
            <li key={group.closingDay} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <b className="w-[86px] shrink-0 text-[13.5px] font-bold text-[#1A2130]">
                매월 {group.closingDay}일
              </b>

              <span className="rounded-md bg-[#F4F6F9] px-2.5 py-1 text-[13.5px] tabular-nums text-[#4A5567]">
                {group.from} ~ {group.to}
              </span>

              <span className="text-[13.5px] text-[#4A5567]">
                거래처 <b className="font-bold tabular-nums text-[#1A2130]">{group.total}</b>곳
                {group.closed > 0 && (
                  <span className="ml-2 text-[#12855B]">
                    · {group.closed}곳 마감됨
                  </span>
                )}
              </span>

              <span className="ml-auto flex items-center gap-2">
                {group.blockedReason && !done && (
                  <span className="text-[12.5px] text-[#98A2B3]">{group.blockedReason}</span>
                )}

                {done ? (
                  <span className="rounded-md bg-[#E6F4EE] px-3 py-1.5 text-[13.5px] font-bold text-[#12855B]">
                    모두 마감
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => run(group.closingDay)}
                    disabled={busy || Boolean(group.blockedReason)}
                    className="h-9 rounded-md bg-[#5546C8] px-4 text-[13.5px] font-bold text-white hover:bg-[#4536B8] disabled:cursor-not-allowed disabled:bg-[#C4CBD6]"
                  >
                    {running === group.closingDay ? '마감 중…' : `${left}곳 마감`}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* ---------- 결과 ---------- */}
      {result && (
        <div className="border-t border-[#E8EBF0] px-5 py-3.5">
          <p className="text-[13.5px] font-semibold text-[#4A5567]">
            마감 {result.filter((r) => r.ok).length}곳 성공
            {result.some((r) => !r.ok) && (
              <span className="ml-2 text-[#D8453F]">
                · {result.filter((r) => !r.ok).length}곳 실패
              </span>
            )}
          </p>

          <ul className="mt-2 max-h-[180px] space-y-0.5 overflow-y-auto">
            {result.map((row) => (
              <li
                key={row.partyOrgId}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-[13.5px]"
              >
                <span className={row.ok ? 'text-[#12855B]' : 'text-[#D8453F]'}>
                  {row.ok ? '✓' : '✕'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[#1A2130]">{row.name}</span>

                {row.ok ? (
                  <span className="tabular-nums text-[#4A5567]">
                    ₩{row.amount.toLocaleString('ko-KR')}
                  </span>
                ) : (
                  <span className="text-[#B3312C]">{row.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
