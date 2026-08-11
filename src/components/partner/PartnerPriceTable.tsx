// =========================================================
// 놓을 위치: src/components/partner/PartnerPriceTable.tsx
//
// 거래처별 단가. (사용자탭 > 거래처 > 단가)
//   치과   판매가   — 이 치과에 청구할 값
//   기공소 기공원가 — 이 기공소에 지급할 값 (설계서 §8.5, 치과엔 안 보임)
//
// ★ 칸을 비우면 제품 기본가를 씁니다.
//   0 을 넣으면 '이 거래처에는 무료' 입니다 — 둘은 다릅니다.
//   그래서 비운 칸에는 기본가를 흐리게 겹쳐 보여 줍니다.
//
// ★ 폰틱·핑크가 안 되는 제품은 칸 자체를 열지 않습니다.
//   값을 담아 두면 나중에 그 제품이 폰틱을 켜는 순간 살아납니다.
//
// ★ 저장은 한 번에 합니다.
//   제품이 수십 줄인데 칸마다 저장하면 실수로 반만 바뀐 상태가 남습니다.
// =========================================================

'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitSavePartnerPrices, type PriceEdit } from '@/server/actions/partner';
import {
  parseAmount,
  formatAmount,
  isPriceable,
  type PriceField,
} from '@/server/domain/pricing';
import type { PartnerPriceRow, PartnerRow } from '@/server/repositories/partner';

type Draft = Record<PriceField, string>;

const FIELDS: { key: PriceField; label: string }[] = [
  { key: 'price', label: '' }, // 머리글은 거래처 종류에 따라 갈립니다
  { key: 'ponticPrice', label: 'Pontic' },
  { key: 'pinkPrice', label: '핑크 포셀린' },
];

export interface PartnerPriceTableProps {
  partner: PartnerRow;
  rows: PartnerPriceRow[];
}

