'use client';

// =========================================================
// 놓을 위치: src/components/order/IncomingScanList.tsx
//
// 치과 PC 가 올려 둔 스캔 목록 (사용자 요청 2026-10-02).
//
// ★ 여기 남아 있다는 것은 **주문서를 아직 안 썼다**는 뜻입니다. 스캔만 하고
//   주문을 빠뜨리는 일이 눈에 보입니다.
// ★ '주문서 쓰기' 를 누르면 환자 이름과 이 스캔이 채워진 등록 화면이 열립니다.
// =========================================================

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitDeleteIncomingScan } from '@/server/actions/incoming-scan';
import type { IncomingScanRow } from '@/server/repositories/device-link';

function size(bytes: number | null): string {
  if (!bytes) return '';
  return `${Math.round(bytes / 1_000_000)}MB`;
}

export default function IncomingScanList({ scans }: { scans: IncomingScanRow[] }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function remove(id: string) {
    setError('');
    setBusyId(id);
    const result = await submitDeleteIncomingScan(id);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error ?? '지우지 못했습니다');
      return;
    }
    startTransition(() => router.refresh());
  }

  if (scans.length === 0) {
    return (
      <p className="rounded-lg border border-[#E8EBF0] bg-white px-6 py-12 text-center text-[14px] text-[#98A2B3]">
        올라온 스캔이 없습니다. 구강스캐너에서 내보내면 여기에 뜹니다.
      </p>
    );
  }

  return (
    <>
      {error && <p className="mb-2 text-[13.5px] text-[#D8453F]">{error}</p>}

      <ul className="divide-y divide-[#F0F2F5] rounded-lg border border-[#E8EBF0] bg-white">
        {scans.map((scan) => {
          const uploading = scan.uploadStatus !== 'uploaded';

          return (
            <li key={scan.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5">
              <b className="text-[15px] font-bold text-[#1A2130]">{scan.patientName || '이름 없음'}</b>
              {scan.chartNo && <span className="text-[13px] text-[#7C8595]">차트 {scan.chartNo}</span>}
              {scan.teeth.length > 0 && (
                <span className="text-[13px] tabular-nums text-[#4A5567]">{scan.teeth.join(', ')}</span>
              )}
              <span className="text-[12.5px] text-[#98A2B3]">
                {scan.scannedAt || scan.createdAt.slice(0, 16).replace('T', ' ')} · {size(scan.fileSize)}
              </span>

              {uploading ? (
                <span className="ml-auto rounded-full bg-[#F2F7FE] px-2.5 py-1 text-[12px] font-bold text-[#1279E8]">
                  올라오는 중
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1.5">
                  <Link
                    href={`/clinic/orders/new?scan=${scan.id}`}
                    className="rounded-md bg-[#1279E8] px-3 py-1.5 text-[13px] font-bold text-white hover:bg-[#0F68C9]"
                  >
                    주문서 쓰기
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(scan.id)}
                    disabled={busyId === scan.id || refreshing}
                    aria-label={`${scan.patientName} 스캔 지우기`}
                    className="grid h-7 w-7 place-items-center rounded text-[#C4CBD6] hover:bg-[#FDECEA] hover:text-[#D8453F] disabled:opacity-40"
                  >
                    ✕
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
