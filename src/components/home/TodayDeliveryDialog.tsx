// =========================================================
// 놓을 위치: src/components/home/TodayDeliveryDialog.tsx
//
// 오늘 배송 예정 — 검수 목록 모달. (사용자 요청 2026-08-19 —
//   "오늘배송예정 버튼누르면 깔끔하고 시안성 좋게 오늘 도착할 리스트.
//    치과도 검수가 필요하니깐. 모달창이나 팝업이 좋을듯")
//
// ★ 배송 알림을 종에서 뺀 것과 한 쌍입니다.
//   건마다 종에 쌓는 대신, 받는 날 아침에 이 목록을 한 번 열어
//   "오늘 뭐가 오는가" 를 통째로 봅니다. 상자를 뜯을 때 옆에 두고
//   대조하는 종이 명세서의 화면판입니다.
//
// ★ 카드의 짧은 목록은 그대로 두고, 이 모달은 검수에 필요한 것을
//   더 싣습니다 — 주문번호(상자의 의뢰서와 대조)와 보철 요약(무엇이
//   몇 번 치아인지). 금액은 안 싣습니다. 검수는 물건을 보는 일입니다.
// =========================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS_LABEL } from '@/server/domain/order-status';
import { colorOfStatus } from '@/server/domain/order-list';
import type { HomeDelivery } from '@/server/repositories/home';

export interface TodayDeliveryDialogProps {
  rows: HomeDelivery[];
  orderPath: string;
  /** 치과 화면에서는 자기 이름뿐이라 치과 열을 접습니다 */
  showClinic: boolean;
  today: string;
}

export default function TodayDeliveryDialog({
  rows,
  orderPath,
  showClinic,
  today,
}: TodayDeliveryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // ★ Esc 로 닫힙니다 — 모달의 기본 예의입니다
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (rows.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-[#1279E8] px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-[#0F68C9]"
      >
        검수 목록 {rows.length}건
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#1A2130]/40 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="오늘 배송 예정 검수 목록"
        >
          <div
            className="w-full max-w-[560px] overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
              <h2 className="text-[15.5px] font-extrabold tracking-[-0.02em] text-[#1A2130]">
                오늘 배송 예정
              </h2>
              <span className="text-[13px] tabular-nums text-[#98A2B3]">
                {today} · {rows.length}건
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="ml-auto grid h-7 w-7 place-items-center rounded-md text-[#98A2B3] hover:bg-[#F4F6F9] hover:text-[#4A5567]"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </button>
            </header>

            <ul className="max-h-[62vh] divide-y divide-[#F0F2F5] overflow-y-auto">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      router.push(`${orderPath}/${row.id}`);
                    }}
                    className="flex w-full items-start gap-3.5 px-5 py-3.5 text-left hover:bg-[#F8FAFD]"
                  >
                    {/* 상태 — 담당 섹터 색. 아직 배송 전이면 여기서 보입니다 */}
                    <span
                      className="mt-0.5 w-[52px] shrink-0 text-[13px] font-bold"
                      style={{ color: colorOfStatus(row.status) }}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <b className="text-[14.5px] font-bold text-[#1A2130]">
                          {row.patientLabel}
                        </b>
                        {showClinic && (
                          <span className="text-[12.5px] text-[#7C8595]">{row.clinicName}</span>
                        )}
                        <span className="text-[12px] tabular-nums text-[#98A2B3]">
                          {row.orderNo}
                        </span>
                      </span>

                      {/* 보철 요약 — 상자 속 물건과 대조하는 줄입니다 */}
                      {row.lines.length > 0 && (
                        <span className="mt-1 block space-y-0.5">
                          {row.lines.map((line) => (
                            <span
                              key={line}
                              className="block truncate text-[13px] tabular-nums text-[#4A5567]"
                            >
                              {line}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>

                    <svg
                      className="mt-1.5 shrink-0 text-[#C4CBD6]"
                      width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M4 2l4 4-4 4" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
