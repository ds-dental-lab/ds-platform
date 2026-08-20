// =========================================================
// 놓을 위치: src/app/(dev)/playground/upload-toast/page.tsx
//
// 두 가지를 눈으로 확인하는 자리입니다 (2026-08-21).
//   ① 수정 화면의 드롭존이 **이미 올라간 파일**을 보여 주는가
//   ② 상태 알림(토스트)이 오른쪽 위에 어떻게 뜨는가
//
// 진짜 화면은 로그인이 필요해서, 모양은 여기서 봅니다.
// =========================================================

'use client';

import { useState } from 'react';
import ScanDropZone from '@/components/order/ScanDropZone';
import ToastProvider, { useToast } from '@/components/ui/Toast';
import { statusChangeMessage, STATUS_ORDER } from '@/server/domain/order-status';
import type { ExistingOrderFile } from '@/components/order/orderFormInitial';

const ALREADY: ExistingOrderFile[] = [
  { id: '1', name: '2026-08-19-상악.stl', size: 46_800_000, status: 'uploaded' },
  { id: '2', name: '2026-08-19-하악.stl', size: 41_200_000, status: 'uploaded' },
  { id: '3', name: 'shade-26.jpg', size: 380_000, status: 'uploaded' },
  { id: '4', name: '2026-08-19-교합.dxd', size: 12_400_000, status: 'failed' },
];

export default function UploadToastPlayground() {
  return (
    <ToastProvider>
      <Body />
    </ToastProvider>
  );
}

function Body() {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">수정 화면 파일칸 · 상태 알림</h1>

      <section className="mt-8">
        <h2 className="mb-2 font-semibold">① 주문수정 — 이미 올라간 파일이 먼저 보입니다</h2>
        <div className="rounded-lg border bg-white p-4">
          <ScanDropZone files={files} onChange={setFiles} existing={ALREADY} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-2 font-semibold">② 상태 알림 — 눌러 보세요</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => toast(statusChangeMessage(s))}
              className="rounded-md border border-[#1279E8] px-3 py-2 text-[13.5px] font-semibold text-[#1279E8] hover:bg-[#F2F7FE]"
            >
              {s}
            </button>
          ))}

          <button
            onClick={() => toast('수거가 끝나지 않아 제작을 시작할 수 없습니다', 'error')}
            className="rounded-md border border-[#D8453F] px-3 py-2 text-[13.5px] font-semibold text-[#D8453F] hover:bg-[#FEF4F3]"
          >
            실패
          </button>
        </div>
      </section>
    </main>
  );
}
