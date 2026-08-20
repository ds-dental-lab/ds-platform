// =========================================================
// 놓을 위치: src/components/order/OrderStatusActions.tsx
//
// 주문상세 위쪽의 상태 전이 버튼들.
//
// ★ 어떤 버튼을 보여줄지는 여기서 정하지 않습니다.
//   domain/order-status 의 getAvailableActions 가 정합니다.
//   화면은 그 결과를 그리기만 합니다. (설계서 §5.3 결정 1)
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitStatusChange } from '@/server/actions/order';
import {
  getActionsForRoles,
  statusChangeMessage,
  STATUS_LABEL,
  type OrderStatus,
  type Sector,
  type StatusAction,
} from '@/server/domain/order-status';
import { useToast } from '@/components/ui/Toast';

export interface OrderStatusActionsProps {
  orderId: string;
  status: OrderStatus;
  /** 이 주문에서 내가 맡은 자리들. 자사 제작이면 둘을 겸합니다 */
  roles: Sector[];
  /** 디자인센터가 배정할 수 있는 기공소. 다른 섹터에서는 비어 있습니다 */
  labs?: { id: string; name: string }[];
  /**
   * 이미 정해 둔 기공소.
   *
   * ★ 주문상세 아래 칸에서 미리 고릅니다. 여기 값이 있으면 버튼을 눌러도
   *   다시 묻지 않습니다 — 화면에 보이는 것과 실제로 넘어가는 것이
   *   같아야 합니다. 없을 때만 물어봅니다.
   */
  assignedLabId?: string | null;
  /**
   * 앞으로 넘기지 못하는 사정이 있으면 그 이유.
   * 지금은 수거가 안 끝난 리페어에 씁니다 — 물건을 받기 전에는
   * 제작을 시작할 수 없습니다. 실제 차단은 서비스 계층이 합니다.
   */
  forwardBlockedReason?: string;
}

export default function OrderStatusActions({
  orderId,
  status,
  roles,
  labs = [],
  assignedLabId,
  forwardBlockedReason,
}: OrderStatusActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  /** 무언가 더 물어봐야 하는 동작은 눌러도 바로 나가지 않고 여기에 담깁니다 */
  const [asking, setAsking] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState('');
  const [labOrgId, setLabOrgId] = useState('');
  const [error, setError] = useState('');

  const allActions = getActionsForRoles(status, roles);

  // 앞으로 넘기는 것만 막습니다. 되돌리기·취소는 그대로 둡니다.
  const actions = forwardBlockedReason
    ? allActions.filter((a) => a.danger)
    : allActions;

  if (actions.length === 0 && !forwardBlockedReason) return null;

  const busy = saving || pending;

  async function run(action: StatusAction) {
    setError('');
    setSaving(true);

    const result = await submitStatusChange(orderId, action.to, {
      reason: action.requiresReason ? reason : undefined,
      // 미리 정해 둔 것이 있으면 그것을 씁니다
      labOrgId: action.requiresLab ? labOrgId || assignedLabId || undefined : undefined,
    });

    setSaving(false);

    if (!result.ok) {
      /*
        ★ 실패도 같은 자리에 띄웁니다. 성공만 알리면 안 된 것은
          여전히 아무 말이 없습니다 — 확인창을 닫고 나가면 빨간
          글씨도 같이 사라집니다.
      */
      setError(result.error);
      toast(result.error, 'error');
      return;
    }

    setAsking(null);
    setReason('');
    setLabOrgId('');

    // '접수 → 디자인' 이면 '디자인 상태로 변경되었습니다'
    toast(statusChangeMessage(action.to));

    startTransition(() => router.refresh());
  }

  function handleClick(action: StatusAction) {
    setError('');

    // 기공소가 이미 정해져 있으면 다시 묻지 않습니다
    const needsLab = action.requiresLab && !assignedLabId;

    if (action.requiresReason || needsLab) {
      setReason('');
      // 거래 기공소가 하나뿐이면 미리 골라 둡니다
      setLabOrgId(needsLab && labs.length === 1 ? labs[0].id : '');
      setAsking(action);
      return;
    }

    run(action);
  }

  /** 물어본 것을 다 채웠는가 */
  function isReady(action: StatusAction): boolean {
    if (action.requiresReason && !reason.trim()) return false;
    if (action.requiresLab && !labOrgId && !assignedLabId) return false;
    return true;
  }

  return (
    <>
      {/* ★ 테두리를 두르지 않습니다 — 주문상세 아래줄 안에 얹혀 삽니다 */}
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.to}
            onClick={() => handleClick(action)}
            disabled={busy}
            className={
              'rounded-md px-4 py-2.5 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ' +
              (action.danger
                ? 'border border-[#DDE2EA] text-[#4A5567] hover:border-[#D8453F] hover:text-[#D8453F]'
                : 'border border-[#1279E8] text-[#1279E8] hover:bg-[#F2F7FE]')
            }
          >
            {action.label}
          </button>
        ))}

        {forwardBlockedReason && (
          <span className="text-[13.5px] text-[#98A2B3]">{forwardBlockedReason}</span>
        )}

        {busy && <span className="text-[13.5px] text-[#98A2B3]">처리 중…</span>}

        {error && !asking && (
          <span className="text-[13.5px] font-semibold text-[#D8453F]">{error}</span>
        )}
      </div>

      {asking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="text-base font-bold">{asking.label}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {STATUS_LABEL[status]} → {STATUS_LABEL[asking.to]}
            </p>

            {asking.requiresLab && (
              <div className="mt-4">
                <label className="mb-1.5 block text-[14px] font-semibold text-gray-600">
                  제작을 맡길 기공소
                </label>

                {labs.length === 0 ? (
                  <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-[14px] text-amber-800">
                    거래 중인 기공소가 없습니다. 설정에서 기공소를 먼저 연결해 주세요.
                  </p>
                ) : (
                  <select
                    value={labOrgId}
                    onChange={(e) => setLabOrgId(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">선택하세요</option>
                    {labs.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {asking.requiresReason && (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="사유를 적어 주세요. 상대 조직에 그대로 전달됩니다."
                className="mt-4 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            )}

            {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setAsking(null);
                  setError('');
                }}
                disabled={busy}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => run(asking)}
                disabled={busy || !isReady(asking)}
                className={
                  'rounded px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 ' +
                  (asking.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')
                }
              >
                {busy ? '처리 중…' : asking.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
