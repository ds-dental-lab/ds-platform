// =========================================================
// 놓을 위치: src/components/billing/InvoiceBar.tsx
//
// 청구서 위의 버튼 줄 — 인쇄 · 발행 · 입금.
//
// ★ 발행을 누르면 마감을 못 되돌립니다.
//   한 번 나간 문서의 숫자가 나중에 달라지면 신뢰가 무너집니다.
//   그래서 한 번 묻습니다.
//
// ★ 인쇄는 발행과 별개입니다.
//   미리 보려고 뽑아 보는 일이 흔합니다. 종이가 나갔다는 표시는
//   사람이 직접 눌러야 남습니다 — 브라우저는 인쇄가 끝났는지 모릅니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitIssueInvoice, submitMarkPaid } from '@/server/actions/billing';

export interface InvoiceBarProps {
  partyOrgId: string;
  yearMonth: string;
  issued: boolean;
  paid: boolean;
}

export default function InvoiceBar({ partyOrgId, yearMonth, issued, paid }: InvoiceBarProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  const busy = saving || refreshing;

  async function issue() {
    setError('');
    setSaving(true);

    const result = await submitIssueInvoice(partyOrgId, yearMonth);
    setSaving(false);
    setAsking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  async function togglePaid() {
    setError('');
    setSaving(true);

    const result = await submitMarkPaid(partyOrgId, yearMonth, !paid);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="h-9 rounded-md border border-[#DDE2EA] bg-white px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
      >
        인쇄 / PDF
      </button>

      {issued ? (
        <span className="rounded-md bg-[#EFEDFB] px-3 py-1.5 text-[13.5px] font-bold text-[#5546C8]">
          발행됨
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          disabled={busy}
          className="h-9 rounded-md bg-[#5546C8] px-4 text-[13.5px] font-bold text-white hover:bg-[#4536B8] disabled:opacity-60"
        >
          발행
        </button>
      )}

      <button
        type="button"
        onClick={togglePaid}
        disabled={busy || !issued}
        title={issued ? undefined : '발행한 뒤에 표시할 수 있습니다'}
        className={
          'h-9 rounded-md px-3.5 text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ' +
          (paid
            ? 'bg-[#E6F4EE] text-[#12855B] hover:bg-[#D6EDE3]'
            : 'border border-[#DDE2EA] bg-white text-[#4A5567] hover:bg-[#F4F6F9]')
        }
      >
        {paid ? '입금 완료' : '입금 표시'}
      </button>

      {error && <span className="text-[13px] font-semibold text-[#D8453F]">{error}</span>}

      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[350px] overflow-hidden rounded-xl bg-white text-center shadow-xl">
            <div className="px-7 pb-6 pt-7">
              <h3 className="text-[15px] font-bold tracking-tight text-[#1A2130]">
                청구서를 발행할까요?
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#98A2B3]">
                발행하면 이 기간의 마감을 되돌릴 수 없습니다. 한 번 나간 문서의 숫자가
                달라지면 안 되기 때문입니다.
              </p>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={issue}
                disabled={busy}
                className="h-11 flex-1 rounded-md bg-[#5546C8] text-[13.5px] font-bold text-white hover:bg-[#4536B8] disabled:opacity-60"
              >
                발행
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
