// =========================================================
// 놓을 위치: src/components/holiday/HolidayTable.tsx
//
// 휴일 관리. 디자인센터만 들어옵니다.
//
// ★ 자동 채우기는 **제안**이라고 화면이 말합니다.
//   설·추석은 음력이고 대체공휴일 규칙은 법이 바뀝니다. 자동이 넣은 줄도
//   똑같이 고치고 지울 수 있어야 하고, 사람이 그럴 수 있다는 것을
//   알아야 합니다.
//
// ★ 임시공휴일이 먼저입니다.
//   선거일·국가장은 그때 정해집니다. '휴일 추가' 가 늘 보이는 자리에
//   있어야 합니다 — 자동 채우기 뒤에 숨으면 안 됩니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fillYearHolidays, submitHoliday, removeHoliday } from '@/server/actions/holiday';
import { knowsLunar, LUNAR_YEARS, MAX_HOLIDAY_NAME } from '@/server/domain/holiday';
import type { HolidayRow } from '@/server/repositories/holiday';

export interface HolidayTableProps {
  year: number;
  rows: HolidayRow[];
  /** 고르개에 띄울 연도들 */
  years: number[];
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export default function HolidayTable({ year, rows, years }: HolidayTableProps) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const [editing, setEditing] = useState<HolidayRow | 'new' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const lunar = knowsLunar(year);

  async function fill() {
    setError('');
    setMessage('');
    setWorking(true);

    const result = await fillYearHolidays(year);
    setWorking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(
      result.added === 0
        ? `${year}년은 이미 다 들어 있습니다 (${result.skipped}일).`
        : `${result.added}일을 넣었습니다.` +
            (result.skipped > 0 ? ` 이미 있던 ${result.skipped}일은 그대로 뒀습니다.` : ''),
    );

    startTransition(() => router.refresh());
  }

  async function remove(row: HolidayRow) {
    setError('');
    setMessage('');

    const result = await removeHoliday(row.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-lg border border-[#E8EBF0] bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
        <h1 className="text-[15px] font-bold tracking-tight text-[#1A2130]">휴일</h1>

        <select
          value={year}
          onChange={(e) => router.push(`/design/holidays?year=${e.target.value}`)}
          aria-label="연도"
          className="h-8 rounded-md border border-[#DDE2EA] px-2 text-[13.5px] outline-none focus:border-[#1279E8]"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>

        <span className="text-[13.5px] text-[#98A2B3]">{rows.length}일</span>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={fill}
            disabled={working || busy}
            className="h-8 rounded-md border border-[#DDE2EA] px-3 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9] disabled:opacity-60"
          >
            {working ? '채우는 중…' : `${year}년 빨간날 채우기`}
          </button>

          <button
            type="button"
            onClick={() => setEditing('new')}
            disabled={busy}
            className="h-8 rounded-md bg-[#1279E8] px-3.5 text-[13.5px] font-bold text-white hover:bg-[#0F68C9] disabled:opacity-60"
          >
            휴일 추가
          </button>
        </div>
      </header>

      {/* ★ 음력을 모르는 해는 그렇다고 말합니다. 없는 날짜를 지어내는 것보다 낫습니다 */}
      {!lunar && (
        <p className="border-b border-[#F3E3C6] bg-[#FEF8EC] px-5 py-2.5 text-[13px] text-[#8A6320]">
          {year}년은 <b className="font-bold">설날·추석·부처님오신날을 자동으로 못 채웁니다</b> —
          음력이라 표가 필요합니다 (지금은 {LUNAR_YEARS[0]}~{LUNAR_YEARS[LUNAR_YEARS.length - 1]}
          년까지). 양력 공휴일은 채워집니다. 명절은 직접 넣어 주세요.
        </p>
      )}

      <p className="border-b border-[#E8EBF0] bg-[#FBFCFD] px-5 py-2.5 text-[13px] text-[#98A2B3]">
        여기 있는 날은 요청시한에서 빠집니다. 자동으로 채운 날도 고치고 지울 수 있습니다 —
        대체공휴일 규칙은 법이 바뀌니 한 번 훑어봐 주세요.
      </p>

      {message && (
        <p className="px-5 pt-3 text-[13.5px] font-semibold text-[#1279E8]">{message}</p>
      )}
      {error && <p className="px-5 pt-3 text-[13.5px] font-semibold text-[#D8453F]">{error}</p>}

      {rows.length === 0 ? (
        <p className="py-24 text-center text-[14px] text-[#98A2B3]">
          {year}년에 들어 있는 휴일이 없습니다. 오른쪽 위에서 채워 보세요.
        </p>
      ) : (
        <ul className="divide-y divide-[#F0F2F5]">
          {rows.map((row) => {
            const weekday = WEEKDAY[new Date(`${row.date}T00:00:00Z`).getUTCDay()];
            const sunday = weekday === '일';

            return (
              <li key={row.id} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className={
                    'w-[110px] shrink-0 text-[14px] tabular-nums ' +
                    (sunday ? 'text-[#D8453F]' : 'text-[#4A5567]')
                  }
                >
                  {row.date.slice(5)} ({weekday})
                </span>

                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#1A2130]">
                  {row.name}
                </span>

                {row.source === 'auto' && (
                  <span className="shrink-0 rounded bg-[#F0F3F7] px-1.5 py-0.5 text-[11px] font-semibold text-[#98A2B3]">
                    자동
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  disabled={busy}
                  className="shrink-0 rounded px-2 py-1 text-[13px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9] disabled:opacity-60"
                >
                  고치기
                </button>
                <button
                  type="button"
                  onClick={() => remove(row)}
                  disabled={busy}
                  aria-label={`${row.name} 지우기`}
                  className="shrink-0 rounded px-2 py-1 text-[13px] font-semibold text-[#C4CBD6] hover:bg-[#FDECEA] hover:text-[#D8453F] disabled:opacity-60"
                >
                  지우기
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <HolidayDialog
          row={editing === 'new' ? null : editing}
          year={year}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage('');
            startTransition(() => router.refresh());
          }}
        />
      )}
    </section>
  );
}

// ---------- 넣기 · 고치기 ----------

function HolidayDialog({
  row,
  year,
  onClose,
  onSaved,
}: {
  row: HolidayRow | null;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(row?.date ?? `${year}-01-01`);
  const [name, setName] = useState(row?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    setSaving(true);

    const result = await submitHoliday({ id: row?.id, date, name });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14.5px] font-bold tracking-tight text-[#1A2130]">
            {row ? '휴일 고치기' : '휴일 추가'}
          </h2>
        </header>

        <div className="space-y-3.5 px-5 py-4">
          <label className="block">
            <span className="text-[13.5px] font-semibold text-[#4A5567]">날짜</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
            />
          </label>

          <label className="block">
            <span className="text-[13.5px] font-semibold text-[#4A5567]">무슨 날인가요</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_HOLIDAY_NAME}
              placeholder="예) 임시공휴일, 창립기념일, 여름휴가"
              className="mt-1 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
            />
          </label>

          {error && <p className="text-[13.5px] font-semibold text-[#D8453F]">{error}</p>}
        </div>

        <footer className="flex gap-2 border-t border-[#E8EBF0] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-auto h-10 rounded-md px-4 text-[14px] font-semibold text-[#98A2B3] hover:text-[#4A5567] disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 rounded-md bg-[#1279E8] px-5 text-[14px] font-bold text-white hover:bg-[#0F68C9] disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}
