// =========================================================
// 놓을 위치: src/components/order/RepairRequest.tsx
//
// 리페어 신청. (설계서 §4.5, Q-13, Q-15)
//   배송·완료 상태에서만 나타납니다 — 리메이크와 같은 시점입니다.
//
// 고칠 보철물을 고르고 무엇이 문제인지 적습니다.
// 신청하면 기공소가 보철물을 수거해 가므로, 수거 시점을 미리 알려 줍니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitRepair } from '@/server/actions/repair';
import { buildAbbr } from '@/server/domain/prosthesis';
import { canRequestRepair, type OrderStatus } from '@/server/domain/order-status';
import type { OrderDetailItem } from '@/server/repositories/order';

/**
 * ★ 기공소는 이 안내를 보고 택배사에 수동으로 접수합니다.
 *   치과에게는 "언제 가지러 오는가"를 미리 알려 주어야 합니다.
 */
const PICKUP_NOTICE = '공휴일 및 일요일을 제외한 다음날 오전에 수거 합니다';

export interface RepairRequestProps {
  orderId: string;
  status: OrderStatus;
  items: OrderDetailItem[];
}

export default function RepairRequest({ orderId, status, items }: RepairRequestProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!canRequestRepair(status, 'clinic')) return null;

  const busy = saving || pending;

  function toggle(itemId: string) {
    setSelected((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  }

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const result = await submitRepair({ orderId, itemIds: selected, notes });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setSelected([]);
    setNotes('');
    startTransition(() => router.push(`/clinic/orders/${result.orderId}`));
  }

  return (
    <>
      <button
        onClick={() => {
          setError('');
          setOpen(true);
        }}
        className="rounded border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
      >
        리페어 요청
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6">
            <h3 className="text-base font-bold">리페어 요청</h3>
            <p className="mt-1 text-sm text-gray-500">
              고칠 보철물을 고르고 무엇이 문제인지 적어 주세요. 기공소로 바로 넘어갑니다.
            </p>

            <div className="mt-4">
              <p className="mb-2 text-[13px] font-semibold text-gray-600">
                고칠 보철물
                {selected.length > 0 && (
                  <span className="ml-2 font-normal text-gray-400">
                    {selected.length}개 선택
                  </span>
                )}
              </p>

              {items.length === 0 ? (
                <p className="rounded border border-gray-200 px-3 py-4 text-center text-[13px] text-gray-400">
                  보철물이 없습니다.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((item) => {
                    const checked = selected.includes(item.id);

                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => toggle(item.id)}
                          className={
                            'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left ' +
                            (checked
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 hover:border-gray-400')
                          }
                        >
                          <span
                            className={
                              'grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold text-white ' +
                              (checked
                                ? 'border-amber-600 bg-amber-600'
                                : 'border-gray-300 bg-white')
                            }
                          >
                            {checked ? '✓' : ''}
                          </span>

                          <span className="font-mono text-[13px] font-semibold text-gray-900">
                            {item.is_pontic ? 'X' : item.tooth_number}
                          </span>

                          <span className="text-[13px] text-gray-600">
                            {buildAbbr(item.type_code, item.material_code)}
                          </span>

                          {item.slot === 2 && (
                            <span className="rounded bg-gray-100 px-1.5 text-[11px] text-gray-500">
                              중복 2
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                요청사항
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="어디가 어떻게 문제인지 적어 주세요. 기공소가 그대로 봅니다."
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            {/* ★ 기공소가 알림을 받고 택배사에 수동 접수하는 구조라,
                치과에게 실제 수거 시점을 미리 알려 줍니다 */}
            <p className="mt-4 rounded border border-blue-200 bg-blue-50 px-4 py-2.5 text-[13px] text-blue-800">
              {PICKUP_NOTICE}
            </p>

            {error && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy || selected.length === 0 || !notes.trim()}
                className="rounded bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {busy ? '처리 중…' : '리페어 요청'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
