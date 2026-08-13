// =========================================================
// 놓을 위치: src/components/dental/ShadePicker/index.tsx
//
// 쉐이드 선택. (기능명세서 §4.2.3)
//   체계 3종을 왼쪽에서 고르고, 색조를 그리드에서 고릅니다.
//   빈 치아면 전체 적용, 이미 색이 있으면 치아 그림의 위/아래를 눌러
//   치경부 · 절단부에 나눠 넣습니다.
// =========================================================

'use client';

import { useState } from 'react';
import {
  SHADE_SYSTEMS,
  getShades,
  applyShade,
  applyToPart,
  isEmpty,
  isSplit,
  isActive,
  formatShade,
  EMPTY_SHADE,
  type ToothShade,
  type ShadeSystemCode,
} from '@/server/domain/shade';

export interface ShadePickerProps {
  value?: ToothShade;
  onChange?: (shade: ToothShade) => void;
  onClose?: () => void;
}

export default function ShadePicker({
  value = EMPTY_SHADE,
  onChange,
  onClose,
}: ShadePickerProps) {
  const [systemCode, setSystemCode] = useState<ShadeSystemCode>('vita_classic');
  const [active, setActive] = useState<string | null>(null);
  const [shade, setShade] = useState<ToothShade>(value);

  const shades = getShades(systemCode);

  /**
   * 색조를 누르면 — 비어 있으면 전체에 적용, 아니면 대기 상태로 둡니다.
   * 활성 표시는 항상 마지막에 누른 하나에만 켜집니다.
   */
  function handleShadeClick(code: string) {
    setActive(code);

    const next = applyShade(shade, code);
    if (next !== shade) {
      setShade(next);
      onChange?.(next);
    }
  }

  /** 치아 그림의 위 또는 아래를 누르면 그 부위에만 적용됩니다 */
  function handlePartClick(part: 'cervical' | 'incisal') {
    if (!active) return;
    const next = applyToPart(shade, active, part);
    setShade(next);
    onChange?.(next);
  }

  function handleClear() {
    setShade(EMPTY_SHADE);
    setActive(null);
    onChange?.(EMPTY_SHADE);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* ---------- 머리 ---------- */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold">쉐이드</h2>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-xl leading-none text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-8">
        {/* ---------- 체계 ---------- */}
        <div className="flex w-36 shrink-0 flex-col gap-3 pt-1 text-right">
          {SHADE_SYSTEMS.map((system) => (
            <button
              key={system.code}
              onClick={() => {
                setSystemCode(system.code);
                setActive(null);
              }}
              className={
                systemCode === system.code
                  ? 'text-[15px] font-bold text-gray-900'
                  : 'text-[15px] text-gray-400 hover:text-gray-600'
              }
            >
              {system.name}
            </button>
          ))}
        </div>

        {/* ---------- 색조 그리드 ---------- */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {shades.map((code) => (
              <button
                key={code}
                onClick={() => handleShadeClick(code)}
                className={`h-9 min-w-[46px] rounded border px-2 text-[14px] transition-colors ${
                  isActive(active, code)
                    ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {!isEmpty(shade) && active && (
            <p className="mt-4 text-[14px] text-gray-500">
              치아 그림의 위쪽을 누르면 치경부, 아래쪽을 누르면 절단부에
              <b className="text-gray-800"> {active}</b> 가 적용됩니다.
            </p>
          )}
        </div>

        {/* ---------- 치아 미리보기 ---------- */}
        <div className="shrink-0">
          <ToothPreview shade={shade} onPartClick={handlePartClick} />
          <p className="mt-2 text-center text-[14px] font-semibold text-gray-700">
            {formatShade(shade) || '선택 없음'}
          </p>
        </div>
      </div>

      {/* ---------- 발 ---------- */}
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={handleClear}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          지우기
        </button>
        <button
          onClick={onClose}
          className="rounded bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          확인
        </button>
      </div>
    </div>
  );
}

// ---------- 치아 미리보기 ----------
// 위쪽이 치경부, 아래쪽이 절단부입니다. 점선이 경계입니다.

function ToothPreview({
  shade,
  onPartClick,
}: {
  shade: ToothShade;
  onPartClick: (part: 'cervical' | 'incisal') => void;
}) {
  const OUTLINE =
    'M 20 34 C 20 12 38 4 62 4 C 86 4 104 12 104 34 C 104 74 92 108 62 116 C 32 108 20 74 20 34 Z';

  return (
    <svg width={124} height={122} viewBox="0 0 124 122" role="group" aria-label="쉐이드 미리보기">
      <defs>
        <clipPath id="tooth-outline">
          <path d={OUTLINE} />
        </clipPath>
      </defs>

      <g clipPath="url(#tooth-outline)">
        {/* 치경부 — 위 */}
        <rect
          x={0}
          y={0}
          width={124}
          height={60}
          fill={shade.cervical ? '#DBEAFE' : '#FFFFFF'}
          className="cursor-pointer"
          onClick={() => onPartClick('cervical')}
        />
        {/* 절단부 — 아래 */}
        <rect
          x={0}
          y={60}
          width={124}
          height={62}
          fill={shade.incisal ? '#EFF6FF' : '#FFFFFF'}
          className="cursor-pointer"
          onClick={() => onPartClick('incisal')}
        />
      </g>

      <path d={OUTLINE} fill="none" stroke="#1279E8" strokeWidth={1.6} />

      {/* 이분할이면 경계선을 진하게 */}
      <line
        x1={22}
        y1={60}
        x2={102}
        y2={60}
        stroke={isSplit(shade) ? '#1279E8' : '#9BC4F2'}
        strokeWidth={isSplit(shade) ? 1.6 : 1}
        strokeDasharray="4 3"
      />

      {shade.cervical && (
        <text x={62} y={38} textAnchor="middle" fontSize={13} fontWeight={600} fill="#0F4C96">
          {shade.cervical}
        </text>
      )}
      {shade.incisal && (
        <text x={62} y={92} textAnchor="middle" fontSize={13} fontWeight={600} fill="#0F4C96">
          {shade.incisal}
        </text>
      )}
    </svg>
  );
}
