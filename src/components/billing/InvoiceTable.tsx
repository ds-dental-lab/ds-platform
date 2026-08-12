// =========================================================
// 놓을 위치: src/components/billing/InvoiceTable.tsx
//
// 청구 내역 — 이미 나간 청구서의 목록. (사용자가 쓰던 화면 기준)
//
// 오른쪽 기능 넷
//   ⬇ 내려받기   청구서를 열고 인쇄창을 띄웁니다 ('PDF로 저장')
//   ↩ 재발송     다시 보냈다고 적습니다 (실제 발송은 아직 없습니다)
//   🗑 취소       발행을 무르고 마감 상태로 되돌립니다
//   💳 정산       입금을 적습니다. 미납이 0이 되면 '완료' 가 됩니다
//
// ★ 상태는 눌러서 바꾸는 딱지가 아닙니다.
//   미납이 0이면 완료, 남아 있으면 미입금입니다 (domain/invoice).
//   딱지를 따로 켜게 두면 '완료' 인데 미납이 남는 줄이 생깁니다.
//
// ★ 받는 곳을 청구 대상 아래에 적습니다.
//   **발행할 때 베낀 값**입니다 — 지금 거래처 설정이 아닙니다.
//   그래야 "그때 어디로 보냈나" 에 답할 수 있습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitPayment,
  submitResend,
  submitCancelInvoice,
  submitIssueCredit,
} from '@/server/actions/invoice';
import { INVOICE_STATUS_LABEL, checkCredit } from '@/server/domain/invoice';
import { INVOICE_METHOD_LABEL } from '@/server/domain/invoice-method';
import type { InvoiceRow } from '@/server/repositories/invoice';

export interface InvoiceTableProps {
  rows: InvoiceRow[];
}

