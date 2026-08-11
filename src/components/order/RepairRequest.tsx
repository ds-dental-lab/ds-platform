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
import { buildAbbr, type ProsthesisCatalog } from '@/server/domain/prosthesis';
import {
  canRequestRemakeAsAny,
  checkRepairReasons,
  buildRepairNote,
  REPAIR_REASONS,
  type OrderStatus,
  type Sector,
} from '@/server/domain/order-status';
import DueDatePicker from '@/components/order/DueDatePicker';
import type { IsoDate } from '@/server/domain/week';
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
  prosthesisCatalog: ProsthesisCatalog;
  /** 이 주문에서 내가 맡은 자리들. 치과와 디자인센터가 넣습니다 */
  roles: Sector[];
  /** 오늘 (서버 시각). 요청시한 달력의 기준입니다 */
  today: IsoDate;
  /** 기본 요청시한 */
  defaultDue: IsoDate;
  /** 만든 뒤 어디로 갈지 */
  basePath?: string;
}

export default function RepairRequest({
  orderId,
  status,
  items,
  prosthesisCatalog,
  roles,
  today,
  defaultDue,
  basePath = '/clinic/orders',
}: RepairRequestProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  /** 고른 증상들. 대부분 이 다섯 가지로 끝납니다 */
  const [reasons, setReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<IsoDate>(defaultDue);
  const [error, setError] = useState('');

  if (!canRequestRemakeAsAny(status, roles)) return null;

  const busy = saving || pending;

  function toggle(itemId: string) {
    setSelected((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  }

  async function handleSubmit() {
    setError('');

    // 무엇이 문제인지 없이 보내면 기공소가 물어보러 전화합니다
    const verdict = checkRepairReasons(reasons, notes);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }

    setSaving(true);

    const result = await submitRepair({
      orderId,
      itemIds: selected,
      // ★ 코드가 아니라 사람 말로 보냅니다. 기공작업지시서에 그대로 실립니다
      notes: buildRepairNote(reasons, notes),
      dueDate,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setSelected([]);
    setReasons([]);
    setNotes('');
    startTransition(() => router.push(`${basePath}/${result.orderId}`));
  }

  function toggleReason(code: string) {
    setError('');
    setReasons((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  return (
    <>
      {/* 시안 .dt-bar 의 버튼들과 같은 모양으로 섭니다 */}
      <button
        type="button"
        onClick={() => {
          setError('');
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EA] px-4 py-2.5 text-[13.5px] font-semibold text-[#4A5567] hover:border-[#E09A1B] hover:text-[#B57A15]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12.4 2.8a4 4 0 0 0-5 5.4L2.8 12.8a1.3 1.3 0 0 0 1.8 1.8l4.6-4.6a4 4 0 0 0 5.4-5l-1.9 1.9-2.2-2.2z" />
        </svg>
        리페어 요청
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6">
            <h3 className="text-base font-bold">리페어 요청</h3>
            <p className="mt-1 text-sm text-gray-500">
              고칠 보철물과 증상을 고르면 기공소로 바로 넘어갑니다.
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
                            {buildAbbr(prosthesisCatalog, item.type_code, item.material_code)}
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

            {/*
              ★ 다섯 가지가 거의 전부입니다 (사용자 경험).
                자유 입력만 두면 같은 문제를 사람마다 다르게 적습니다 —
                '컨택 타이트' · '인접면 조정' · '옆 이랑 껴요' 가 다 같은 말입니다.
                버튼으로 두면 기공소가 바로 알아보고 나중에 세어 볼 수도 있습니다.
            */}
            <div className="mt-4">
              <p className="mb-2 text-[13px] font-semibold text-gray-600">
                증상
                <span className="ml-2 font-normal text-gray-400">여러 개 고를 수 있습니다</span>
              </p>

              <div className="flex flex-wrap gap-1.5">
                {REPAIR_REASONS.map((reason) => {
                  const on = reasons.includes(reason.code);

                  return (
                    <button
                      key={reason.code}
                      type="button"
                      onClick={() => toggleReason(reason.code)}
                      className={
                        'rounded-md border px-3 py-2 text-[13px] font-semibold ' +
                        (on
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400')
                      }
                    >
                      {reason.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* '기타' 를 골랐을 때만 손으로 적습니다 */}
            {reasons.includes('etc') && (
              <div className="mt-3">
                <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                  기타 내용
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="무엇이 문제인지 적어 주세요. 기공소가 그대로 봅니다."
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/*
              ★ 리페어에도 시한이 필요합니다.
                전에는 기본값을 조용히 박았습니다. 그런데 리페어는 대개
                급합니다 — 환자가 다시 오는 날이 정해져 있습니다.
            */}
            <div className="mt-4">
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                요청시한
              </label>
              <DueDatePicker value={dueDate} today={today} policy="free" onChange={setDueDate} />
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
                disabled={busy || selected.length === 0 || reasons.length === 0}
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
