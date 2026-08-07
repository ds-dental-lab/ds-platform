// =========================================================
// 놓을 위치: src/components/dental/ProsthesisSummary/index.tsx
//
// 선택한 보철 요약 카드. (기능명세서 §4.2.5, §4.2.7)
//   Zir-Cr | 42, X, 31 (A3)
//   중복 등록된 치아는 두 줄로 나뉩니다.
//   초기화는 선택이 있으면 빨간색으로 강조되고 확인창을 거칩니다.
// =========================================================

'use client';// =========================================================
// 놓을 위치: src/components/dental/ProsthesisSummary/index.tsx
//
// 선택한 보철 요약 카드. (기능명세서 §4.2.5, §4.2.7)
//   Zir-Cr | 42, X, 31 (A3)
//   중복 등록된 치아는 두 줄로 나뉩니다.
//   초기화는 선택이 있으면 빨간색으로 강조되고 확인창을 거칩니다.
// =========================================================

'use client';

import { useState } from 'react';
import {
  buildSummaryLines,
  shouldHighlightReset,
  countTeeth,
  type SummaryLine,
} from '@/server/domain/summary';
import type { ToothPlacement } from '@/server/domain/bridge';
import type { ToothShade } from '@/server/domain/shade';
import type { ImplantSelection } from '@/server/domain/implant';

const TYPE_COLOR: Record<string, string> = {
  crown: 'border-l-blue-500',
  inlay: 'border-l-green-500',
  implant: 'border-l-amber-500',
};

export interface ProsthesisSummaryProps {
  placements: ToothPlacement[];
  shades?: Record<number, ToothShade>;
  implants?: Record<number, ImplantSelection>;
  onRemoveLine?: (line: SummaryLine) => void;
  onReset?: () => void;
}

export default function ProsthesisSummary({
  placements,
  shades = {},
  implants = {},
  onRemoveLine,
  onReset,
}: ProsthesisSummaryProps) {
  const [confirming, setConfirming] = useState(false);

  const lines = buildSummaryLines({ placements, shades, implants });
  const highlight = shouldHighlightReset(placements);

  function handleReset() {
    onReset?.();
    setConfirming(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* ---------- 머리 ---------- */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-bold text-gray-900">
          선택한 보철물
          {placements.length > 0 && (
            <span className="ml-2 font-normal text-gray-400">
              치아 {countTeeth(placements)}개 · {lines.length}건
            </span>
          )}
        </h2>

        <button
          onClick={() => setConfirming(true)}
          disabled={!highlight}
          className={`rounded border px-3 py-1.5 text-[13px] transition-colors ${
            highlight
              ? 'border-red-500 font-semibold text-red-600 hover:bg-red-50'
              : 'cursor-not-allowed border-gray-200 text-gray-300'
          }`}
        >
          초기화
        </button>
      </div>

      {/* ---------- 줄 목록 ---------- */}
      {lines.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          치식도에서 치아를 선택하세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lines.map((line) => (
            <li
              key={line.key}
              className={`flex items-start gap-3 border-l-4 px-5 py-3 ${
                TYPE_COLOR[line.typeCode] ?? 'border-l-gray-300'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] text-gray-900">
                  <b className="font-semibold">{line.abbr}</b>
                  <span className="mx-2 text-gray-300">|</span>
                  {line.teethLabel}
                  {line.shadeLabel && (
                    <span className="ml-2 text-gray-500">({line.shadeLabel})</span>
                  )}
                </p>

                {line.implantLabel && (
                  <p className="mt-1 text-[12px] text-gray-500">{line.implantLabel}</p>
                )}
              </div>

              {onRemoveLine && (
                <button
                  onClick={() => onRemoveLine(line)}
                  aria-label={`${line.abbr} 삭제`}
                  className="shrink-0 text-lg leading-none text-gray-300 hover:text-red-500"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ---------- 확인창 ---------- */}
      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-base font-bold">전체 초기화</h3>
            <p className="mt-2 text-sm text-gray-600">
              선택한 보철물 {lines.length}건이 모두 지워집니다. 되돌릴 수 없습니다.
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


import { useState } from 'react';
import {
  buildSummaryLines,
  shouldHighlightReset,
  countTeeth,
  type SummaryLine,
} from '@/server/domain/summary';
import type { ToothPlacement } from '@/server/domain/bridge';
import type { ToothShade } from '@/server/domain/shade';
import type { ImplantSelection } from '@/server/domain/implant';

const TYPE_COLOR: Record<string, string> = {
  crown: 'border-l-blue-500',
  inlay: 'border-l-green-500',
  implant: 'border-l-amber-500',
};

export interface ProsthesisSummaryProps {
  placements: ToothPlacement[];
  shades?: Record<number, ToothShade>;
  implants?: Record<number, ImplantSelection>;
  onRemoveLine?: (line: SummaryLine) => void;
  onReset?: () => void;
}

export default function ProsthesisSummary({
  placements,
  shades = {},
  implants = {},
  onRemoveLine,
  onReset,
}: ProsthesisSummaryProps) {
  const [confirming, setConfirming] = useState(false);

  const lines = buildSummaryLines({ placements, shades, implants });
  const highlight = shouldHighlightReset(placements);

  function handleReset() {
    onReset?.();
    setConfirming(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* ---------- 머리 ---------- */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-bold text-gray-900">
          선택한 보철물
          {placements.length > 0 && (
            <span className="ml-2 font-normal text-gray-400">
              치아 {countTeeth(placements)}개 · {lines.length}건
            </span>
          )}
        </h2>

        <button
          onClick={() => setConfirming(true)}
          disabled={!highlight}
          className={`rounded border px-3 py-1.5 text-[13px] transition-colors ${
            highlight
              ? 'border-red-500 font-semibold text-red-600 hover:bg-red-50'
              : 'cursor-not-allowed border-gray-200 text-gray-300'
          }`}
        >
          초기화
        </button>
      </div>

      {/* ---------- 줄 목록 ---------- */}
      {lines.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          치식도에서 치아를 선택하세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lines.map((line) => (
            <li
              key={line.key}
              className={`flex items-start gap-3 border-l-4 px-5 py-3 ${
                TYPE_COLOR[line.typeCode] ?? 'border-l-gray-300'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] text-gray-900">
                  <b className="font-semibold">{line.abbr}</b>
                  <span className="mx-2 text-gray-300">|</span>
                  {line.teethLabel}
                  {line.shadeLabel && (
                    <span className="ml-2 text-gray-500">({line.shadeLabel})</span>
                  )}
                </p>

                {line.implantLabel && (
                  <p className="mt-1 text-[12px] text-gray-500">{line.implantLabel}</p>
                )}
              </div>

              {onRemoveLine && (
                <button
                  onClick={() => onRemoveLine(line)}
                  aria-label={`${line.abbr} 삭제`}
                  className="shrink-0 text-lg leading-none text-gray-300 hover:text-red-500"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ---------- 확인창 ---------- */}
      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-base font-bold">전체 초기화</h3>
            <p className="mt-2 text-sm text-gray-600">
              선택한 보철물 {lines.length}건이 모두 지워집니다. 되돌릴 수 없습니다.
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
