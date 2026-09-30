'use client';

// =========================================================
// 놓을 위치: src/components/contact/PriceSheetEditor.tsx
//
// 상담용 수가표를 **직접 만들어 A4 로 뽑는** 화면 (사용자 요청 2026-09-29 —
// "원장님과 상담할 때 수가표 A4 용지로 뽑아가게").
//
// ★ 위쪽(고치는 줄)은 종이에 안 나옵니다. 종이에는 표와 안내만 나갑니다.
// ★ 값은 문의 메일로 보내는 수가표와 **같은 값**입니다 (organizations.price_sheet).
//   여기서 '기본값으로 저장' 을 누르면 문의 화면의 기본값도 같이 바뀝니다.
// ★ 치과 이름을 적으면 종이 머리에 '○○치과 귀중' 으로 찍힙니다 — 그 치과를 위해
//   만든 종이로 보입니다. 비워 두면 안 나옵니다.
// =========================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitSavePriceSheet } from '@/server/actions/price-sheet';
import { PRICE_GROUPS, formatWon, type PriceGroup, type PriceRow } from '@/server/domain/price-sheet';

export interface PriceSheetEditorProps {
  rows: PriceRow[];
  /** 종이 머리에 찍을 회사 정보 */
  company: { name: string; tel: string; address: string };
  /** 관리자만 기본값을 바꿉니다 */
  canSave: boolean;
}

export default function PriceSheetEditor({ rows: initial, company, canSave }: PriceSheetEditorProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [rows, setRows] = useState<PriceRow[]>(initial);
  const [clinic, setClinic] = useState('');
  const [note, setNote] = useState('부가가치세 면세 대상이라 표의 금액이 곧 청구 금액입니다.');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  function change(index: number, patch: Partial<PriceRow>) {
    setSaved(false);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function save() {
    setError('');
    setSaving(true);
    const result = await submitSavePriceSheet(rows.filter((r) => r.item.trim() && r.price > 0));
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? '저장하지 못했습니다');
      return;
    }

    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[860px]">
      {/* ---------- 고치는 줄 (종이에는 안 나옵니다) ---------- */}
      <div className="mb-3 space-y-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={clinic}
            onChange={(e) => setClinic(e.target.value)}
            placeholder="치과 이름 (종이 머리에 찍힙니다. 비워도 됩니다)"
            className="h-9 min-w-[260px] flex-1 rounded-md border border-[#DDE2EA] px-3 text-[13.5px]"
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 rounded-md bg-[#1279E8] px-4 text-[13.5px] font-bold text-white hover:bg-[#0F68C9]"
          >
            인쇄 / PDF
          </button>
          {canSave && (
            <button
              type="button"
              onClick={save}
              disabled={saving || refreshing}
              className="h-9 rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9] disabled:text-[#C4CBD6]"
            >
              {saving ? '저장 중…' : '기본값으로 저장'}
            </button>
          )}
          {saved && <span className="text-[13px] font-semibold text-[#12855B]">저장했습니다</span>}
          {error && <span className="text-[13px] text-[#D8453F]">{error}</span>}
        </div>

        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <table className="w-full text-[13.5px]">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <select
                      value={row.group}
                      onChange={(e) => change(i, { group: e.target.value as PriceGroup })}
                      aria-label="분류"
                      className="h-8 rounded border border-[#DDE2EA] px-1.5"
                    >
                      {PRICE_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      value={row.item}
                      onChange={(e) => change(i, { item: e.target.value })}
                      placeholder="항목 이름"
                      aria-label="항목 이름"
                      className="h-8 w-full rounded border border-[#DDE2EA] px-2"
                    />
                  </td>
                  <td className="w-[130px] py-1 pr-2">
                    <input
                      value={row.price ? String(row.price) : ''}
                      onChange={(e) => change(i, { price: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label="금액"
                      className="h-8 w-full rounded border border-[#DDE2EA] px-2 text-right tabular-nums"
                    />
                  </td>
                  <td className="w-[30px] py-1 text-right">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}
                      aria-label={`${row.item || '줄'} 지우기`}
                      className="grid h-6 w-6 place-items-center rounded text-[#C4CBD6] hover:bg-[#FDECEA] hover:text-[#D8453F]"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { group: 'Crown', item: '', price: 0 }])}
              className="h-8 shrink-0 rounded-md border border-[#DDE2EA] px-3 text-[13px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
            >
              줄 추가
            </button>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="종이 아래에 적을 안내 (비우면 안 나옵니다)"
              aria-label="안내 문구"
              className="h-8 flex-1 rounded-md border border-[#DDE2EA] px-2.5 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* ---------- 종이 (기공의뢰서와 같은 A4 규칙) ---------- */}
      <div className="work-order-sheet rounded-lg border border-[#E8EBF0] bg-white px-10 py-9 text-[#111827] print:border-0">
        <header className="mb-7 border-b-2 border-[#111827] pb-3">
          <h1 className="text-center text-[27px] font-extrabold tracking-[-0.03em]">수 가 표</h1>
        </header>

        <div className="mb-5 flex items-end justify-between gap-6 text-[13.5px]">
          <div>
            {clinic.trim() && <p className="text-[16px] font-bold">{clinic.trim()} 귀중</p>}
            <p className="mt-1 text-[#4A5567]">{today} 기준</p>
          </div>
          <div className="text-right leading-relaxed text-[#4A5567]">
            <p className="text-[15px] font-bold text-[#111827]">{company.name}</p>
            <p>{company.tel}</p>
            <p>{company.address}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-y border-[#111827]">
              <th className="w-[22%] px-3 py-2.5 text-left font-bold">분류</th>
              <th className="px-3 py-2.5 text-left font-bold">항목</th>
              <th className="w-[26%] px-3 py-2.5 text-right font-bold">금액 (원)</th>
            </tr>
          </thead>
          <tbody>
            {PRICE_GROUPS.flatMap((group) => {
              const items = rows.filter((r) => r.group === group && r.item.trim() && r.price > 0);

              return items.map((row, i) => (
                <tr key={`${group}-${row.item}-${i}`} className="border-b border-[#E5E7EB]">
                  <td className="px-3 py-2.5 font-semibold">{i === 0 ? group : ''}</td>
                  <td className="px-3 py-2.5">{row.item}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatWon(row.price)}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>

        {note.trim() && (
          <p className="mt-6 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#4A5567]">※ {note.trim()}</p>
        )}
      </div>

      <div className="pb-10 print:hidden" />
    </div>
  );
}
