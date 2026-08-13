// =========================================================
// 놓을 위치: src/components/billing/PaymentTable.tsx
//
// 정산 내역 — 들어온 돈.
//
// ★ 되돌린 줄도 그대로 보여 줍니다.
//   잘못 적은 입금은 지우지 않고 음수 줄로 되돌립니다. 지워 버리면
//   "왜 금액이 달라졌지" 가 아무 데도 안 남습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitUndoPayment } from '@/server/actions/invoice';
import type { PaymentRow } from '@/server/repositories/invoice';

export default function PaymentTable({ rows }: { rows: PaymentRow[] }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  async function undo(row: PaymentRow) {
    setError('');
    setBusyId(row.id);

    const result = await submitUndoPayment(row.id);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <>
      {error && (
        <p className="mb-2 rounded-md bg-[#FDECEA] px-3 py-2 text-[13.5px] font-semibold text-[#B3312C]">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full min-w-[760px] text-[13.5px]">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-[13px] text-[#98A2B3]">
              <th className="px-4 py-3 font-medium">입금일</th>
              <th className="px-4 py-3 font-medium">청구 번호</th>
              <th className="px-4 py-3 font-medium">거래처</th>
              <th className="px-4 py-3 text-right font-medium">금액</th>
              <th className="px-4 py-3 font-medium">메모</th>
              <th className="px-4 py-3 font-medium">적은 사람</th>
              <th className="px-4 py-3 text-right font-medium">기능</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F0F2F5]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-20 text-center text-[14px] text-[#98A2B3]">
                  적힌 입금이 없습니다. 청구 내역에서 정산을 누르면 여기 쌓입니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-[#F8F9FB]">
                  <td className="px-4 py-3 tabular-nums text-[#4A5567]">{row.paidOn}</td>
                  <td className="px-4 py-3 tabular-nums text-[#1A2130]">{row.invoiceNo || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-[#1A2130]">{row.partyName}</td>
                  <td
                    className={
                      'px-4 py-3 text-right font-semibold tabular-nums ' +
                      (row.amount < 0 ? 'text-[#B3312C]' : 'text-[#12855B]')
                    }
                  >
                    {row.amount < 0 ? '-' : ''}₩{Math.abs(row.amount).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-[#4A5567]">{row.memo || '-'}</td>
                  <td className="px-4 py-3 text-[#98A2B3]">{row.authorName || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {/* 되돌린 줄을 또 되돌리진 않습니다 */}
                    {row.amount > 0 && (
                      <button
                        type="button"
                        onClick={() => undo(row)}
                        disabled={busyId === row.id || refreshing}
                        className="rounded px-2 py-1 text-[13px] font-semibold text-[#4A5567] hover:bg-[#FDECEA] hover:text-[#D8453F] disabled:opacity-40"
                      >
                        되돌리기
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {rows.length > 0 && (
          <div className="flex items-baseline border-t border-[#E8EBF0] px-4 py-3">
            <span className="text-[13.5px] font-semibold text-[#4A5567]">합계</span>
            <span className="ml-auto text-[14px] font-bold tabular-nums text-[#1A2130]">
              ₩{total.toLocaleString('ko-KR')}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
