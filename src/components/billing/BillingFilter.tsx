// =========================================================
// 놓을 위치: src/components/billing/BillingFilter.tsx
//
// 청구·정산·조정 내역이 함께 쓰는 조회 조건.
//
// ★ 기간은 **정산 달** 입니다 (발행일이 아닙니다).
//   "7월 정산이 어떻게 됐나" 로 찾지, "8월 3일에 뽑은 것" 으로 찾지
//   않습니다. 26일 기준 치과의 7월 정산은 8월에 발행됩니다.
// =========================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface BillingFilterProps {
  basePath: string;
  from: string;
  to: string;
  name?: string;
}

export default function BillingFilter({ basePath, from, to, name = '' }: BillingFilterProps) {
  const router = useRouter();
  const [form, setForm] = useState({ from, to, name });

  function search() {
    const q = new URLSearchParams({ from: form.from, to: form.to });
    if (form.name.trim()) q.set('name', form.name.trim());
    router.push(`${basePath}?${q.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E8EBF0] bg-white px-5 py-3.5">
      <span className="text-[13.5px] font-semibold text-[#4A5567]">조회 기간</span>

      <input
        type="month"
        value={form.from}
        onChange={(e) => setForm((p) => ({ ...p, from: e.target.value }))}
        className="h-9 rounded-md border border-[#DDE2EA] px-2.5 text-[14px] outline-none focus:border-[#1279E8]"
      />
      <span className="text-[#98A2B3]">~</span>
      <input
        type="month"
        value={form.to}
        onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
        className="h-9 rounded-md border border-[#DDE2EA] px-2.5 text-[14px] outline-none focus:border-[#1279E8]"
      />

      <span className="ml-2 text-[13.5px] font-semibold text-[#4A5567]">상호</span>
      <input
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        onKeyDown={(e) => e.key === 'Enter' && search()}
        placeholder="입력"
        className="h-9 w-[160px] rounded-md border border-[#DDE2EA] px-2.5 text-[14px] outline-none focus:border-[#1279E8]"
      />

      <button
        type="button"
        onClick={search}
        className="ml-auto h-9 rounded-md bg-[#1279E8] px-4 text-[13.5px] font-bold text-white hover:bg-[#0F68C9]"
      >
        검색
      </button>
    </div>
  );
}
