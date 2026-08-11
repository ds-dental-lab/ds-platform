// =========================================================
// 놓을 위치: src/components/order/DueDatePicker.tsx
//
// 요청시한 캘린더. (시안 .datewrap / .cal)
//
// ★ 브라우저 기본 날짜 입력을 쓰지 않습니다.
//   일요일과 최소 납기 이전을 막아야 하는데, <input type=date> 로는
//   "이 날은 왜 안 되는지"를 알려 줄 수가 없습니다.
//
// 막는 규칙은 domain/due-date 에 있습니다. 여기서는 그리기만 합니다.
// =========================================================

'use client';

import { useState } from 'react';
import {
  buildCalendar,
  formatMonthTitle,
  formatDueLabel,
  checkDueDate,
  type DueDatePolicy,
} from '@/server/domain/due-date';
import type { IsoDate } from '@/server/domain/week';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export interface DueDatePickerProps {
  value: IsoDate;
  today: IsoDate;
  /**
   * 무엇까지 고를 수 있는가.
   *   standard  치과 — 4번째 영업일부터
   *   free      디자인센터 대리등록 — 오늘부터
   */
  policy?: DueDatePolicy;
  onChange: (date: IsoDate) => void;
}

export default function DueDatePicker({
  value,
  today,
  policy = 'standard',
  onChange,
}: DueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => ({
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
  }));

  const cells = buildCalendar(cursor.year, cursor.month, today, policy);
  const selectedNote = checkDueDate(value, today, policy).note;

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { ...c, month: m };
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-11 w-full items-center justify-between rounded border border-[#DDE2EA] bg-white px-3 text-[13px] outline-none hover:border-[#1279E8] focus:border-[#1279E8]"
      >
        <span>{formatDueLabel(value)}</span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          className="text-[#98A2B3]"
          aria-hidden="true"
        >
          <rect x="2.8" y="4.2" width="14.4" height="13" rx="1.6" />
          <path d="M2.8 8h14.4M6.6 2.6v3M13.4 2.6v3" />
        </svg>
      </button>

      {selectedNote && (
        <p className="mt-1.5 text-[11.5px] text-[#E09A1B]">{selectedNote}</p>
      )}

      {open && (
        <>
          <button
            type="button"
            aria-label="달력 닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[290px] rounded-lg border border-[#E8EBF0] bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <CalNav onClick={() => shiftMonth(-1)} label="이전 달">
                ‹
              </CalNav>
              <span className="text-[13px] font-bold text-[#1A2130]">
                {formatMonthTitle(cursor.year, cursor.month)}
              </span>
              <CalNav onClick={() => shiftMonth(1)} label="다음 달">
                ›
              </CalNav>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-[#98A2B3]">
              {DOW.map((d, i) => (
                <span key={d} className={i === 0 ? 'text-[#D8453F]' : i === 6 ? 'text-[#1279E8]' : ''}>
                  {d}
                </span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                const selected = cell.date === value;

                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={!cell.selectable}
                    title={cell.reason ?? cell.note}
                    onClick={() => {
                      onChange(cell.date);
                      setOpen(false);
                    }}
                    className={
                      'grid h-8 place-items-center rounded text-[12.5px] tabular-nums transition-colors ' +
                      (selected
                        ? 'bg-[#1279E8] font-bold text-white'
                        : !cell.selectable
                          ? 'cursor-not-allowed text-[#D5DAE2]'
                          : cell.outside
                            ? 'text-[#C4CBD6] hover:bg-[#F4F6F9]'
                            : 'text-[#1A2130] hover:bg-[#EDF3FE]')
                    }
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 border-t border-[#E8EBF0] pt-2 text-[11px] leading-relaxed text-[#98A2B3]">
              <p>
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#D5DAE2] align-middle" />
                일요일 · 최소 납기 이전 선택 불가
              </p>
              <p className="text-[#E09A1B]">토요일은 배송만 가능</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CalNav({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded text-[#4A5567] hover:bg-[#F4F6F9]"
    >
      {children}
    </button>
  );
}
