// =========================================================
// 놓을 위치: src/components/order/PickupCard.tsx
//
// 기공소가 보는 수거 카드. (설계서 §4.6, Q-4)
//
// ★ '수거완료'는 물건을 실제로 받아봤다는 뜻입니다.
//   그래서 누르면 수거만 닫는 게 아니라 제작 단계까지 넘어갑니다.
//   이후로는 기존 흐름(제작 → 배송 → 완료)을 그대로 탑니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitPickupComplete } from '@/server/actions/pickup';
import {
  PICKUP_KIND_LABEL,
  PICKUP_STATUS_LABEL,
  type PickupRequestRow,
} from '@/lib/format/pickup';

export default function PickupCard({ pickups }: { pickups: PickupRequestRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (pickups.length === 0) return null;

  const busy = saving || pending;
  const hasOpen = pickups.some((p) => p.status === 'open');

  async function handleComplete(pickupId: string) {
    setError('');
    setSaving(true);

    const result = await submitPickupComplete(pickupId);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div
      className={
        'rounded-lg border p-4 ' +
        (hasOpen ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white')
      }
    >
      <h2 className={'text-sm font-bold ' + (hasOpen ? 'text-amber-900' : 'text-gray-700')}>
        {hasOpen ? '수거 필요' : '수거 완료'}
      </h2>

      {hasOpen && (
        <p className="mt-0.5 text-[12px] text-amber-800">
          택배사에 수거를 접수해 주세요. 공휴일 및 일요일을 제외한 다음날 오전이 기준입니다.
          물건을 받으신 뒤 <b>수거완료</b>를 누르면 제작 단계로 넘어갑니다.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {pickups.map((pickup) => {
          const open = pickup.status === 'open';

          return (
            <li
              key={pickup.id}
              className={
                'rounded border bg-white px-3 py-2 ' +
                (open ? 'border-amber-200' : 'border-gray-200')
              }
            >
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-semibold text-gray-900">
                  {PICKUP_KIND_LABEL[pickup.kind] ?? pickup.kind}
                </span>

                <span
                  className={
                    'rounded px-2 py-0.5 text-[11px] font-semibold ' +
                    (open ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500')
                  }
                >
                  {PICKUP_STATUS_LABEL[pickup.status] ?? pickup.status}
                </span>

                {open && (
                  <button
                    onClick={() => handleComplete(pickup.id)}
                    disabled={busy}
                    className="ml-auto rounded bg-amber-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {busy ? '처리 중…' : '수거완료'}
                  </button>
                )}
              </div>

              {pickup.memo && (
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-700">
                  {pickup.memo}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
