// =========================================================
// 놓을 위치: src/components/billing/CloseBar.tsx
//
// 정산 마감 버튼. 지금까지의 셈을 굳힙니다.
//
// ★ 마감은 되돌리기 어려운 일이라 한 번 묻습니다.
//   무엇이 굳는지(기간·건수·금액)를 창에 그대로 적어 둡니다.
//
// ★ 기간이 끝나기 전에는 못 누릅니다.
//   8월(26일 기준)은 8월 25일까지입니다. 20일에 닫으면 21~25일에
//   나간 물건이 조용히 9월로 밀립니다.
//
// ★ 단가가 빈 줄이 있으면 경고합니다.
//   0원으로 굳으면 그대로 못 받습니다. 막지는 않습니다 —
//   진짜 0원인 제품도 있고, 판단은 사람이 합니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitCloseBilling, submitReopenBilling } from '@/server/actions/billing';

export interface CloseBarProps {
  partyOrgId: string;
  partnerName: string;
  yearMonth: string;
  from: string;
  to: string;
  /** 마감할 수 없으면 그 이유. 있으면 버튼이 잠깁니다 */
  blockedReason?: string;
  closed: boolean;
  issued: boolean;
  itemCount: number;
  total: number;
  unpricedCount: number;
}

export default function CloseBar({
  partyOrgId,
  partnerName,
  yearMonth,
  from,
  to,
  blockedReason,
  closed,
  issued,
  itemCount,
  total,
  unpricedCount,
}: CloseBarProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [asking, setAsking] = useState<'close' | 'reopen' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const busy = saving || refreshing;

  async function run(kind: 'close' | 'reopen') {
    setError('');
    setSaving(true);

    const result =
      kind === 'close'
        ? await submitCloseBilling(partyOrgId, yearMonth)
        : await submitReopenBilling(partyOrgId, yearMonth);

    setSaving(false);
    setAsking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-[13px] font-semibold text-[#D8453F]">{error}</span>}

      {closed ? (
        <>
          <span className="rounded-md bg-[#E6F4EE] px-3 py-1.5 text-[13.5px] font-bold text-[#12855B]">
            마감됨
          </span>

          <button
            type="button"
            onClick={() => setAsking('reopen')}
            disabled={busy || issued}
            title={issued ? '청구서를 이미 뽑아 되돌릴 수 없습니다' : '마감을 되돌립니다'}
            className="h-9 rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            마감 되돌리기
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAsking('close')}
          disabled={busy || Boolean(blockedReason)}
          title={blockedReason}
          className="h-9 rounded-md bg-[#5546C8] px-5 text-[14px] font-bold text-white hover:bg-[#4536B8] disabled:cursor-not-allowed disabled:bg-[#C4CBD6]"
        >
          {saving ? '마감 중…' : '마감'}
        </button>
      )}

      {!closed && blockedReason && (
        <span className="text-[12.5px] text-[#98A2B3]">{blockedReason}</span>
      )}

      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="px-7 pb-5 pt-7 text-center">
              <span
                className={
                  'mx-auto grid h-12 w-12 place-items-center rounded-full ' +
                  (asking === 'close' ? 'bg-[#EFEDFB]' : 'bg-[#FDF0E0]')
                }
              >
                <b
                  className={
                    'text-[20px] font-extrabold leading-none ' +
                    (asking === 'close' ? 'text-[#5546C8]' : 'text-[#E09A1B]')
                  }
                >
                  {asking === 'close' ? '₩' : '!'}
                </b>
              </span>

              <h3 className="mt-4 text-[15.5px] font-bold tracking-tight text-[#1A2130]">
                {asking === 'close' ? '이 기간을 마감할까요?' : '마감을 되돌릴까요?'}
              </h3>

              {asking === 'close' ? (
                <dl className="mt-4 space-y-1.5 rounded-lg bg-[#F8F9FB] px-4 py-3 text-left text-[13.5px]">
                  <Row label="거래처">{partnerName}</Row>
                  <Row label="정산 달">{yearMonth}</Row>
                  <Row label="이용기간">
                    {from} ~ {to}
                  </Row>
                  <Row label="보철">{itemCount}건</Row>
                  <Row label="금액">
                    <b className="font-bold text-[#1A2130]">₩{total.toLocaleString('ko-KR')}</b>
                  </Row>
                </dl>
              ) : (
                <p className="mt-2 text-[13.5px] text-[#98A2B3]">
                  굳어 있던 정산줄을 지우고 다시 셈합니다. 청구서를 뽑기 전에만 됩니다.
                </p>
              )}

              {asking === 'close' && (
                <p className="mt-3 text-[13px] leading-relaxed text-[#98A2B3]">
                  마감하면 이 기간의 금액이 굳습니다. 그 뒤에 단가를 고치거나 주문을 손대도
                  이 청구액은 달라지지 않습니다.
                </p>
              )}

              {asking === 'close' && unpricedCount > 0 && (
                <p className="mt-3 rounded-md border border-[#F5C6C4] bg-[#FDF2F2] px-3 py-2 text-[13px] font-semibold leading-relaxed text-[#B3312C]">
                  단가를 안 정한 보철이 {unpricedCount}줄 있습니다. 지금 마감하면 0원으로 굳어
                  그대로 못 받습니다.
                </p>
              )}
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setAsking(null)}
                disabled={busy}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => run(asking)}
                disabled={busy}
                className={
                  'h-11 flex-1 rounded-md text-[13.5px] font-bold text-white disabled:opacity-60 ' +
                  (asking === 'close'
                    ? 'bg-[#5546C8] hover:bg-[#4536B8]'
                    : 'bg-[#E09A1B] hover:bg-[#C9880F]')
                }
              >
                {busy ? '처리 중…' : asking === 'close' ? '마감' : '되돌리기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[#4A5567]">
      <dt>{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