export default function InvoiceTable({ rows }: InvoiceTableProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [crediting, setCrediting] = useState<InvoiceRow | null>(null);
  const [asking, setAsking] = useState<InvoiceRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const busy = (id: string) => busyId === id || refreshing;

  /*
    ★ 새 창에서 열고 인쇄창을 띄웁니다.
      브라우저 인쇄창의 기본 대상이 'PDF로 저장' 이라 한 번 더 누르면
      파일이 됩니다. 소리 없이 파일로 떨어지게 하려면 한글 글꼴을 통째로
      싣거나 서버에서 그려야 하는데, 둘 다 지금 없습니다 — 화면이
      거짓말하지 않도록 '인쇄창이 뜬다' 는 것을 버튼 설명에 적어 둡니다.
  */
  function download(row: InvoiceRow) {
    window.open(
      `/design/billing/${row.partyOrgId}/${row.yearMonth}?print=1`,
      '_blank',
      'noopener',
    );
  }

  async function resend(row: InvoiceRow) {
    setError('');
    setNote('');
    setBusyId(row.periodId);

    const result = await submitResend(row.periodId);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNote(
      `${row.invoiceNo} 를 다시 보냈다고 적었습니다. (실제 발송은 아직 붙어 있지 않습니다)`,
    );
    startTransition(() => router.refresh());
  }

  async function cancel(row: InvoiceRow) {
    setError('');
    setNote('');
    setAsking(null);
    setBusyId(row.periodId);

    const result = await submitCancelInvoice(row.periodId);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <>
      {error && (
        <p className="mb-2 rounded-md bg-[#FDECEA] px-3 py-2 text-[12.5px] font-semibold text-[#B3312C]">
          {error}
        </p>
      )}
      {note && (
        <p className="mb-2 rounded-md bg-[#E7EEFA] px-3 py-2 text-[12.5px] font-semibold text-[#1279E8]">
          {note}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full min-w-[900px] text-[12.5px]">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-[12px] text-[#98A2B3]">
              <th className="px-4 py-3 font-medium">청구 번호</th>
              <th className="px-4 py-3 font-medium">청구서 발행일</th>
              <th className="px-4 py-3 font-medium">청구 방법</th>
              <th className="px-4 py-3 font-medium">청구 대상</th>
              <th className="px-4 py-3 text-right font-medium">청구 금액</th>
              <th className="px-4 py-3 text-right font-medium">미납 금액</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">납부기한</th>
              <th className="px-4 py-3 text-right font-medium">기능</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F0F2F5]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-20 text-center text-[13px] text-[#98A2B3]">
                  발행된 청구서가 없습니다. 정산 탭에서 마감하고 발행하면 여기 쌓입니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.periodId} className="hover:bg-[#F8F9FB]">
                  <td className="px-4 py-3 font-semibold tabular-nums text-[#1A2130]">
                    {row.invoiceNo}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#4A5567]">
                    {row.issuedAt.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-[#4A5567]">
                    {row.method ? INVOICE_METHOD_LABEL[row.method] : '-'}
                    {row.sentCount > 0 && (
                      <span className="ml-1 text-[11px] text-[#98A2B3]">
                        · 재발송 {row.sentCount}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className="block font-semibold text-[#1A2130]">{row.partyName}</span>
                    {/* ★ 발행할 때 베낀 값입니다 — 지금 설정이 아닙니다 */}
                    <span className="block text-[11.5px] text-[#98A2B3]">
                      {row.sentTo ?? '-'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#1A2130]">
                    {/*
                      ★ 깎였으면 원래 금액을 지우지 않고 **함께** 보여 줍니다.
                        받을 돈만 남기면 "청구서에는 49만원이라 적혀 있는데
                        왜 42만원이냐" 를 매번 설명해야 합니다.
                    */}
                    {row.credited > 0 ? (
                      <>
                        <span className="block text-[11.5px] font-normal text-[#98A2B3] line-through">
                          ₩{row.total.toLocaleString('ko-KR')}
                        </span>
                        <span className="block">₩{row.billed.toLocaleString('ko-KR')}</span>
                        <span className="block text-[11px] font-normal text-[#C77700]">
                          CRD −{row.credited.toLocaleString('ko-KR')}
                        </span>
                      </>
                    ) : (
                      <>₩{row.total.toLocaleString('ko-KR')}</>
                    )}
                  </td>
                  <td
                    className={
                      'px-4 py-3 text-right font-semibold tabular-nums ' +
                      (row.unpaid > 0 ? 'text-[#B3312C]' : 'text-[#98A2B3]')
                    }
                  >
                    ₩{row.unpaid.toLocaleString('ko-KR')}
                    {row.overpaid > 0 && (
                      <span
                        className="ml-1 text-[11px] font-normal text-[#C77700]"
                        title="청구액보다 많이 들어왔습니다"
                      >
                        +{row.overpaid.toLocaleString('ko-KR')}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={
                        'rounded-full px-2.5 py-1 text-[11.5px] font-bold ' +
                        (row.status === 'paid'
                          ? 'bg-[#E6F4EE] text-[#12855B]'
                          : 'bg-[#FDECEA] text-[#D8453F]')
                      }
                    >
                      {INVOICE_STATUS_LABEL[row.status]}
                    </span>
                  </td>

                  <td className="px-4 py-3 tabular-nums text-[#4A5567]">{row.dueDate ?? '-'}</td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-0.5">
                      <Icon
                        label="정산서 내려받기 (인쇄창에서 PDF로 저장)"
                        onClick={() => download(row)}
                        disabled={busy(row.periodId)}
                      >
                        <DownloadIcon />
                      </Icon>
                      <Icon
                        label="재발송 기록"
                        onClick={() => resend(row)}
                        disabled={busy(row.periodId)}
                      >
                        <ResendIcon />
                      </Icon>
                      <Icon
                        label="발행 취소"
                        danger
                        onClick={() => setAsking(row)}
                        disabled={busy(row.periodId)}
                      >
                        <TrashIcon />
                      </Icon>
                      <Icon
                        label="마이너스 청구서 (CRD-)"
                        onClick={() => setCrediting(row)}
                        disabled={busy(row.periodId)}
                      >
                        <MinusIcon />
                      </Icon>
                      <Icon
                        label="정산 (입금 적기)"
                        onClick={() => setPaying(row)}
                        disabled={busy(row.periodId)}
                      >
                        <CardIcon />
                      </Icon>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {crediting && (
        <CreditDialog
          row={crediting}
          onClose={() => setCrediting(null)}
          onSaved={() => {
            setCrediting(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {paying && (
        <PaymentDialog
          row={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {/* ★ 취소는 번호가 이미 나간 문서를 무르는 일입니다. 한 번 묻습니다 */}
      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[360px] overflow-hidden rounded-xl bg-white text-center shadow-xl">
            <div className="px-7 pb-6 pt-7">
              <h3 className="text-[15px] font-bold tracking-tight text-[#1A2130]">
                이 청구서를 취소할까요?
              </h3>
              <p className="mt-2 text-[12.5px] text-[#4A5567]">
                {asking.invoiceNo} · {asking.partyName}
              </p>
              <p className="mt-1.5 text-[12px] text-[#98A2B3]">
                마감 상태로 돌아갑니다. 번호는 다시 쓰지 않습니다.
              </p>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setAsking(null)}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                그대로 두기
              </button>
              <button
                type="button"
                onClick={() => cancel(asking)}
                className="h-11 flex-1 rounded-md bg-[#D8453F] text-[13.5px] font-bold text-white hover:bg-[#C13B36]"
              >
                취소하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- 정산 (입금) ----------

/**
 * 입금 적기.
 *
 * ★ 미납 금액을 미리 채워 둡니다.
 *   대부분은 청구한 대로 들어옵니다. 빈 칸으로 두면 매번 손으로 적게
 *   되고, 손으로 적으면 자릿수를 틀립니다.
 */
function PaymentDialog({
  row,
  onClose,
  onSaved,
}: {
  row: InvoiceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(String(row.unpaid));
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amount = Number(text.replace(/[,\s]/g, ''));
  const valid = Number.isInteger(amount) && amount !== 0;
  const left = row.unpaid - amount;

  async function save() {
    setError('');
    setSaving(true);

    const result = await submitPayment({ periodId: row.periodId, amount, memo });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="px-6 pb-2 pt-5">
          <h2 className="text-[16px] font-bold tracking-tight text-[#1A2130]">정산</h2>
          <p className="mt-0.5 text-[12px] text-[#98A2B3]">
            {row.invoiceNo} · {row.partyName}
          </p>
        </header>

        <div className="px-6 pb-5 pt-3">
          <div className="flex items-baseline">
            <label htmlFor="pay" className="text-[13px] font-semibold text-[#4A5567]">
              정산 금액
            </label>
            <span className="ml-auto text-[13px] font-bold text-[#1A2130]">
              미납 금액: ₩{row.unpaid.toLocaleString('ko-KR')}
            </span>
          </div>

          <input
            id="pay"
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputMode="numeric"
            className="mt-2 h-11 w-full rounded-md border border-[#DDE2EA] px-3 text-[14px] tabular-nums outline-none focus:border-[#1279E8]"
          />

          {/* ★ 넣고 나면 얼마가 남는지 그 자리에서 보여 줍니다 */}
          {valid && (
            <p className="mt-1.5 text-[12px] text-[#98A2B3]">
              {left > 0 ? (
                <>
                  넣으면 <b className="font-bold text-[#B3312C]">₩{left.toLocaleString('ko-KR')}</b>{' '}
                  남습니다
                </>
              ) : left === 0 ? (
                <b className="font-bold text-[#12855B]">넣으면 완료가 됩니다</b>
              ) : (
                <b className="font-bold text-[#C77700]">
                  청구액보다 ₩{Math.abs(left).toLocaleString('ko-KR')} 많습니다 — 그대로 적힙니다
                </b>
              )}
            </p>
          )}

          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (선택) — 예) 8월분 합산 입금"
            className="mt-3 h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13px] outline-none focus:border-[#1279E8]"
          />

          {error && <p className="mt-2 text-[12.5px] font-semibold text-[#D8453F]">{error}</p>}
        </div>

        <footer className="flex gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-auto h-10 rounded-md px-4 text-[13px] font-semibold text-[#98A2B3] hover:text-[#4A5567]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !valid}
            className="h-10 rounded-md bg-[#1279E8] px-5 text-[13px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#C4CBD6]"
          >
            {saving ? '적는 중…' : '정산 완료'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---------- 조각들 ----------

function Icon({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={
        'grid h-8 w-8 place-items-center rounded-md text-[#98A2B3] disabled:opacity-40 ' +
        (danger ? 'hover:bg-[#FDECEA] hover:text-[#D8453F]' : 'hover:bg-[#E7EEFA] hover:text-[#1279E8]')
      }
    >
      {children}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3v9.5M6.5 9 10 12.5 13.5 9" />
      <path d="M3.5 13.5v1.8a1.2 1.2 0 0 0 1.2 1.2h10.6a1.2 1.2 0 0 0 1.2-1.2v-1.8" />
    </svg>
  );
}

function ResendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 5 3 9.5 7.5 14" />
      <path d="M3 9.5h8a6 6 0 0 1 6 6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
      <path d="M5.5 5.5 6.2 16a1 1 0 0 0 1 1h5.6a1 1 0 0 0 1-1l.7-10.5" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <rect x="2.6" y="4.2" width="14.8" height="11.6" rx="1.8" />
      <path d="M6.6 10h6.8" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M2.5 8.5h15" />
    </svg>
  );
}

// ---------- 마이너스 청구서 ----------

/**
 * ★ 원본을 고치는 창이 아닙니다.
 *   "얼마로 바꿀까요" 가 아니라 "얼마를 깎을까요" 를 묻습니다. 그래야
 *   나가는 문서가 무엇인지가 화면과 일치합니다.
 */
function CreditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: InvoiceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amount = Number(text.replace(/[^\d-]/g, '') || 0);
  const room = row.total - row.credited;
  const verdict = checkCredit(amount, row.total, row.credited);
  const after = row.billed - amount;

  async function save() {
    setError('');

    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }

    setSaving(true);
    const result = await submitIssueCredit(row.periodId, amount, reason);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[400px] rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-[15px] font-bold tracking-tight text-[#1A2130]">마이너스 청구서</h3>

        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#7C8595]">
          {row.invoiceNo} · {row.partyName}
          <br />
          이미 나간 청구서는 고치지 않습니다. <b className="font-semibold text-[#4A5567]">CRD-</b>{' '}
          번호가 붙은 문서를 한 장 더 내어 그만큼 깎습니다.
        </p>

        <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-[#4A5567]">
          깎을 금액
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="numeric"
          autoFocus
          placeholder="0"
          className="w-full rounded border border-[#DDE2EA] px-3 py-2 text-right text-[15px] font-bold tabular-nums outline-none focus:border-[#1279E8]"
        />

        <p className="mt-1.5 text-[11.5px] text-[#98A2B3]">
          더 깎을 수 있는 금액 ₩{room.toLocaleString('ko-KR')}
        </p>

        <label className="mb-1.5 mt-3.5 block text-[12.5px] font-semibold text-[#4A5567]">
          사유
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="리메이크 차감 · 과청구 정정 등"
          className="w-full rounded border border-[#DDE2EA] px-3 py-2 text-[13px] outline-none focus:border-[#1279E8]"
        />

        {/* ★ 누르기 전에 결과를 보여 줍니다. 번호가 붙으면 못 무릅니다 */}
        {amount > 0 && verdict.ok && (
          <p className="mt-3 rounded border border-[#DDE7F7] bg-[#F5F9FF] px-3 py-2.5 text-[12.5px] tabular-nums text-[#31517E]">
            받을 돈 ₩{row.billed.toLocaleString('ko-KR')} → <b>₩{after.toLocaleString('ko-KR')}</b>
          </p>
        )}

        {error && <p className="mt-2 text-[12.5px] font-semibold text-[#B3312C]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded border border-[#DDE2EA] px-4 py-2 text-[13px] text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={saving || !verdict.ok || !reason.trim()}
            className="rounded bg-[#C77700] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#A96500] disabled:cursor-not-allowed disabled:bg-[#D5DAE2]"
          >
            {saving ? '발행 중…' : '발행'}
          </button>
        </div>
      </div>
    </div>
  );
}
