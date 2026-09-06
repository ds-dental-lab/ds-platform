// =========================================================
// 놓을 위치: src/components/center/MobileOrders.tsx
//
// 폰에서 주문 찾기. (사용자 요청 2026-09-06 —
//   "주문목록(유선전화 시 어떤 종류고 어떤 치식인지 확인) 간편하게")
//
// ★★ 전화를 받으면서 씁니다. "저희 김민서 환자 것 어떻게 됐어요" —
//   그 순간 한 손으로 이름 두 글자를 치면 케이스가 떠야 합니다.
//   그래서 찾는 칸이 맨 위에, 초성이 되고, 줄마다 치식이 바로 보입니다.
//
// ★ 검색어를 서버로 안 보냅니다. 석 달치 몇백 줄을 통째로 내려 주고
//   브라우저가 치는 대로 좁힙니다 (진료실 홈과 같은 방식, domain/hangul).
//   전화 중에 글자마다 서버 왕복을 기다릴 수는 없습니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { matchesOrder, teethLine, SEARCH_DAYS } from '@/server/domain/center-mobile';
import { STATUS_LABEL } from '@/server/domain/order-status';
import type { OrderRow } from '@/server/repositories/order-list';

const STATUS_TONE: Record<string, string> = {
  uploading: 'bg-[#F1F5F9] text-[#64748B]',
  received: 'bg-[#EAF2FE] text-[#1554C8]',
  rescan: 'bg-[#FDECEA] text-[#B02A22]',
  designing: 'bg-[#EFEDFB] text-[#5546C8]',
  production_wait: 'bg-[#FEF3E2] text-[#B45309]',
  production: 'bg-[#FEF3E2] text-[#B45309]',
  shipping: 'bg-[#EAF2FE] text-[#1554C8]',
  completed: 'bg-[var(--mist)] text-[#0E9384]',
  cancelled: 'bg-[#F1F5F9] text-[#94A3B8]',
};

export default function MobileOrders({ rows, truncated }: { rows: OrderRow[]; truncated: boolean }) {
  const [q, setQ] = useState('');
  const shown = q.trim() ? rows.filter((r) => matchesOrder(r, q)) : rows;

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-5">
      <Link href="/m" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
        <span aria-hidden="true">&#8249;</span> 처리할 일
      </Link>

      <h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">
        주문 찾기
      </h1>

      <div className="relative mt-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputMode="search"
          autoFocus
          placeholder="치과 · 환자 · 주문번호 (초성도 됩니다)"
          className="h-12 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3.5 text-[15px] outline-none focus:border-[var(--teal)]"
        />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9FB0C0" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2">
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5 21 21" />
        </svg>
      </div>

      <p className="mt-2 text-[12px] text-[#9FB0C0]">
        최근 {SEARCH_DAYS}일 · {shown.length}건{truncated && ' · 더 오래된 것은 전체 화면에서'}
      </p>

      {shown.length === 0 ? (
        <p className="mt-14 text-center text-[14px] text-[var(--muted)]">
          {q.trim() ? '없습니다' : '최근 주문이 없습니다'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((r) => (
            <li key={r.id}>
              <Link
                href={`/m/orders/${r.id}`}
                className="block rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(22,50,79,0.06)] active:bg-[#F7FAFC]"
              >
                <div className="flex items-center gap-2">
                  <b className="min-w-0 flex-1 truncate text-[16px] font-bold text-[var(--ink)]">
                    {r.patient_label}
                    <span className="ml-1.5 text-[13px] font-semibold text-[var(--muted)]">{r.clinic_name}</span>
                  </b>
                  <span className={'shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ' + (STATUS_TONE[r.status] ?? '')}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                {/* ★ 치식이 줄에 바로 보입니다 — 열어 보지 않아도 "26번이요" 가 됩니다 */}
                <p className="mt-1.5 text-[13px] text-[var(--muted)]">
                  <span className="font-semibold tabular-nums text-[var(--ink)]">{teethLine(r.teeth)}</span>
                  <span className="mx-1.5 text-[#DDE2EA]">·</span>
                  요청 {r.due_date.slice(5).replace('-', '/')}
                  {(r.is_remake || r.is_repair) && (
                    <span className="ml-1.5 rounded bg-[#FDECEA] px-1.5 py-0.5 text-[11px] font-bold text-[#B02A22]">
                      {r.is_remake ? '리메이크' : '리페어'}
                    </span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
