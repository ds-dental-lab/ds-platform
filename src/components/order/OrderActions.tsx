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
import Link from 'next/link';
import { submitDeleteOrder } from '@/server/actions/order-delete';
import {
  canDeleteOrder,
  canEditSpec,
  deleteWarnings,
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
  /** 수정 화면 주소. 없으면 수정 버튼이 잠깁니다 (치과에만 있습니다) */
  editPath?: string;
}

export default function OrderActions({
  orderId,
  status,
  roles,
  orderPath,
  editPath,
}: OrderActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  // 기공소에게는 아예 보이지 않습니다 — 남의 주문서를 손댈 자리가 아닙니다
  if (!canManageOrder(roles)) return null;

  const busy = saving || pending;

  /*
    ★ 디자인센터는 단계를 안 가립니다 (사용자 결정 2026-08-12).
      치과는 접수에서만 사양을 고치고, 재스캔은 파일만 바꿉니다
      (설계서 §2.1 C-4). 그 규칙은 "이미 남이 그 사양으로 일을 시작해서"
      인데, 그 일을 하는 쪽이 디자인센터입니다.
  */
  const mySector = roles.includes('design_center') ? 'design_center' : undefined;

  const deletable = canDeleteOrder(status, mySector);

  /*
    ★ 막지 않기로 했으면 대신 알려 줍니다 (사용자 결정 2026-08-12).
      접수 건을 지우는 것과 완료 건을 지우는 것은 결과가 전혀 다릅니다.
      같은 창을 띄우면 그 차이를 아무도 모른 채 누릅니다.
  */
  const warnings = deleteWarnings(status);
  const editable = canEditSpec(status, mySector) && Boolean(editPath);

  const lockedReason = `${STATUS_LABEL[status]} 단계에서는 할 수 없습니다 — 이미 작업이 시작됐습니다`;

  /**
   * 수정이 안 되는 이유.
   * 재스캔은 "아직 안 만들었다" 가 아니라 "일부러 막았다" 이므로
   * 그 자리에서 어떻게 하면 되는지까지 알려 줍니다.
   */
  const editLockedReason =
    status === 'rescan'
      ? '재스캔에서는 파일만 바꿀 수 있습니다. 사양을 바꾸려면 주문을 취소하고 새로 넣어 주세요'
      : lockedReason;

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

      {editable ? (
        <Link
          href={editPath!}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EA] px-4 py-2.5 text-[13.5px] font-semibold text-[#4A5567] hover:border-[#1279E8] hover:text-[#1279E8]"
        >
          <PencilIcon />
          주문 수정
        </Link>
      ) : (
        <button
          type="button"
          disabled
          title={editLockedReason}
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[#EEF1F5] px-4 py-2.5 text-[13.5px] font-semibold text-[#C4CBD6]"
        >
          <PencilIcon />
          주문 수정
        </button>
      )}

      {error && !asking && (
        <span className="text-[13.5px] font-semibold text-[#D8453F]">{error}</span>
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

            {warnings.length === 0 ? (
              <p className="mt-2 text-[13.5px] text-[#98A2B3]">
                목록에서 사라집니다. 되돌리려면 관리자에게 문의해야 합니다.
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-1.5 rounded-lg bg-[#FDF0E0] px-4 py-3 text-left">
                  {warnings.map((line) => (
                    <li key={line} className="flex gap-1.5 text-[13.5px] leading-relaxed text-[#8A5A18]">
                      <span aria-hidden="true">·</span>
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[13px] font-semibold text-[#D8453F]">
                  화면에서 되돌릴 수 없습니다.
                </p>
              </>
            )}

            {error && <p className="mt-3 text-[13.5px] text-[#D8453F]">{error}</p>}

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
