// =========================================================
// 놓을 위치: src/components/dental/ProsthesisSummary/index.tsx
//
// 제작보철 — 지금까지 찍은 것을 종류·재료별로 묶어 보여 줍니다.
//
// 한 줄이 하나의 제작 단위입니다. 같은 종류·재료끼리 묶여
// '17, X, 15' 처럼 치식이 한 줄에 붙습니다 (X 는 폰틱).
//
// ★ 줄을 흰 알약으로 세웁니다.
//   목록형 표에 넣으면 주변 카드에 묻혀 '무엇을 만들 것인가' 가
//   눈에 안 들어옵니다. 옅은 파란 바탕 위에 흰 알약을 띄워 분리합니다.
// =========================================================

'use client';

import { useState } from 'react';
import {
  buildSummaryLines,
  shouldHighlightReset,
  countTeeth,
  type SummaryLine,
} from '@/server/domain/summary';
import {
  colorOfType,
  FALLBACK_TYPES,
  type ProsthesisCatalog,
} from '@/server/domain/prosthesis';
import type { ToothPlacement } from '@/server/domain/bridge';
import type { ToothShade } from '@/server/domain/shade';
import type { ImplantCatalog, ImplantSelection } from '@/server/domain/implant';

export interface ProsthesisSummaryProps {
  placements: ToothPlacement[];
  shades?: Record<number, ToothShade>;
  implants?: Record<number, ImplantSelection>;
  implantCatalog?: ImplantCatalog;
  onRemoveLine?: (line: SummaryLine) => void;
  onReset?: () => void;
  readOnly?: boolean;
  title?: string;
  catalog?: ProsthesisCatalog;
}

export default function ProsthesisSummary({
  placements,
  shades = {},
  implants = {},
  implantCatalog = [],
  onRemoveLine,
  onReset,
  readOnly = false,
  title = '제작보철',
  catalog = FALLBACK_TYPES,
}: ProsthesisSummaryProps) {
  const [confirming, setConfirming] = useState(false);

  const lines = buildSummaryLines({ placements, shades, implants, implantCatalog });
  const highlight = shouldHighlightReset(placements);
  const hasPontic = placements.some((p) => p.isPontic);

  function handleReset() {
    onReset?.();
    setConfirming(false);
  }

  return (
    <div className="rounded-lg border border-[#DCE8F8] bg-[#F2F7FE] px-4 pb-4 pt-3.5">
      {/* ---------- 머리 ---------- */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[#1279E8]" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1.8 2.6h2.1l1.9 8.8h8.4l1.6-6.2H5.2" />
            <circle cx="7.6" cy="15.6" r="1.4" />
            <circle cx="13.6" cy="15.6" r="1.4" />
          </svg>
        </span>

        <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">{title}</h2>

        {placements.length > 0 && (
          <span className="text-[12px] text-[#98A2B3]">
            치아 {countTeeth(placements)}개 · {lines.length}건
          </span>
        )}

        {/* X 가 무슨 뜻인지 늘 붙여 둡니다 */}
        {hasPontic && (
          <span className="ml-auto text-[12px] text-[#8E98A8]">
            <b className="font-semibold text-[#4A5567]">✕</b> Pontic
          </span>
        )}

        {!readOnly && (
          <button
            onClick={() => setConfirming(true)}
            disabled={!highlight}
            className={
              (hasPontic ? 'ml-3 ' : 'ml-auto ') +
              (highlight
                ? 'rounded border border-[#D8453F] px-3 py-1 text-[12.5px] font-semibold text-[#D8453F] hover:bg-[#FDE7E7]'
                : 'cursor-not-allowed rounded border border-[#E8EBF0] px-3 py-1 text-[12.5px] text-[#C4CBD6]')
            }
          >
            초기화
          </button>
        )}
      </div>

      {/* ---------- 줄 ---------- */}
      {lines.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[#98A2B3]">
          치식도에서 치아를 선택하세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line) => {
            const color = colorOfType(catalog, line.typeCode);

            return (
              <li
                key={line.key}
                className="flex items-center gap-3 rounded-full bg-white py-2.5 pl-5 pr-4"
                style={{ border: `1.5px solid ${color.line}` }}
              >
                <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,150px)_1fr] items-baseline gap-3">
                  <b
                    className="truncate text-[13.5px] font-bold tracking-tight"
                    style={{ color: color.line }}
                  >
                    {line.abbr}
                  </b>

                  <span className="min-w-0 text-[13.5px] text-[#1A2130]">
                    {line.teethLabel}
                    {line.shadeLabel && (
                      <span className="ml-1.5 text-[#4A5567]">({line.shadeLabel})</span>
                    )}
                    {line.implantLabel && (
                      <span className="ml-2 text-[12px] text-[#8E98A8]">
                        {line.implantLabel}
                      </span>
                    )}
                  </span>
                </div>

                {!readOnly && onRemoveLine && (
                  <button
                    onClick={() => onRemoveLine(line)}
                    aria-label={`${line.abbr} 삭제`}
                    className="shrink-0 text-[15px] leading-none text-[#C4CBD6] hover:text-[#D8453F]"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-base font-bold">전체 초기화</h3>
            <p className="mt-2 text-sm text-gray-600">
              제작보철 {lines.length}건이 모두 지워집니다. 되돌릴 수 없습니다.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                className="rounded bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
