// =========================================================
// 놓을 위치: src/components/order/OrderActions.tsx
//
// 주문상세 아래줄 왼쪽의 주문 삭제 · 주문 수정.
//
// ★ 어떤 상태에서 되는지는 여기서 정하지 않습니다.
//   domain/order-status 의 canDeleteOrder · canManageOrder 가 정합니다.
//   화면은 그 결과를 그리기만 합니다. (설계서 §5.3 결정 1)
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitDeleteOrder } from '@/server/actions/order-delete';
import {
  canDeleteOrder,
  canEditOrder,
  canManageOrder,
  STATUS_LABEL,
  type OrderStatus,
  type Sector,
} from '@/server/domain/order-status';

export interface OrderActionsProps {
  orderId: string;
  status: OrderStatus;
  roles: Sector[];
  /** 목록으로 돌아갈 주소. 지우고 나면 여기로 보냅니다 */
  orderPath: string;
}

export default function OrderActions({
  orderId,
  status,
  roles,
  orderPath,
}: OrderActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  // 기공소에게는 아예 보이지 않습니다 — 남의 주문서를 손댈 자리가 아닙니다
  if (!canManageOrder(roles)) return null;

  const busy = saving || pending;
  const deletable = canDeleteOrder(status);
  const editable = canEditOrder(status);

  const lockedReason = `${STATUS_LABEL[status]} 단계에서는 할 수 없습니다 — 이미 작업이 시작됐습니다`;

  async function remove() {
    setError('');
    setSaving(true);

    const result = await submitDeleteOrder(orderId);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setAsking(false);
    startTransition(() => {
      router.push(orderPath);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('');
          setAsking(true);
        }}
        disabled={busy || !deletable}
        title={deletable ? undefined : lockedReason}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EA] px-4 py-2.5 text-[13.5px] font-semibold text-[#4A5567] hover:border-[#D8453F] hover:text-[#D8453F] disabled:cursor-not-allowed disabled:border-[#EEF1F5] disabled:text-[#C4CBD6] disabled:hover:border-[#EEF1F5]"
      >
        <TrashIcon />
        주문 삭제
      </button>

      {/* ★ 수정 화면은 아직 없습니다. 눌러서 404 로 보내느니 이유를 붙여 잠급니다 */}
      <button
        type="button"
        disabled
        title={
          editable
            ? '수정 화면은 아직 준비 중입니다'
            : lockedReason
        }
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[#EEF1F5] px-4 py-2.5 text-[13.5px] font-semibold text-[#C4CBD6]"
      >
        <PencilIcon />
        주문 수정
      </button>

      {error && !asking && (
        <span className="text-[12.5px] font-semibold text-[#D8453F]">{error}</span>
      )}

      {asking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[360px] rounded-xl bg-white p-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FDF0E0]">
              <b className="text-[22px] font-extrabold leading-none text-[#E09A1B]">!</b>
            </span>

            <h3 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A2130]">
              이 주문을 지울까요?
            </h3>
            <p className="mt-2 text-[12.5px] text-[#98A2B3]">
              목록에서 사라집니다. 되돌리려면 관리자에게 문의해야 합니다.
            </p>

            {error && <p className="mt-3 text-[12.5px] text-[#D8453F]">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setAsking(false)}
                disabled={busy}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="h-11 flex-1 rounded-md bg-[#D8453F] text-[13.5px] font-bold text-white hover:bg-[#C13B36] disabled:bg-[#D5DAE2]"
              >
                {busy ? '지우는 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 5.4h14M8 5.4V3.6h4v1.8M5 5.4l.8 10.4a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L15 5.4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.4 2.9 17 6.5 6.9 16.6l-4.3.7.7-4.3 10.1-10.1Z" />
    </svg>
  );
}
