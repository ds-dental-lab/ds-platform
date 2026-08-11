// =========================================================
// 놓을 위치: src/components/implant/SurchargeEditor.tsx
//
// 추가 과금 항목 금액. (치은포셀린 등)
//
// 기본값 한 줄이 있고, 치과별로 다르게 받고 싶으면 줄을 더합니다.
// 주문에 치은포셀린이 붙으면 그 치아 기공료에 이 금액이 더해집니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitSurchargeAmount,
  submitClinicSurcharge,
} from '@/server/actions/surcharge';
import type { SurchargeRow } from '@/server/repositories/surcharge';
import type { PartnerClinic } from '@/server/repositories/order';

export interface SurchargeEditorProps {
  rows: SurchargeRow[];
  clinics: PartnerClinic[];
}

export default function SurchargeEditor({ rows, clinics }: SurchargeEditorProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, String(r.amount)])),
  );

  const [adding, setAdding] = useState<SurchargeRow | null>(null);
  const [newClinic, setNewClinic] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const busy = saving || refreshing;

  // 치과별 값이 이미 있는 곳은 다시 고를 수 없습니다
  const takenClinics = new Set(rows.map((r) => r.targetClinicOrgId).filter(Boolean));

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    setSaving(true);
    const result = await action();
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? '처리하지 못했습니다');
      return false;
    }

    startTransition(() => router.refresh());
    return true;
  }

  const defaults = rows.filter((r) => !r.targetClinicOrgId);
  const perClinic = rows.filter((r) => r.targetClinicOrgId);

  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white">
      <div className="border-b border-[#E8EBF0] px-5 py-3.5">
        <h2 className="text-[14px] font-bold text-[#1A2130]">추가 과금 항목</h2>
        <p className="mt-0.5 text-[12px] text-[#98A2B3]">
          치아에 붙는 추가 항목의 금액입니다. 치과별로 다르게 받으려면 줄을 더하세요.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-[#98A2B3]">
          등록된 추가 항목이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-[#F0F2F5]">
          {defaults.map((row) => (
            <li key={row.id} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-[110px] text-[13px] font-bold text-[#1A2130]">
                  {row.name}
                </span>

                <span className="rounded bg-[#F4F6F9] px-2 py-0.5 text-[11px] font-semibold text-[#98A2B3]">
                  기본값
                </span>

                <AmountInput
                  value={drafts[row.id] ?? ''}
                  onChange={(v) => setDrafts((p) => ({ ...p, [row.id]: v }))}
                  onSave={() =>
                    run(() => submitSurchargeAmount(row.id, Number(drafts[row.id])))
                  }
                  busy={busy}
                  dirty={String(row.amount) !== (drafts[row.id] ?? '')}
                />

                <button
                  type="button"
                  onClick={() => {
                    setAdding(row);
                    setNewClinic('');
                    setNewAmount(String(row.amount));
                    setError('');
                  }}
                  className="ml-auto rounded border border-[#DDE2EA] px-3 py-1.5 text-[12.5px] text-[#4A5567] hover:bg-[#F4F6F9]"
                >
                  치과별 금액 추가
                </button>
              </div>

              {/* 이 항목의 치과별 금액들 */}
              {perClinic
                .filter((c) => c.code === row.code)
                .map((c) => (
                  <div key={c.id} className="mt-2 flex flex-wrap items-center gap-3 pl-4">
                    <span className="text-[#C4CBD6]">└</span>
                    <span className="min-w-[110px] text-[13px] text-[#4A5567]">
                      {c.targetClinicName}
                    </span>

                    <AmountInput
                      value={drafts[c.id] ?? ''}
                      onChange={(v) => setDrafts((p) => ({ ...p, [c.id]: v }))}
                      onSave={() =>
                        run(() => submitSurchargeAmount(c.id, Number(drafts[c.id])))
                      }
                      busy={busy}
                      dirty={String(c.amount) !== (drafts[c.id] ?? '')}
                    />
                  </div>
                ))}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="px-5 pb-4 text-[13px] text-[#D8453F]">{error}</p>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-base font-bold">{adding.name} — 치과별 금액</h3>
            <p className="mt-1 text-[13px] text-[#98A2B3]">
              고른 치과에만 다른 금액이 적용됩니다.
            </p>

            <label className="mt-4 mb-1.5 block text-[12px] font-bold text-[#98A2B3]">치과</label>
            <select
              value={newClinic}
              onChange={(e) => setNewClinic(e.target.value)}
              className="w-full rounded border border-[#DDE2EA] px-3 py-2 text-[13px]"
            >
              <option value="">선택하세요</option>
              {clinics
                .filter((c) => !takenClinics.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>

            <label className="mt-3 mb-1.5 block text-[12px] font-bold text-[#98A2B3]">금액</label>
            <input
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              className="w-full rounded border border-[#DDE2EA] px-3 py-2 text-[13px]"
            />

            {error && <p className="mt-2 text-[12px] text-[#D8453F]">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdding(null)}
                className="rounded border border-[#DDE2EA] px-4 py-2 text-[13px] text-[#4A5567]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy || !newClinic || !newAmount}
                onClick={async () => {
                  const ok = await run(() =>
                    submitClinicSurcharge(
                      adding.code,
                      adding.name,
                      newClinic,
                      Number(newAmount),
                    ),
                  );
                  if (ok) setAdding(null);
                }}
                className="rounded bg-[#1B63E8] px-5 py-2 text-[13px] font-semibold text-white disabled:bg-[#D5DAE2]"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  onSave,
  busy,
  dirty,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  busy: boolean;
  dirty: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && dirty && onSave()}
        inputMode="numeric"
        className="w-28 rounded border border-[#DDE2EA] px-2 py-1.5 text-right text-[13px] tabular-nums outline-none focus:border-[#1B63E8]"
      />
      <span className="text-[12px] text-[#98A2B3]">원</span>

      {dirty && (
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded bg-[#1B63E8] px-3 py-1.5 text-[12px] font-semibold text-white disabled:bg-[#D5DAE2]"
        >
          저장
        </button>
      )}
    </span>
  );
}
