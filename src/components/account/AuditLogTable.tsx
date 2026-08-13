// =========================================================
// 놓을 위치: src/components/account/AuditLogTable.tsx
//
// 열람 기록. 우리 직원이 언제 누구의 정보를 봤는지 보여 줍니다.
//
// ★ 이 화면의 목적은 '감시' 가 아니라 '설명할 수 있음' 입니다.
//   문제가 생겼을 때 "우리 쪽에서 샌 게 아니다" 를 말할 근거가
//   여기 있습니다. 그래서 지우거나 고칠 수 없습니다.
//
// ★ 환자 이름은 여기에도 안 나옵니다.
//   무엇을 봤는지는 주문번호로 가리킵니다. 로그가 또 하나의 명단이
//   되면 지키려던 것을 스스로 깨는 셈입니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuditRow, AuditSummary } from '@/server/repositories/audit';

const ACTION_LABEL: Record<string, string> = {
  'order.view': '주문 상세 열람',
  'order.list': '주문 목록 조회',
  'patient.search': '환자 검색',
  'file.download': '파일 내려받기',
};

const ACTION_COLOR: Record<string, string> = {
  'order.view': '#1279E8',
  'order.list': '#5C6779',
  'patient.search': '#C2721B',
  'file.download': '#12855B',
};

const RANGES = [
  { days: 1, label: '오늘' },
  { days: 7, label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
];

export interface AuditLogTableProps {
  rows: AuditRow[];
  summary: AuditSummary;
  days: number;
  action: string;
}

export default function AuditLogTable({ rows, summary, days, action }: AuditLogTableProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function go(next: { days?: number; action?: string }) {
    const q = new URLSearchParams(params.toString());
    if (next.days !== undefined) q.set('days', String(next.days));
    if (next.action !== undefined) q.set('action', next.action);

    setBusy(true);
    startTransition(() => {
      router.push(`?${q}`);
      setBusy(false);
    });
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        {/* ---------- 머리 ---------- */}
        <div className="border-b border-[#E8EBF0] px-6 py-4">
          <h2 className="text-[15px] font-bold tracking-tight text-[#1A2130]">열람 기록</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[#98A2B3]">
            우리 직원이 환자 정보를 언제 열어 봤는지 남습니다. 고치거나 지울 수 없습니다.
          </p>
        </div>

        {/* ---------- 요약 ---------- */}
        <div className="grid grid-cols-2 gap-px border-b border-[#E8EBF0] bg-[#E8EBF0] sm:grid-cols-4">
          <Stat label="열람 건수" value={summary.total} />
          <Stat label="열린 환자 수" value={summary.subjects} hint="목록은 한 번에 여럿" />
          <Stat label="주문 상세" value={summary.byAction['order.view'] ?? 0} />
          <Stat label="파일 내려받기" value={summary.byAction['file.download'] ?? 0} />
        </div>

        {/* ---------- 거르기 ---------- */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3.5">
          <span className="flex gap-1">
            {RANGES.map((r) => (
              <Chip key={r.days} on={days === r.days} onClick={() => go({ days: r.days })}>
                {r.label}
              </Chip>
            ))}
          </span>

          <select
            value={action}
            onChange={(e) => go({ action: e.target.value })}
            className="ml-auto h-9 rounded-md border border-[#DDE2EA] px-2.5 text-[13.5px] outline-none focus:border-[#1279E8]"
          >
            <option value="all">전체</option>
            {Object.entries(ACTION_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* ---------- 표 ---------- */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse">
            <thead>
              <tr className="border-y border-[#E8EBF0] text-[13.5px] text-[#4A5567]">
                <Th>일시</Th>
                <Th>담당자</Th>
                <Th>한 일</Th>
                <Th>대상</Th>
                <Th right>환자 수</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[14px] text-[#98A2B3]">
                    {busy ? '읽는 중…' : '이 기간에 열람 기록이 없습니다.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#F0F2F5] text-[14px]">
                    <Td>
                      <span className="tabular-nums text-[#4A5567]">{stamp(row.createdAt)}</span>
                    </Td>
                    <Td>{row.actorName}</Td>
                    <Td>
                      <span
                        className="font-semibold"
                        style={{ color: ACTION_COLOR[row.action] ?? '#4A5567' }}
                      >
                        {ACTION_LABEL[row.action] ?? row.action}
                      </span>
                      {row.detail && (
                        <span className="ml-1.5 text-[12.5px] text-[#98A2B3]">{row.detail}</span>
                      )}
                    </Td>
                    <Td>
                      {row.orderNo ? (
                        <span className="tabular-nums text-[#4A5567]">{row.orderNo}</span>
                      ) : (
                        <span className="text-[#C4CBD6]">-</span>
                      )}
                    </Td>
                    <Td right>
                      <b className="font-semibold tabular-nums text-[#1A2130]">
                        {row.subjectCount}
                      </b>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="border-t border-[#E8EBF0] px-6 py-3 text-[12.5px] leading-relaxed text-[#98A2B3]">
          환자 이름은 이 기록에 담지 않습니다 — 무엇을 봤는지는 주문번호로만 가리킵니다.
          기록 자체가 또 하나의 명단이 되면 안 되기 때문입니다.
        </p>
      </div>

      <div className="pb-10" />
    </div>
  );
}

// ---------- 조각들 ----------

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-white px-5 py-3.5">
      <p className="text-[12.5px] text-[#98A2B3]">
        {label}
        {hint && <span className="ml-1 text-[10.5px] text-[#C4CBD6]">{hint}</span>}
      </p>
      <p className="mt-0.5 text-[19px] font-extrabold tabular-nums tracking-tight text-[#1A2130]">
        {value.toLocaleString('ko-KR')}
      </p>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'h-9 rounded-md border px-3.5 text-[13.5px] font-semibold ' +
        (on
          ? 'border-[#1279E8] bg-[#EDF3FE] text-[#1279E8]'
          : 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]')
      }
    >
      {children}
    </button>
  );
}

/** '08-12 19:04' */
function stamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={
        'whitespace-nowrap px-3 py-3 font-semibold ' + (right ? 'text-right' : 'text-left')
      }
    >
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td
      className={'whitespace-nowrap px-3 py-2.5 ' + (right ? 'text-right' : 'text-left')}
    >
      {children}
    </td>
  );
}
