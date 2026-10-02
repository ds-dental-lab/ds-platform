'use client';

// =========================================================
// 놓을 위치: src/components/order/IncomingScanList.tsx
//
// 치과 PC 가 올려 둔 스캔 목록 (사용자 요청 2026-10-02).
//
// ★ 여기 남아 있다는 것은 **주문서를 아직 안 썼다**는 뜻입니다. 스캔만 하고
//   주문을 빠뜨리는 일이 눈에 보입니다.
// ★ '주문서 쓰기' 를 누르면 환자 이름과 이 스캔이 채워진 등록 화면이 열립니다.
// ★ 같은 환자가 **재스캔으로 걸려 있으면** 그 주문에 붙이는 길을 먼저 보여 줍니다
//   (사용자 요청 2026-10-02). 새 주문을 쓰면 같은 환자가 두 줄이 됩니다.
// ★ 파일에 적힌 치과명이 우리 치과명과 다르면 알립니다 — 남의 스캔이 섞여
//   들어온 것일 수 있습니다. 막지는 않습니다, 꼬리만 다른 경우가 많습니다.
// =========================================================

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitDeleteIncomingScan, submitRescanWithIncomingScan } from '@/server/actions/incoming-scan';
import { sameClinicName, samePatientName } from '@/server/domain/device-link';
import type { IncomingScanRow, RescanWaitingOrder } from '@/server/repositories/device-link';

function size(bytes: number | null): string {
  if (!bytes) return '';
  return `${Math.round(bytes / 1_000_000)}MB`;
}

export interface IncomingScanListProps {
  scans: IncomingScanRow[];
  /** 우리 치과명 — 파일에 적힌 이름과 견줍니다 */
  clinicName: string;
  /** 지금 재스캔으로 걸려 있는 주문들 */
  rescanOrders: RescanWaitingOrder[];
}

export default function IncomingScanList({ scans, clinicName, rescanOrders }: IncomingScanListProps) {
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

  async function toRescan(scanId: string, orderId: string) {
    setError('');
    setBusyId(scanId);
    const result = await submitRescanWithIncomingScan(orderId, scanId);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error ?? '붙이지 못했습니다');
      return;
    }
    startTransition(() => router.push(`/clinic/orders/${orderId}`));
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
          const otherClinic =
            scan.clinicNameInFile.length > 0 && !sameClinicName(scan.clinicNameInFile, clinicName);
          // ★ 같은 환자의 재스캔이 걸려 있으면 그 주문이 먼저입니다
          const waiting = rescanOrders.find((o) => samePatientName(o.patientName, scan.patientName));
          const busy = busyId === scan.id || refreshing;

          return (
            <li key={scan.id} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                    {waiting && (
                      <button
                        type="button"
                        onClick={() => toRescan(scan.id, waiting.id)}
                        disabled={busy}
                        className="rounded-md bg-[#C4383A] px-3 py-1.5 text-[13px] font-bold text-white hover:bg-[#A82E30] disabled:bg-[#D5DAE2]"
                      >
                        {busy ? '붙이는 중…' : `${waiting.orderNo} 재스캔에 붙이기`}
                      </button>
                    )}
                    <Link
                      href={`/clinic/orders/new?scan=${scan.id}`}
                      className={
                        'rounded-md px-3 py-1.5 text-[13px] font-bold ' +
                        (waiting
                          ? 'border border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]'
                          : 'bg-[#1279E8] text-white hover:bg-[#0F68C9]')
                      }
                    >
                      {waiting ? '새 주문서 쓰기' : '주문서 쓰기'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(scan.id)}
                      disabled={busy}
                      aria-label={`${scan.patientName} 스캔 지우기`}
                      className="grid h-7 w-7 place-items-center rounded text-[#C4CBD6] hover:bg-[#FDECEA] hover:text-[#D8453F] disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>

              {waiting && !uploading && (
                <p className="mt-2 text-[12.5px] text-[#C4383A]">
                  이 환자는 {waiting.orderNo} 이 스캔을 다시 기다리고 있습니다. 붙이면 그 주문이 접수로
                  돌아갑니다.
                </p>
              )}

              {otherClinic && (
                <p className="mt-2 rounded-md bg-[#FEF6E7] px-2.5 py-1.5 text-[12.5px] text-[#9A6B10]">
                  파일에 적힌 치과는 <b className="font-bold">{scan.clinicNameInFile}</b> 입니다. 우리
                  치과명({clinicName})과 다릅니다 — 맞는 환자인지 확인해 주세요.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
