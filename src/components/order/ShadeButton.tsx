// =========================================================
// 놓을 위치: src/components/order/ShadeButton.tsx
//
// 보철선택 오른쪽의 쉐이드 미리보기 버튼. (시안 .shade)
//   치아 모양에 위(치경부)·아래(절단부) 색이 나뉘어 보입니다.
//   누르면 ShadeDialog 가 열립니다.
// =========================================================

'use client';

import { useState } from 'react';
import ShadeDialog, { shadeTint } from '@/components/order/ShadeDialog';
import {
  SHADE_SYSTEMS,
  formatShade,
  type ToothShade,
  type ShadeSystemCode,
} from '@/server/domain/shade';

export interface ShadeButtonProps {
  system: ShadeSystemCode;
  shade: ToothShade;
  onChange: (system: ShadeSystemCode, shade: ToothShade) => void;
  /**
   * 밖에서 열고 닫고 싶을 때. (주문등록이 치식을 먼저 누른 경우 여기를 씁니다)
   * 주지 않으면 버튼이 스스로 여닫습니다.
   */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

export default function ShadeButton({
  system,
  shade,
  onChange,
  open: openProp,
  onOpenChange,
}: ShadeButtonProps) {
  const [openSelf, setOpenSelf] = useState(false);

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openSelf;

  function setOpen(next: boolean) {
    if (!controlled) setOpenSelf(next);
    onOpenChange?.(next);
  }

  const systemName = SHADE_SYSTEMS.find((s) => s.code === system)?.name ?? '';
  const picked = formatShade(shade);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Shade 선택"
        className="flex shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1 hover:bg-[#F4F6F9]"
      >
        <svg width="56" height="76" viewBox="0 0 110 150" aria-hidden="true">
          <clipPath id="shadeMiniClip">
            <path d="M14 26C14 13 30 6 55 6s41 7 41 20c0 34-5 76-14 98-5 12-16 18-27 18s-22-6-27-18C19 102 14 60 14 26Z" />
          </clipPath>
          <g clipPath="url(#shadeMiniClip)">
            <rect x="0" y="0" width="110" height="80" fill={shadeTint(shade.cervical)} />
            <rect x="0" y="80" width="110" height="70" fill={shadeTint(shade.incisal)} />
          </g>
          <path
            d="M14 26C14 13 30 6 55 6s41 7 41 20c0 34-5 76-14 98-5 12-16 18-27 18s-22-6-27-18C19 102 14 60 14 26Z"
            fill="none"
            stroke="#8E99AB"
            strokeWidth="3"
          />
          <path d="M18 80h74" stroke="#8E99AB" strokeWidth="2" strokeDasharray="6 5" />
          <text x="55" y="52" textAnchor="middle" fontSize="20" fill="#6B5B45">
            {shade.cervical ?? ''}
          </text>
          <text x="55" y="118" textAnchor="middle" fontSize="20" fill="#6B5B45">
            {shade.incisal ?? ''}
          </text>
        </svg>

        <span className="whitespace-nowrap text-[12.5px] font-semibold text-[#1B63E8]">
          {picked ? `${systemName} · ${picked}` : systemName}
        </span>
      </button>

      {open && (
        <ShadeDialog
          system={system}
          shade={shade}
          onApply={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
