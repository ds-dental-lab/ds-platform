// =========================================================
// 놓을 위치: src/app/lab/previews/page.tsx
//
// 하루치 '크라운 찾기' 종이 (2026-09-28, 사용자 요청).
//   신터링이 끝난 크라운을 작업대에서 가릴 때 옆에 두는 A4 입니다.
//   줄마다 — 여섯 방향 그림 · 환자 · 치식 · 치과 · 주문번호.
//
// ★ 기공소 것입니다 — 자기에게 배정된 주문의 디자인 파일만 나옵니다(RLS).
//   같은 화면을 센터도 씁니다 (/design/previews).
// ★ 인쇄는 기공의뢰서와 같은 A4 규칙을 씁니다 (globals.css 의 work-order 페이지).
// =========================================================

import Link from 'next/link';
import { requireSession } from '@/server/policies/session';
import { notFound } from 'next/navigation';
import { todayInKst } from '@/server/domain/week';
import { getPreviewSheet, type SheetBasis } from '@/server/repositories/design-preview';
import PrintButton from '@/components/billing/PrintButton';

export const dynamic = 'force-dynamic';

export default async function LabPreviewSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; basis?: string }>;
}) {
  const session = await requireSession();
  if (session.orgType !== 'lab') notFound();

  const { date: rawDate, basis: rawBasis } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate ?? '') ? rawDate! : todayInKst();
  const basis: SheetBasis = rawBasis === 'due' ? 'due' : 'uploaded';

  const rows = await getPreviewSheet(date, basis);

  return (
    <div className="mx-auto max-w-[900px]">
      {/* ---------- 고르는 줄 (종이에는 안 나옵니다) ---------- */}
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <form className="flex items-center gap-2" action="/lab/previews">
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="h-9 rounded-md border border-[#DDE2EA] px-3 text-[13.5px]"
          />
          <select
            name="basis"
            defaultValue={basis}
            className="h-9 rounded-md border border-[#DDE2EA] px-2 text-[13.5px]"
          >
            <option value="uploaded">디자인 올린 날</option>
            <option value="due">요청시한</option>
          </select>
          <button
            type="submit"
            className="h-9 rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            보기
          </button>
        </form>

        <PrintButton />

        <Link
          href="/lab/orders"
          className="grid h-9 place-items-center rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
        >
          주문목록
        </Link>
      </div>

      {/* ---------- 종이 ---------- */}
      <div className="work-order-sheet rounded-lg border border-[#E8EBF0] bg-white px-7 py-6 print:border-0">
        <div className="mb-4 flex items-baseline gap-3">
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#111827]">크라운 찾기</h1>
          <span className="text-[13.5px] text-[#4A5567]">
            {date} · {basis === 'due' ? '요청시한' : '디자인 올린 날'} · {rows.length}건
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="py-14 text-center text-[14px] text-[#98A2B3]">
            그 날짜에는 미리보기가 붙은 디자인 파일이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {rows.map((row) => (
              <li key={row.fileId} className="break-inside-avoid py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13.5px]">
                  <b className="text-[15px] font-extrabold text-[#111827]">{row.patient}</b>
                  <span className="tabular-nums font-semibold text-[#374151]">{row.teeth}</span>
                  <span className="text-[#4A5567]">{row.clinicName}</span>
                  <span className="ml-auto tabular-nums text-[12.5px] text-[#9CA3AF]">{row.orderNo}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-[#9CA3AF]">{row.fileName}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.previewUrl} alt="" className="mt-1.5 block w-full" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pb-10 print:hidden" />
    </div>
  );
}