export default function PartnerPriceTable({ partner, rows }: PartnerPriceTableProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const isClinic = partner.orgType === 'clinic';
  const mainLabel = isClinic ? '판매 가격' : '기공 원가';

  const initial = useMemo(() => buildDrafts(rows), [rows]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(initial);

  const dirty = useMemo(
    () =>
      rows.filter((row) =>
        FIELDS.some((f) => drafts[row.materialId]?.[f.key] !== initial[row.materialId]?.[f.key]),
      ),
    [rows, drafts, initial],
  );

  const busy = saving || refreshing;

  function change(materialId: string, field: PriceField, value: string) {
    setSaved(false);
    setDrafts((prev) => ({
      ...prev,
      [materialId]: { ...prev[materialId], [field]: value.replace(/[^\d]/g, '') },
    }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);

    const edits: PriceEdit[] = [];

    for (const row of dirty) {
      const draft = drafts[row.materialId];
      const values: Record<PriceField, number | null> = {
        price: null,
        ponticPrice: null,
        pinkPrice: null,
      };

      for (const { key } of FIELDS) {
        const parsed = parseAmount(draft[key]);

        if (!parsed.ok) {
          setSaving(false);
          setError(`${row.typeName} / ${row.materialName} 의 금액을 읽을 수 없습니다`);
          return;
        }

        values[key] = parsed.value;
      }

      edits.push({ materialId: row.materialId, ...values });
    }

    const result = await submitSavePartnerPrices(partner.id, edits);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    startTransition(() => router.refresh());
  }

  function handleReset() {
    setDrafts(initial);
    setError('');
    setSaved(false);
  }

  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white">
      {/* ---------- 머리줄 ---------- */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <Link
          href="/design/users"
          className="grid h-9 w-9 place-items-center rounded-md text-[#98A2B3] hover:bg-[#F4F6F9]"
          aria-label="거래처 목록으로"
        >
          ←
        </Link>

        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-[#1A2130]">
            {partner.name}
            <span
              className={
                'ml-2 rounded px-2 py-0.5 align-middle text-[11.5px] font-bold ' +
                (isClinic ? 'bg-[#EDF3FE] text-[#1B63E8]' : 'bg-[#E6F4EE] text-[#12855B]')
              }
            >
              {isClinic ? '치과' : '기공소'}
            </span>
          </h2>
          <p className="mt-0.5 text-[12px] text-[#98A2B3]">
            {isClinic
              ? '이 치과에 청구할 값입니다. 비우면 제품 기본가를 씁니다'
              : '이 기공소에 지급할 값입니다. 치과에는 보이지 않습니다'}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {saved && dirty.length === 0 && (
            <span className="text-[12.5px] font-semibold text-[#12855B]">저장했습니다</span>
          )}

          <button
            type="button"
            onClick={handleReset}
            disabled={busy || dirty.length === 0}
            className="h-9 rounded-md border border-[#DDE2EA] px-4 text-[13px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9] disabled:opacity-50"
          >
            되돌리기
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={busy || dirty.length === 0}
            className="h-9 rounded-md bg-[#5546C8] px-5 text-[13px] font-bold text-white hover:bg-[#4536B8] disabled:opacity-50"
          >
            {saving ? '저장 중…' : dirty.length > 0 ? `저장 (${dirty.length})` : '저장'}
          </button>
        </div>
      </div>

      {error && <p className="px-5 pb-2 text-[12.5px] text-[#D8453F]">{error}</p>}

      {/* ---------- 표 ---------- */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-y border-[#E8EBF0] text-[12.5px] text-[#4A5567]">
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold">보철물 종류</th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-semibold">재료</th>
              <th className="whitespace-nowrap px-3 py-3 text-center font-semibold">{mainLabel}</th>
              <th className="whitespace-nowrap px-3 py-3 text-center font-semibold">Pontic</th>
              <th className="whitespace-nowrap px-3 py-3 text-center font-semibold">핑크 포셀린</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-[13px] text-[#98A2B3]">
                  등록된 제품이 없습니다. 제품탭에서 먼저 만들어 주세요.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.materialId}
                  className={
                    'border-b border-[#F0F2F5] text-[13px] ' + (row.isActive ? '' : 'opacity-55')
                  }
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <b className="font-bold text-[#1A2130]">{row.typeName}</b>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="text-[#5546C8]">{row.materialName}</span>
                    {!row.isActive && (
                      <span className="ml-1.5 text-[11px] text-[#98A2B3]">(판매중지)</span>
                    )}
                  </td>

                  {FIELDS.map(({ key }) => (
                    <td key={key} className="px-3 py-2.5 text-center">
                      {isPriceable(row, key) ? (
                        <Cell
                          value={drafts[row.materialId]?.[key] ?? ''}
                          base={row.base[key]}
                          onChange={(v) => change(row.materialId, key, v)}
                        />
                      ) : (
                        <span className="text-[#C4CBD6]">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t border-[#E8EBF0] px-5 py-3 text-[12px] text-[#98A2B3]">
        비워 두면 제품 기본가(흐린 숫자)를 씁니다. <b className="font-semibold">0</b> 을 넣으면 이
        거래처에는 무료입니다.
      </p>
    </div>
  );
}

// ---------- 조각들 ----------

function buildDrafts(rows: PartnerPriceRow[]): Record<string, Draft> {
  const out: Record<string, Draft> = {};

  for (const row of rows) {
    out[row.materialId] = {
      price: text(row.override?.price ?? null),
      ponticPrice: text(row.override?.ponticPrice ?? null),
      pinkPrice: text(row.override?.pinkPrice ?? null),
    };
  }

  return out;
}

/** null 은 빈 칸입니다. 0 은 '0' 으로 남습니다 */
function text(value: number | null): string {
  return value === null ? '' : String(value);
}

/**
 * 값 칸. 비어 있으면 기본가를 자리표시로 흐리게 보여 줍니다.
 *
 * ★ 자리표시로 두는 이유 — 기본가를 진짜 값처럼 채워 넣으면
 *   저장할 때 '이 거래처 전용 값' 으로 굳어 버립니다.
 *   나중에 기본가를 올려도 이 거래처만 옛날 값에 묶입니다.
 */
function Cell({
  value,
  base,
  onChange,
}: {
  value: string;
  base: number | null;
  onChange: (v: string) => void;
}) {
  const overridden = value !== '';

  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="numeric"
      placeholder={formatAmount(base)}
      title={base === null ? '제품 기본가가 아직 없습니다' : `기본가 ${formatAmount(base)}원`}
      className={
        'h-9 w-[110px] rounded-md border px-2.5 text-right text-[13px] tabular-nums outline-none focus:border-[#5546C8] ' +
        (overridden
          ? 'border-[#5546C8] bg-[#F8F7FE] font-semibold text-[#1A2130]'
          : 'border-[#DDE2EA] text-[#4A5567] placeholder:text-[#C4CBD6]')
      }
    />
  );
}
