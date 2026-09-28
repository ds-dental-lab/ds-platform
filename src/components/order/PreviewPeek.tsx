'use client';

// =========================================================
// 놓을 위치: src/components/order/PreviewPeek.tsx
//
// 주문목록의 이슈 칸에서 **바로** 디자인 미리보기를 봅니다 (사용자 요청 2026-09-28 —
// "상세로 들어가지 말고 목록에서 클릭해 보여 줬으면, 클릭수가 줄어든다").
//
// ★ 주소는 누를 때 받습니다 — 열 줄의 그림을 미리 서명하면 목록이 그만큼 느려집니다.
// ★ 줄 전체가 링크라, 단추가 스스로 전파를 막습니다(안 그러면 상세로 넘어갑니다).
// =========================================================

import { useState } from 'react';
import { listOrderPreviews, type OrderPreview } from '@/server/actions/stl-preview';

export interface PreviewPeekProps {
  orderId: string;
  patientLabel: string;
  teethLabel?: string;
}

export default function PreviewPeek({ orderId, patientLabel, teethLabel }: PreviewPeekProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<OrderPreview[] | null>(null);
  const [error, setError] = useState('');

  async function show(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);

    if (items || busy) return;
    setBusy(true);
    const result = await listOrderPreviews(orderId);
    setBusy(false);

    if (!result.ok) setError(result.error);
    else setItems(result.items);
  }

  function close(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        title={`${patientLabel} 디자인 미리보기`}
        aria-label={`${patientLabel} 디자인 미리보기`}
        className="inline-grid h-[21px] w-[21px] place-items-center rounded-full bg-[#F1EEFC] text-[#5546C8] hover:bg-[#E3DDF9]"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 3C4.5 3 1.7 5.3 1 8c.7 2.7 3.5 5 7 5s6.3-2.3 7-5c-.7-2.7-3.5-5-7-5Zm0 8.2A3.2 3.2 0 1 1 8 4.8a3.2 3.2 0 0 1 0 6.4Zm0-1.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" />
        </svg>
      </button>

      {open && (
         
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={close}
        >
          { }
          <div
            className="max-h-[86vh] w-full max-w-[980px] overflow-y-auto rounded-lg bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-baseline gap-2">
              <b className="text-[16px] font-extrabold text-[#1A2130]">{patientLabel}</b>
              {teethLabel && <span className="text-[13.5px] tabular-nums text-[#4A5567]">{teethLabel}</span>}
              <button
                type="button"
                onClick={close}
                className="ml-auto rounded-md border border-[#DDE2EA] px-3 py-1 text-[13px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                닫기
              </button>
            </div>

            {busy && <p className="py-10 text-center text-[14px] text-[#98A2B3]">여는 중…</p>}
            {error && <p className="py-10 text-center text-[14px] text-[#D8453F]">{error}</p>}
            {items?.length === 0 && (
              <p className="py-10 text-center text-[14px] text-[#98A2B3]">미리보기가 아직 없습니다.</p>
            )}

            {items?.map((item) => (
              <figure key={item.fileId} className="mb-3 last:mb-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="block w-full rounded border border-[#E8EBF0]" />
                <figcaption className="mt-1 text-[12px] text-[#98A2B3]">{item.fileName}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
