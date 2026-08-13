// =========================================================
// 놓을 위치: src/components/billing/AdjustmentTable.tsx
//
// 조정 내역 — 청구서에서 깎거나 더한 금액과 그 사유.
//
// ★ 사유별 합을 위에 먼저 놓습니다 (사용자 요청 2026-08-12 — "정리해줘").
//   줄만 늘어놓으면 '이번 달에 우수고객할인으로 얼마나 나갔나' 를 사람이
//   눈으로 더해야 합니다. 그 셈은 늘 틀립니다.
//
// ★ 아직 청구서에 안 실린 조정도 보여 줍니다.
//   마감 전에 걸어 둔 조정은 번호가 없습니다. 목록에서 빼 버리면
//   "분명 깎아 뒀는데" 가 됩니다.
//
// ★ 사유가 빈 줄은 눈에 띄어야 합니다.
//   -₩150,000 만 남으면 몇 달 뒤에 아무도 설명하지 못합니다.
// =========================================================

import { groupAdjustments, type AdjustmentRow } from '@/server/domain/invoice';

export interface AdjustmentTableProps {
  rows: AdjustmentRow[];
}

export default function AdjustmentTable({ rows }: AdjustmentTableProps) {
  const groups = groupAdjustments(rows);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-3">
      {/* ---------- 사유별로 묶은 것 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white px-5 py-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">사유별</h2>
          <span className="text-[13px] text-[#98A2B3]">{rows.length}건</span>
          <span className="ml-auto text-[14px] font-bold tabular-nums text-[#1A2130]">
            합계 {won(total)}
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-[#98A2B3]">조정된 건이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {groups.map((group) => {
              const share = total === 0 ? 0 : Math.abs(group.amount / total) * 100;
              const blank = group.reason === '(사유 없음)';

              return (
                <li key={group.reason} className="flex items-center gap-3 py-1">
                  <span
                    className={
                      'w-[140px] shrink-0 truncate text-[13.5px] ' +
                      (blank ? 'font-semibold text-[#C77700]' : 'text-[#4A5567]')
                    }
                    title={group.reason}
                  >
                    {group.reason}
                  </span>

                  {/* 막대는 '어느 사유가 큰가' 만 보면 되므로 눈금이 없습니다 */}
                  <span className="h-[9px] flex-1 rounded-full bg-[#F0F3F7]">
                    <span
                      style={{ width: `${Math.max(2, Math.round(share))}%` }}
                      className="block h-full rounded-full bg-[#1279E8]"
                    />
                  </span>

                  <span className="w-[52px] shrink-0 text-right text-[13px] tabular-nums text-[#98A2B3]">
                    {group.count}건
                  </span>
                  <span className="w-[110px] shrink-0 text-right text-[13.5px] font-semibold tabular-nums text-[#1A2130]">
                    {won(group.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- 줄 하나하나 ---------- */}
      <div className="overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full min-w-[760px] text-[13.5px]">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-[13px] text-[#98A2B3]">
              <th className="px-4 py-3 font-medium">No.</th>
              <th className="px-4 py-3 font-medium">청구 번호</th>
              <th className="px-4 py-3 font-medium">거래처</th>
              <th className="px-4 py-3 font-medium">작성자</th>
              <th className="px-4 py-3 font-medium">비고</th>
              <th className="px-4 py-3 text-right font-medium">금액</th>
              <th className="px-4 py-3 font-medium">작성 시간</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F0F2F5]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-20 text-center text-[14px] text-[#98A2B3]">
                  이 기간에 조정된 건이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-[#F8F9FB]">
                  <td className="px-4 py-3 tabular-nums text-[#98A2B3]">{i + 1}</td>

                  <td className="px-4 py-3 tabular-nums">
                    {row.invoiceNo ? (
                      <span className="text-[#1A2130]">{row.invoiceNo}</span>
                    ) : (
                      // 아직 청구서에 안 실린 조정 — 다음 마감에 실립니다
                      <span className="text-[12.5px] text-[#C77700]">마감 전</span>
                    )}
                  </td>

                  <td className="px-4 py-3 font-semibold text-[#1A2130]">{row.partyName}</td>
                  <td className="px-4 py-3 text-[#4A5567]">{row.authorName || '-'}</td>

                  <td className="px-4 py-3">
                    {row.reason.trim() ? (
                      <span className="text-[#4A5567]">{row.reason}</span>
                    ) : (
                      <span className="font-semibold text-[#C77700]">사유 없음</span>
                    )}
                  </td>

                  <td
                    className={
                      'px-4 py-3 text-right font-semibold tabular-nums ' +
                      (row.amount < 0 ? 'text-[#B3312C]' : 'text-[#12855B]')
                    }
                  >
                    {won(row.amount)}
                  </td>

                  <td className="px-4 py-3 tabular-nums text-[#98A2B3]">
                    {stamp(row.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function won(amount: number): string {
  return `${amount < 0 ? '-' : ''}₩${Math.abs(amount).toLocaleString('ko-KR')}`;
}

/** '2026-08-10 10:21' — 한국 시각 */
function stamp(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}
