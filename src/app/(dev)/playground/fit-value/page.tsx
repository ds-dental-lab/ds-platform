// =========================================================
// 놓을 위치: src/app/(dev)/playground/fit-value/page.tsx
// 내면값 카드·수정 창 시연 화면. 내부 확인용입니다.
// (진짜 화면은 로그인이 필요해, 모양은 여기서 확인합니다)
// =========================================================

'use client';

import { useState } from 'react';
import FitValueCard from '@/components/fit-value/FitValueCard';
import FitValueDialog from '@/components/fit-value/FitValueDialog';
import type { FitValues } from '@/server/domain/fit-value';

const SAMPLE: FitValues = {
  naturalTooth: 0.02,
  cnc: 0.01,
  inlay: 0.06,
  pla: 0.08,
  pmma: 0.04,
  contactAdj: -0.05,
  contactSingle: -0.07,
  hook: true,
  implantNote: 'OST TS / SS',
  note: '대구치[6,7,8] Implant Case\n- supra margin [ eq보다 살짝 높게 ]\n- embrassure open [ 0.7mm~ 1.5 mm ]',
};

export default function FitValuePlayground() {
  const [dialog, setDialog] = useState(false);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">내면값 시연</h1>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">① 주문상세 머리줄 — 치과명을 누르면 카드</h2>
        <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
          <b className="text-[13.5px] font-bold text-[#1279E8]">접수</b>
          <FitValueCard
            clinicName="[안양]선한이웃치과"
            card={{
              values: SAMPLE,
              lastChangedAt: '2026-08-16T09:00:00.000Z',
            }}
            recent
            isManager
          />
          <b className="text-[15.5px] font-extrabold text-[#1A2130]">이건희</b>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
          <b className="text-[13.5px] font-bold text-[#1279E8]">접수</b>
          <FitValueCard
            clinicName="미등록치과"
            card={{ values: null, lastChangedAt: null }}
            recent={false}
            isManager={false}
          />
          <b className="text-[15.5px] font-extrabold text-[#1A2130]">홍길동</b>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-semibold">② 관리탭 수정 창</h2>
        <button
          type="button"
          onClick={() => setDialog(true)}
          className="h-9 rounded-md bg-[#5546C8] px-4 text-[14px] font-bold text-white"
        >
          수정 창 열기
        </button>

        {dialog && (
          <FitValueDialog
            clinicOrgId="playground"
            clinicName="[안양]선한이웃치과"
            values={SAMPLE}
            onClose={() => setDialog(false)}
            onSaved={() => setDialog(false)}
          />
        )}
      </section>
    </main>
  );
}
