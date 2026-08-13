// =========================================================
// 놓을 위치: src/components/billing/AdjustCell.tsx
//
// 세부내역의 '조정 금액' 칸. 눌러서 깎거나 더합니다. (몽키스패너)
//
// ★ 원금액을 덮어쓰지 않습니다.
//   42번을 50,000 → 30,000 으로 깎았을 때 원금액을 고쳐 버리면
//   "얼마였는데 왜 깎았나" 가 사라집니다. 차액 한 줄을 덧댑니다.
//
// ★ 사유가 없으면 저장이 안 됩니다.
//   그대로 청구서에 실립니다 — 치과가 읽을 말이어야 합니다.
//
// ★ 마감된 기간에서는 눌리지 않습니다.
//   이미 굳은 금액입니다. 그 뒤에 생긴 조정은 다음 열린 기간으로 갑니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitAdjustItem, submitRemoveAdjustments } from '@/server/actions/billing';

export interface AdjustCellProps {
  itemId: string;
  partyOrgId: string;
  /** 무엇을 고치는지 창에 적습니다 — '홍길동 · 16번 Zir-Cr' */
  label: string;
  amount: number;
  editable: boolean;
}

export default function AdjustCell({
  itemId,
  partyOrgId,
  label,
  amount,
  editable,
}: AdjustCellProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sign, setSign] = useState<'minus' | 'plus'>('minus');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  const busy = saving || refreshing;

  if (!editable) {
    return amount === 0 ? (
      <span className="text-[#C4CBD6]">-</span>
    ) : (
      <span className="font-semibold text-[#C2721B]">{won(amount)}</span>
    );
  }

  async function save() {
    setError('');

    const raw = Number(value.replace(/,/g, ''));
    if (!Number.isInteger(raw) || raw <= 0) {
      setError('금액을 넣어 주세요');
      return;
    }

    setSaving(true);
    const result = await submitAdjustItem({
      orderItemId: itemId,
      partyOrgId,
      amount: sign === 'minus' ? -raw : raw,
      reason,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setValue('');
    setReason('');
    startTransition(() => router.refresh());
  }

  async function clear() {
    setSaving(true);
    const result = await submitRemoveAdjustments(itemId);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="금액 조정"
        className={
          'rounded px-1.5 py-0.5 hover:bg-[#FEF7EA] ' +
          (amount === 0 ? 'text-[#C4CBD6]' : 'font-semibold text-[#C2721B]')
        }
      >
        {amount === 0 ? '＋' : won(amount)}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6 text-left">
          <div className="w-full max-w-[380px] overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="px-6 pb-4 pt-6">
              <h3 className="text-[15px] font-bold tracking-tight text-[#1A2130]">금액 조정</h3>
              <p className="mt-1 text-[13.5px] text-[#98A2B3]">{label}</p>

              {amount !== 0 && (
                <p className="mt-3 rounded-md bg-[#FEF7EA] px-3 py-2 text-[13px] text-[#8A5A12]">
                  이미 넣은 조정 <b className="font-bold">{won(amount)}</b> 이 있습니다.
                  더 넣으면 합쳐집니다.
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <Toggle on={sign === 'minus'} onClick={() => setSign('minus')}>
                  깎기 (−)
                </Toggle>
                <Toggle on={sign === 'plus'} onClick={() => setSign('plus')}>
                  더하기 (＋)
                </Toggle>
              </div>

              <label className="mt-3 block">
                <span className="mb-1 block text-[13px] font-semibold text-[#4A5567]">금액</span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="20000"
                  autoFocus
                  className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-right text-[14px] tabular-nums outline-none focus:border-[#5546C8]"
                />
              </label>

              <label className="mt-3 block">
                <span className="mb-1 block text-[13px] font-semibold text-[#4A5567]">
                  사유 <span className="font-normal text-[#98A2B3]">청구서에 그대로 실립니다</span>
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="마진 불량으로 감액"
                  className="w-full resize-none rounded-md border border-[#DDE2EA] px-2.5 py-2 text-[14px] outline-none focus:border-[#5546C8]"
                />
              </label>

              {error && <p className="mt-2 text-[13px] text-[#D8453F]">{error}</p>}
            </div>

            <div className="flex gap-2 border-t border-[#E8EBF0] px-4 py-3.5">
              {amount !== 0 && (
                <button
                  type="button"
                  onClick={clear}
                  disabled={busy}
                  className="mr-auto h-10 rounded-md px-3 text-[13.5px] font-semibold text-[#D8453F] hover:bg-[#FDECEA]"
                >
                  조정 지우기
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-md border border-[#DDE2EA] px-4 text-[14px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="h-10 rounded-md bg-[#5546C8] px-5 text-[14px] font-bold text-white hover:bg-[#4536B8] disabled:opacity-60"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'h-9 flex-1 rounded-md border text-[14px] font-semibold ' +
        (on
          ? 'border-[#5546C8] bg-[#EFEDFB] text-[#5546C8]'
          : 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]')
      }
    >
      {children}
    </button>
  );
}

function won(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₩${Math.abs(value).toLocaleString('ko-KR')}`;
}
