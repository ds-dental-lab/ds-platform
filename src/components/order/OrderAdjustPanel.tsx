// =========================================================
// 놓을 위치: src/components/order/OrderAdjustPanel.tsx
//
// 주문상세의 몽키스패너 — 이 주문의 금액을 그 자리에서 조정합니다.
// 디자인센터 **관리자만** 봅니다.
//
// ★ 왜 정산 화면 말고 여기서도 하는가.
//   깎아 줄 일은 대개 그 주문을 보다가 생깁니다 — "이건 우리 실수니
//   빼 주자". 그때 정산 탭으로 가서 그 달을 찾아 그 치과를 고르고 그
//   치식을 다시 찾는 동안 이유를 잊습니다.
//
// ★ 치과 쪽과 기공소 쪽이 **따로** 있습니다.
//   같은 16번이라도 치과에 5만원을 받고 기공소에 3만원을 줍니다.
//   한 칸만 두면 반드시 엉뚱한 쪽이 깎입니다.
//
// ★ 원금액을 덮어쓰지 않고 차액을 덧댑니다.
//   "얼마였는데 왜 깎았나" 가 남아야 합니다. 사유도 함께 받습니다 —
//   그대로 청구서에 실려 치과가 읽습니다.
//
// ★ 이미 청구서에 실린 조정은 못 지웁니다.
//   나간 문서의 숫자는 안 바뀝니다. 되돌리려면 반대 조정을 넣습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitAdjustItem, submitRemoveAdjustments } from '@/server/actions/billing';
import type { OrderMoney, OrderMoneyItem } from '@/server/repositories/order-money';

export interface OrderAdjustPanelProps {
  money: OrderMoney;
  /** 창에 적을 환자 이름 — '홍길동 · 16번' */
  patientLabel: string;
}

type Side = 'clinic' | 'lab';

