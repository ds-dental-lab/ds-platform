// =========================================================
// 놓을 위치: src/components/contact/PriceSheetDialog.tsx
//
// "수가표 보내기" 창 — PC 문의 목록과 폰 문의 화면이 같이 씁니다.
// (사용자 요청 2026-09-07 — "보내기 전에 수가표를 조정할 수 있으면,
// 지금 값이 기본값")
//
// ★ 표가 곧 입력칸입니다. 기본값이 채워져 있고 숫자만 고칩니다 —
//   항목 이름·분류는 여기서 안 바꿉니다 (그건 기본값 자리의 일).
// ★ '기본값으로 저장' 을 켜면 이번 값이 다음 문의의 기본값이 됩니다.
//   안 켜면 이 치과에만 이 값으로 갑니다.
// ★ 받는 메일 주소를 늘 보여 줍니다 — 어디로 가는지 모르고 누르면 안 됩니다.
// =========================================================

'use client';

import { useState } from 'react';
import { submitSendPriceSheet } from '@/server/actions/price-sheet';
import { formatWon, groupRows, type PriceRow } from '@/server/domain/price-sheet';

export interface PriceSheetDialogProps {
  contactId: string;
  clinicName: string;
  email: string;
  defaults: PriceRow[];
  onClose: () => void;
  onSent: (sentAt: string) => void;
  /** 폰이면 아래에서 올라오는 판, PC 면 가운데 창 */
  phone?: boolean;
}

export default function PriceSheetDialog({
  contactId,
  clinicName,
  email,
  defaults,
  onClose,
  onSent,
  phone = false,
}: PriceSheetDialogProps) {
  const [rows, setRows] = useState<PriceRow[]>(() => defaults.map((r) => ({ ...r })));
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changed = rows.some((r, i) => r.price !== defaults[i]?.price);

  function setPrice(index: number, raw: string) {
    const digits = raw.replace(/[^\d]/g, '');
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, price: digits ? Number(digits) : 0 } : r)));
  }

  async function send() {
    setError('');
    setBusy(true);
    const result = await submitSendPriceSheet(contactId, rows, save);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSent(result.sentAt);
  }

  const groups = groupRows(rows);

  return (
    <div
      className={
        'fixed inset-0 z-50 bg-black/40 ' + (phone ? 'grid place-items-end' : 'grid place-items-center p-6')
      }
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={
          'w-full bg-white ' +
          (phone ? 'max-h-[92dvh] overflow-y-auto rounded-t-2xl p-5 pb-8' : 'max-w-[520px] rounded-xl p-6')
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[17px] font-extrabold text-[#1A2130]">수가표 보내기</h3>
            <p className="mt-1 truncate text-[13.5px] text-[#4A5567]">
              <b className="font-bold">{clinicName}</b> · {email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#98A2B3] hover:bg-[#F4F6F9]"
          >
            &#10005;
          </button>
        </div>

        <p className="mt-3 text-[12.5px] text-[#98A2B3]">
          기본값이 채워져 있습니다. 이 치과에만 다르게 보내려면 숫자를 고치세요.
        </p>

        {/* ---------- 표 ---------- */}
        <div className="mt-3 overflow-hidden rounded-xl border border-[#E8EBF0]">
          {groups.map(({ group, rows: items }) => (
            <div key={group} className="border-b border-[#E8EBF0] last:border-b-0">
              <div className="bg-[#F8F9FB] px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#5546C8]">
                {group}
              </div>
              {items.map((r) => {
                const index = rows.indexOf(r);
                return (
                  <label key={`${r.group}-${r.item}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 text-[14px] text-[#1A2130]">{r.item}</span>
                    <span className="flex items-center gap-1">
                      <input
                        inputMode="numeric"
                        value={r.price ? formatWon(r.price) : ''}
                        onChange={(e) => setPrice(index, e.target.value)}
                        disabled={busy}
                        className={
                          'h-10 w-[112px] rounded-lg border px-3 text-right text-[15px] font-bold tabular-nums outline-none focus:border-[#1279E8] ' +
                          (r.price !== defaults[index]?.price ? 'border-[#1279E8] bg-[#EDF3FE]' : 'border-[#DDE2EA]')
                        }
                      />
                      <span className="text-[12.5px] text-[#98A2B3]">원</span>
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        <label className="mt-3 flex items-center gap-2 text-[13.5px] text-[#4A5567]">
          <input
            type="checkbox"
            checked={save}
            onChange={(e) => setSave(e.target.checked)}
            disabled={busy || !changed}
            className="h-4 w-4"
          />
          이 값을 다음부터 기본값으로
          {!changed && <span className="text-[12px] text-[#98A2B3]">(바꾼 게 없습니다)</span>}
        </label>

        {error && <p className="mt-3 text-[13.5px] text-[#D8453F]">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-11 flex-1 rounded-lg border border-[#DDE2EA] text-[14.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy}
            className="h-11 flex-1 rounded-lg bg-[#1279E8] text-[14.5px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#D5DAE2]"
          >
            {busy ? '보내는 중…' : '메일로 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}
