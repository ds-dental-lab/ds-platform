// =========================================================
// 놓을 위치: src/components/billing/CloseBar.tsx
//
// 정산 **발행** 버튼. 여기 하나로 끝납니다.
//
// ★ 마감 단추를 없앴습니다 (사용자 요청 2026-08-13 —
//   "마감 > 청구서보기 > 발행, 너무 길다").
//   전에는 세 걸음에 화면까지 옮겨야 했습니다. 이제 정산 화면에서
//   **발행 한 번**입니다. 마감은 사라진 것이 아니라 발행 안으로
//   들어갔습니다 — 금액을 굳히는 일은 그대로 일어납니다.
//
// ★ 그래서 **한 번만 묻습니다.**
//   발행은 번호가 붙는 되돌릴 수 없는 일입니다. 전에는 마감이 그 앞의
//   안전판이었는데(발행 전까지 되돌리기 가능) 그것이 없어졌습니다.
//   묻는 창이 그 자리를 대신합니다 — 무엇이 나가는지(거래처·기간·
//   건수·금액)를 그대로 적어 두고, 되돌릴 수 없다고 밝힙니다.
//
// ★ 기간이 끝나기 전에는 못 누릅니다.
//   8월(26일 기준)은 8월 25일까지입니다. 20일에 닫으면 21~25일에
//   나간 물건이 조용히 9월로 밀립니다.
//
// ★ 단가가 빈 줄이 있으면 경고합니다.
//   0원으로 굳으면 그대로 못 받습니다. 막지는 않습니다 —
//   진짜 0원인 제품도 있고, 판단은 사람이 합니다.
//
// ★ '마감됨' 상태는 남아 있습니다.
//   일괄 마감으로 닫아 둔 기간이 있을 수 있습니다. 그때는 되돌리기가
//   그대로 보이고, 발행 단추는 이어서 누르면 됩니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitIssueInvoice, submitReopenBilling } from '@/server/actions/billing';
import { useToast } from '@/components/ui/Toast';

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
  const toast = useToast();
  const [refreshing, startTransition] = useTransition();
  const [asking, setAsking] = useState<'issue' | 'reopen' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const busy = saving || refreshing;

  async function run(kind: 'issue' | 'reopen') {
    setError('');
    setSaving(true);

    const result =
      kind === 'issue'
        ? await submitIssueInvoice(partyOrgId, yearMonth)
        : await submitReopenBilling(partyOrgId, yearMonth);

    setSaving(false);
    setAsking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    /*
      ★★ 발행은 됐는데 **메일이 못 나갔을 수 있습니다** (2026-08-21).
        그때 아무 말도 안 하면, 치과가 못 받은 채 납부기한이 지납니다.
        발행 자체는 되돌리지 않습니다 — 돈 문서는 확정됐고 메일만
        못 간 것이라, 이유를 보여 주고 '재발송' 을 누르게 합니다.

      ★ 잘 갔을 때도 **어디로 갔는지**를 말합니다. 그래야 사람이
        "그 주소 아닌데" 를 알아챕니다.
    */
    if (kind === 'issue' && 'mailFailed' in result && result.mailFailed) {
      setError(`발행은 됐지만 메일이 못 갔습니다: ${result.mailFailed}`);
    } else if (kind === 'issue' && 'mailSentTo' in result && result.mailSentTo) {
      toast(`${result.mailSentTo} 로 청구서를 보냈습니다`);
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-[13px] font-semibold text-[#D8453F]">{error}</span>}

      {issued ? (
        <span className="rounded-md bg-[#E6F4EE] px-3 py-1.5 text-[13.5px] font-bold text-[#12855B]">
          발행됨
        </span>
      ) : (
        <>
          {/*
            ★ 일괄 마감으로 이미 닫아 둔 기간이면 되돌리기가 함께 섭니다.
              평소 흐름에서는 안 보입니다 — 발행이 마감까지 하니까요.
          */}
          {closed && (
            <button
              type="button"
              onClick={() => setAsking('reopen')}
              disabled={busy}
              title="굳은 금액을 지우고 다시 셈합니다"
              className="h-9 rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              마감 되돌리기
            </button>
          )}

          {/* ★ 금액을 단추에 적습니다. 무엇이 나가는지 보고 누르게 됩니다 */}
          <button
            type="button"
            onClick={() => setAsking('issue')}
            disabled={busy || Boolean(blockedReason)}
            title={blockedReason}
            className="h-9 rounded-md bg-[#5546C8] px-5 text-[14px] font-bold text-white hover:bg-[#4536B8] disabled:cursor-not-allowed disabled:bg-[#C4CBD6]"
          >
            {saving ? '발행 중…' : `₩${total.toLocaleString('ko-KR')} 청구서 발행`}
          </button>
        </>
      )}

      {!issued && blockedReason && (
        <span className="text-[12.5px] text-[#98A2B3]">{blockedReason}</span>
      )}

      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="px-7 pb-5 pt-7 text-center">
              <span
                className={
                  'mx-auto grid h-12 w-12 place-items-center rounded-full ' +
                  (asking === 'issue' ? 'bg-[#EFEDFB]' : 'bg-[#FDF0E0]')
                }
              >
                <b
                  className={
                    'text-[20px] font-extrabold leading-none ' +
                    (asking === 'issue' ? 'text-[#5546C8]' : 'text-[#E09A1B]')
                  }
                >
                  {asking === 'issue' ? '₩' : '!'}
                </b>
              </span>

              <h3 className="mt-4 text-[15.5px] font-bold tracking-tight text-[#1A2130]">
                {asking === 'issue' ? '청구서를 발행할까요?' : '마감을 되돌릴까요?'}
              </h3>

              {asking === 'issue' ? (
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

              {asking === 'issue' && (
                <p className="mt-3 text-[13px] leading-relaxed text-[#B3312C]">
                  <b className="font-bold">발행하면 되돌릴 수 없습니다.</b> 번호가 붙고 금액이
                  굳습니다 — 그 뒤에 단가를 고치거나 주문을 손대도 이 청구액은 달라지지
                  않습니다. 잘못 나갔으면 마이너스 청구서로만 바로잡습니다.
                </p>
              )}

              {asking === 'issue' && unpricedCount > 0 && (
                <p className="mt-3 rounded-md border border-[#F5C6C4] bg-[#FDF2F2] px-3 py-2 text-[13px] font-semibold leading-relaxed text-[#B3312C]">
                  단가를 안 정한 보철이 {unpricedCount}줄 있습니다. 지금 발행하면 0원으로 굳어
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
                  (asking === 'issue'
                    ? 'bg-[#5546C8] hover:bg-[#4536B8]'
                    : 'bg-[#E09A1B] hover:bg-[#C9880F]')
                }
              >
                {busy ? '처리 중…' : asking === 'issue' ? '발행' : '되돌리기'}
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