export default function OrderAdjustPanel({ money, patientLabel }: OrderAdjustPanelProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ item: OrderMoneyItem; side: Side } | null>(null);
  const [error, setError] = useState('');

  const clinicTotal = money.items.reduce((s, i) => s + i.clinicAmount + i.clinicAdjust, 0);
  const labTotal = money.items.reduce((s, i) => s + i.labAmount + i.labAdjust, 0);

  return (
    <section className="mt-3 rounded-lg border border-[#E8EBF0] bg-white">
      <header className="flex flex-wrap items-baseline gap-2 border-b border-[#E8EBF0] px-4 py-3">
        <h3 className="text-[13.5px] font-bold tracking-tight text-[#1A2130]">금액 조정</h3>
        <span className="text-[11.5px] text-[#98A2B3]">관리자만 보입니다</span>
      </header>

      {/* ★ 자사 제작은 지급이 없습니다 (설계서 Q-6) — 자기가 자기에게 주는 돈입니다 */}
      {money.inHouse && (
        <p className="border-b border-[#E8EBF0] bg-[#FBFCFD] px-4 py-2.5 text-[12px] text-[#98A2B3]">
          자사 제작이라 기공소에 지급할 금액이 없습니다. 치과 청구액만 조정합니다.
        </p>
      )}

      {/* ★ 리메이크·리페어는 0원입니다. 조정할 것이 없다고 먼저 말합니다 */}
      {!money.billable && (
        <p className="border-b border-[#E8EBF0] bg-[#FEF8EC] px-4 py-2.5 text-[12px] text-[#8A6320]">
          리메이크·리페어라 청구하지 않는 주문입니다. 조정해도 금액이 안 잡힙니다.
        </p>
      )}

      {error && (
        <p className="border-b border-[#F3C6C6] bg-[#FDECEA] px-4 py-2.5 text-[12px] font-semibold text-[#B3312C]">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12px]">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-[11.5px] text-[#98A2B3]">
              <th className="px-4 py-2 font-medium">치식</th>
              <th className="px-2 py-2 font-medium">제품</th>
              <th className="px-2 py-2 text-right font-medium">
                치과 청구
                <span className="ml-1 font-normal text-[#C4CBD6]">{money.clinicName}</span>
              </th>
              <th className="px-4 py-2 text-right font-medium">
                기공소 지급
                <span className="ml-1 font-normal text-[#C4CBD6]">
                  {money.inHouse ? '자사 제작' : money.labName || '미배정'}
                </span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F0F2F5]">
            {money.items.map((item) => (
              <tr key={item.itemId} className="hover:bg-[#F8F9FB]">
                <td className="px-4 py-2 font-semibold tabular-nums text-[#1A2130]">
                  {item.toothNumber}
                  {item.isPontic && (
                    <span className="ml-1 text-[10.5px] font-normal text-[#98A2B3]">Pontic</span>
                  )}
                </td>
                <td className="px-2 py-2 text-[#4A5567]">{item.label}</td>

                <td className="px-2 py-2 text-right">
                  <Cell
                    amount={item.clinicAmount}
                    adjust={item.clinicAdjust}
                    unpriced={item.clinicUnpriced}
                    onClick={() => setEditing({ item, side: 'clinic' })}
                  />
                </td>

                <td className="px-4 py-2 text-right">
                  {money.labOrgId ? (
                    <Cell
                      amount={item.labAmount}
                      adjust={item.labAdjust}
                      unpriced={item.labUnpriced}
                      onClick={() => setEditing({ item, side: 'lab' })}
                    />
                  ) : (
                    // 자사 제작이거나 기공소가 안 정해졌으면 지급할 곳이 없습니다
                    <span className="text-[#DDE2EA]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t border-[#E8EBF0] text-[12.5px] font-bold">
              <td className="px-4 py-2.5 text-[#4A5567]" colSpan={2}>
                합계
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-[#1A2130]">
                {won(clinicTotal)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-[#1A2130]">
                {money.labOrgId ? won(labTotal) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t border-[#E8EBF0] px-4 py-2.5 text-[11.5px] leading-relaxed text-[#98A2B3]">
        금액을 눌러 깎거나 더합니다. 원금액은 그대로 두고 차액 한 줄이 붙습니다 — 사유는 청구서에
        그대로 실립니다.
      </p>

      {editing && (
        <AdjustDialog
          item={editing.item}
          side={editing.side}
          partyOrgId={editing.side === 'clinic' ? money.clinicOrgId : (money.labOrgId as string)}
          partyName={editing.side === 'clinic' ? money.clinicName : money.labName}
          patientLabel={patientLabel}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setError('');
            startTransition(() => router.refresh());
          }}
          onError={(e) => {
            setEditing(null);
            setError(e);
          }}
          busy={refreshing}
        />
      )}
    </section>
  );
}

// ---------- 칸 ----------

function Cell({
  amount,
  adjust,
  unpriced,
  onClick,
}: {
  amount: number;
  adjust: number;
  unpriced: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="눌러서 조정"
      className="group rounded px-1.5 py-1 text-right hover:bg-[#E7EEFA]"
    >
      {/* ★ 안 정한 단가는 0원이 아니라 '미정' 입니다 */}
      {unpriced ? (
        <span className="text-[11.5px] font-bold text-[#B3312C]">미정</span>
      ) : (
        <span className="font-semibold tabular-nums text-[#1A2130]">{won(amount + adjust)}</span>
      )}

      {adjust !== 0 && (
        <span className="ml-1 text-[11px] font-semibold tabular-nums text-[#C2721B]">
          ({adjust > 0 ? '+' : ''}
          {adjust.toLocaleString('ko-KR')})
        </span>
      )}

      <span className="ml-1 text-[#C4CBD6] group-hover:text-[#1279E8]">⚙</span>
    </button>
  );
}

// ---------- 조정 창 ----------

function AdjustDialog({
  item,
  side,
  partyOrgId,
  partyName,
  patientLabel,
  onClose,
  onSaved,
  onError,
  busy,
}: {
  item: OrderMoneyItem;
  side: Side;
  partyOrgId: string;
  partyName: string;
  patientLabel: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (e: string) => void;
  busy: boolean;
}) {
  const [sign, setSign] = useState<'minus' | 'plus'>('minus');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const base = side === 'clinic' ? item.clinicAmount : item.labAmount;
  const already = side === 'clinic' ? item.clinicAdjust : item.labAdjust;
  const posted = side === 'clinic' ? item.clinicPosted : item.labPosted;

  const raw = Number(value.replace(/[,\s]/g, ''));
  const delta = sign === 'minus' ? -raw : raw;
  const valid = Number.isInteger(raw) && raw > 0 && reason.trim().length > 0;

  async function save() {
    setError('');
    setSaving(true);

    const result = await submitAdjustItem({
      orderItemId: item.itemId,
      partyOrgId,
      amount: delta,
      reason,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  async function removeAll() {
    setSaving(true);
    const result = await submitRemoveAdjustments(item.itemId);
    setSaving(false);

    if (!result.ok) {
      onError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14.5px] font-bold tracking-tight text-[#1A2130]">
            {side === 'clinic' ? '치과 청구액' : '기공소 지급액'} 조정
          </h2>
          <p className="mt-0.5 text-[12px] text-[#98A2B3]">
            {partyName} · {patientLabel} · {item.toothNumber}번 {item.label}
          </p>
        </header>

        <div className="space-y-3.5 px-5 py-4">
          <p className="rounded-md bg-[#F8F9FB] px-3 py-2 text-[12.5px] text-[#4A5567]">
            지금 {won(base)}
            {already !== 0 && (
              <span className="text-[#C2721B]">
                {' '}
                · 조정 {already > 0 ? '+' : ''}
                {already.toLocaleString('ko-KR')}
              </span>
            )}
          </p>

          <div className="flex gap-1.5">
            {(['minus', 'plus'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSign(s)}
                aria-pressed={sign === s}
                className={
                  'h-10 flex-1 rounded-md border text-[13px] font-bold ' +
                  (sign === s
                    ? s === 'minus'
                      ? 'border-[#D8453F] bg-[#FDECEA] text-[#D8453F]'
                      : 'border-[#12855B] bg-[#E6F4EE] text-[#12855B]'
                    : 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]')
                }
              >
                {s === 'minus' ? '− 깎기' : '＋ 더하기'}
              </button>
            ))}
          </div>

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            placeholder="금액"
            className="h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[14px] tabular-nums outline-none focus:border-[#1279E8]"
          />

          {/* ★ 사유가 없으면 저장이 안 됩니다 — 청구서에 그대로 실립니다 */}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="사유 (청구서에 그대로 실립니다) — 예) 우수고객할인"
            className="h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13px] outline-none focus:border-[#1279E8]"
          />

          {valid && (
            <p className="text-[12px] text-[#98A2B3]">
              넣으면 <b className="font-bold text-[#1A2130]">{won(base + already + delta)}</b> 가
              됩니다
            </p>
          )}

          {error && <p className="text-[12.5px] font-semibold text-[#D8453F]">{error}</p>}
        </div>

        <footer className="flex gap-2 border-t border-[#E8EBF0] px-5 py-3.5">
          {/* 아직 청구서에 안 실린 조정만 지웁니다 */}
          {already !== 0 && !posted && (
            <button
              type="button"
              onClick={removeAll}
              disabled={saving || busy}
              className="h-10 rounded-md border border-[#DDE2EA] px-3 text-[12.5px] font-semibold text-[#4A5567] hover:bg-[#FDECEA] hover:text-[#D8453F] disabled:opacity-60"
            >
              조정 지우기
            </button>
          )}
          {posted && (
            <span className="self-center text-[11.5px] text-[#98A2B3]">
              청구서에 실려 못 지웁니다
            </span>
          )}

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
            disabled={saving || busy || !valid}
            className="h-10 rounded-md bg-[#1279E8] px-5 text-[13px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#C4CBD6]"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function won(amount: number): string {
  return `${amount < 0 ? '-' : ''}₩${Math.abs(amount).toLocaleString('ko-KR')}`;
}
