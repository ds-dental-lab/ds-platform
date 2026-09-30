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
import { PRICE_GROUPS, formatWon, groupRows, type PriceGroup, type PriceRow } from '@/server/domain/price-sheet';
import PriceSheetTabs from '@/components/contact/PriceSheetTabs';

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

  const year = String(new Date().getFullYear());
  const groups = groupRows(rows.filter((r) => r.item.trim() && r.price > 0));

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
      <PriceSheetTabs />

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
              placeholder="맨 아래에 덧붙일 한 줄 (비우면 안 나옵니다)"
              aria-label="안내 문구"
              className="h-8 flex-1 rounded-md border border-[#DDE2EA] px-2.5 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* ---------- 종이 — **메일로 나가는 수가표와 같은 양식** (사용자 요청 2026-09-30) ----------
            mail/price-sheet-mail 과 같은 색·같은 세 묶음·같은 보증 띠입니다.
            메일은 표로만 그려야 해서(메일 프로그램이 CSS 를 절반만 읽음) 거기 값들을
            여기서 그대로 씁니다 — 색을 바꾸려면 두 곳을 같이 바꿔야 합니다. */}
      <div className="work-order-sheet rounded-lg border border-[#E8EBF0] bg-white px-9 py-8 text-[#16324F] print:border-0">
        <header className="flex items-end justify-between gap-6 border-b-[3px] border-[#16324F] pb-4">
          <h1 className="text-[30px] font-extrabold tracking-[-0.5px]">수가표</h1>
          <div className="text-right">
            <p className="text-[13px] font-bold tracking-[1px]">{company.name}</p>
            <p className="mt-1.5 text-[12px] text-[#5B7186]">Price List · {year} · 단위: ₩ / ea</p>
          </div>
        </header>

        {clinic.trim() && (
          <p className="mt-6 text-[15px] leading-relaxed">
            <b>{clinic.trim()}</b> 원장님, 안녕하세요.
            <br />
            문의해 주신 수가표를 보내 드립니다.
          </p>
        )}

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-[#E3E9EF] p-3 text-left text-[12px] font-normal tracking-[1px] text-[#5B7186]">
                대분류
              </th>
              <th className="border-b border-[#E3E9EF] p-3 text-left text-[12px] font-normal tracking-[1px] text-[#5B7186]">
                상세분류
              </th>
              <th className="border-b border-[#E3E9EF] p-3 text-right text-[12px] font-normal tracking-[1px] text-[#5B7186]">
                공급가
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ group, rows: items }) =>
              items.map((row, i) => (
                <tr key={`${group}-${row.item}-${i}`}>
                  {i === 0 && (
                    <td
                      rowSpan={items.length}
                      className="whitespace-nowrap border-l-4 border-t border-l-[#14B8A6] border-t-[#E3E9EF] p-3 align-middle text-[16px] font-bold"
                    >
                      {group}
                    </td>
                  )}
                  <td className="border-t border-[#E3E9EF] p-3 text-[15px] text-[#2A4460]">{row.item}</td>
                  <td className="whitespace-nowrap border-t border-[#E3E9EF] p-3 text-right text-[16px] font-bold tabular-nums">
                    {formatWon(row.price)}
                    <span className="ml-[3px] text-[12px] font-normal text-[#5B7186]">원</span>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>

        {/* ★ 메일과 같은 보증 띠 — 약관 제15조(배송일부터 1년)와 같은 말입니다 */}
        <div className="mt-5 rounded-[12px] border border-[#D3EEE9] bg-[#F0F9F7] px-5 py-4 text-[14px]">
          <b>리메이크 1년 무상 보증</b>
          <span className="ml-2 text-[13px] text-[#5B7186]">
            제작일로부터 1년 이내 무상 리메이크를 지원합니다.
          </span>
        </div>

        <p className="mt-6 border-t border-[#E3E9EF] pt-4 text-[13px] leading-[1.7] text-[#5B7186]">
          {company.name} · Tel. {company.tel} · {company.address}
          <br />
          주문은 <b className="font-bold text-[#14B8A6]">denflow.kr</b> 에서 회원가입 후 바로 넣으실 수 있습니다.
          {note.trim() && (
            <>
              <br />
              {note.trim()}
            </>
          )}
        </p>
      </div>

      <div className="pb-10 print:hidden" />
    </div>
  );
}
