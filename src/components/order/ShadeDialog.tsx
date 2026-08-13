// =========================================================
// 놓을 위치: src/components/order/ShadeDialog.tsx
//
// 쉐이드 선택 팝업. (기능명세서 §4.2.3, 사용자가 준 화면)
//
// 배치 — 왼쪽에 체계 이름 셋, 가운데 색표, 오른쪽에 치아 미리보기.
//   확인은 오른쪽 아래 하나뿐입니다.
//
// ★ 색표는 체계마다 생김새가 다릅니다.
//   3D Master 는 1M~5M 묶음 안에서 L·M·R 로 갈리고,
//   Ivoclar 는 계열마다 있는 번호가 달라 자리가 빕니다.
//   실제 색표와 자리가 같아야 원장이 눈으로 찾습니다 —
//   배치는 domain/shade 의 getShadeLayout 이 정합니다.
//
// ★ 첫 클릭은 치아 전체에 적용됩니다 (§4.2.3).
//   그 다음부터는 색조를 누른 뒤 미리보기의 위(치경부)·아래(절단부)를
//   눌러 그 부위에만 넣습니다.
// =========================================================

'use client';

import { useState } from 'react';
import {
  SHADE_SYSTEMS,
  getShadeLayout,
  EMPTY_SHADE,
  type ToothShade,
  type ShadeSystemCode,
} from '@/server/domain/shade';

/** 색조 코드에서 대략의 색을 만듭니다 — 미리보기용입니다 */
export function shadeTint(code: string | null): string {
  if (!code) return '#FFFFFF';

  const head = code[0]?.toUpperCase();
  const tint: Record<string, string> = {
    A: '#E9D9BC',
    B: '#EFE3C2',
    C: '#DED6C0',
    D: '#E4D8C3',
    '0': '#F2ECDC',
    '1': '#EFE6D0',
    '2': '#E9DCBE',
    '3': '#E2D3B2',
    '4': '#DBCAA6',
    '5': '#D4C19B',
  };
  return tint[head] ?? '#E9DDC6';
}

export interface ShadeDialogProps {
  system: ShadeSystemCode;
  shade: ToothShade;
  onApply: (system: ShadeSystemCode, shade: ToothShade) => void;
  onClose: () => void;
  /** 창 제목. 리메이크에서는 '45번 쉐이드 변경' 처럼 씁니다 */
  title?: string;
  /** 왼쪽 버튼 문구. 리메이크에서는 '그대로 두기' 입니다 */
  keepLabel?: string;
}

export default function ShadeDialog({
  system,
  shade,
  onApply,
  onClose,
  title = '쉐이드',
  keepLabel = '선택 해제',
}: ShadeDialogProps) {
  const [draftSystem, setDraftSystem] = useState<ShadeSystemCode>(system);
  const [draft, setDraft] = useState<ToothShade>(shade);

  /** 마지막에 누른 색조. 부위를 고를 때까지 대기합니다 */
  const [armed, setArmed] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const layout = getShadeLayout(draftSystem);
  const columns = Math.max(...layout.rows.map((r) => r.length), 1);
  const untouched = draft.cervical === null && draft.incisal === null;

  function pickShade(code: string) {
    setArmed(code);

    // ★ 첫 클릭은 치아 전체에 (§4.2.3)
    if (untouched) {
      setDraft({ cervical: code, incisal: code });
      setMessage('치아 전체에 넣었습니다. 위아래를 다르게 주려면 색조를 누른 뒤 치아의 부위를 클릭하세요.');
      return;
    }

    setMessage(`${code} 를 넣을 부위를 오른쪽 치아에서 눌러 주세요.`);
  }

  function applyTo(part: 'cervical' | 'incisal') {
    if (!armed) {
      setMessage('먼저 색조를 골라 주세요.');
      return;
    }

    setDraft((prev) => ({ ...prev, [part]: armed }));
    setMessage(`${part === 'cervical' ? '치경부' : '절단부'}에 ${armed} 를 넣었습니다.`);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
      <div className="flex max-h-[92vh] w-full max-w-[1040px] flex-col overflow-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-7 pb-1 pt-5">
          <h3 className="text-[17px] font-bold tracking-tight text-[#1A2130]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-7 w-7 place-items-center rounded text-[#98A2B3] hover:bg-[#F4F6F9]"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-7 px-7 py-4">
          {/* 왼쪽 — 체계 */}
          <div className="flex w-[130px] shrink-0 flex-col gap-3.5">
            {SHADE_SYSTEMS.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  setDraftSystem(s.code as ShadeSystemCode);
                  setDraft(EMPTY_SHADE);
                  setArmed(null);
                  setMessage('');
                }}
                className={
                  'text-right text-[14px] leading-none transition-colors ' +
                  (draftSystem === s.code
                    ? 'font-bold text-[#1A2130]'
                    : 'text-[#98A2B3] hover:text-[#4A5567]')
                }
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* 가운데 — 색표 */}
          <div className="min-w-0 flex-1">
            <div
              className="grid justify-center gap-x-1.5 gap-y-2"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 52px))` }}
            >
              {layout.rows.map((row, r) =>
                Array.from({ length: columns }, (_, c) => {
                  const cell = row[c] ?? null;

                  // 칸 자체가 없는 자리 — 아무것도 그리지 않습니다
                  if (cell === null) return <span key={`${r}-${c}`} />;

                  // 자리는 있으나 그 색이 없는 칸
                  if (cell === '') {
                    return (
                      <span
                        key={`${r}-${c}`}
                        aria-hidden="true"
                        className="h-8 rounded-md bg-[#F0F2F5]"
                      />
                    );
                  }

                  const on = armed === cell;

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => pickShade(cell)}
                      className={
                        'h-8 rounded-md border text-[13.5px] font-semibold transition-colors ' +
                        (on
                          ? 'border-[#1279E8] bg-[#1279E8] text-white'
                          : 'border-[#DDE2EA] bg-white text-[#4A5567] hover:border-[#1279E8] hover:text-[#1279E8]')
                      }
                    >
                      {cell}
                    </button>
                  );
                }),
              )}

              {/* 열 이름 — 3D Master 의 1M~5M */}
              {layout.columnLabels?.map((label, c) => (
                <span
                  key={`label-${c}`}
                  className="pt-1 text-center text-[14px] font-bold text-[#1A2130]"
                >
                  {label ?? ''}
                </span>
              ))}
            </div>
          </div>

          {/* 오른쪽 — 치아 미리보기 */}
          <div className="w-[130px] shrink-0">
            <svg
              width="122"
              height="150"
              viewBox="0 0 110 150"
              role="img"
              aria-label="쉐이드 미리보기"
            >
              <clipPath id="dlgClip">
                <path d="M14 26C14 13 30 6 55 6s41 7 41 20c0 34-5 76-14 98-5 12-16 18-27 18s-22-6-27-18C19 102 14 60 14 26Z" />
              </clipPath>

              <g clipPath="url(#dlgClip)">
                <rect
                  x="0"
                  y="0"
                  width="110"
                  height="80"
                  fill={shadeTint(draft.cervical)}
                  className="cursor-pointer"
                  onClick={() => applyTo('cervical')}
                />
                <rect
                  x="0"
                  y="80"
                  width="110"
                  height="70"
                  fill={shadeTint(draft.incisal)}
                  className="cursor-pointer"
                  onClick={() => applyTo('incisal')}
                />
              </g>

              <path
                d="M14 26C14 13 30 6 55 6s41 7 41 20c0 34-5 76-14 98-5 12-16 18-27 18s-22-6-27-18C19 102 14 60 14 26Z"
                fill="none"
                stroke="#1279E8"
                strokeWidth="2"
                pointerEvents="none"
              />
              <path
                d="M16 80h78"
                stroke="#4A5567"
                strokeWidth="2"
                strokeDasharray="7 5"
                pointerEvents="none"
              />

              <text
                x="55"
                y="52"
                textAnchor="middle"
                fontSize="20"
                fontWeight="600"
                fill="#4A3A22"
                pointerEvents="none"
              >
                {draft.cervical ?? ''}
              </text>
              <text
                x="55"
                y="122"
                textAnchor="middle"
                fontSize="20"
                fontWeight="600"
                fill="#4A3A22"
                pointerEvents="none"
              >
                {draft.incisal ?? ''}
              </text>
            </svg>
          </div>
        </div>

        {/* 아래 — 안내와 확인 */}
        <div className="flex items-center gap-3 px-7 pb-5">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#98A2B3]">
            {message ||
              '색조를 누르면 치아 전체에 들어갑니다. 위아래를 다르게 주려면 색조를 누른 뒤 치아의 부위를 클릭하세요.'}
          </p>

          <button
            type="button"
            onClick={() => {
              // ★ 이름이 '그대로 두기' 면 손대지 않고 닫습니다.
              //   리메이크에서는 색을 지우는 것이 아니라 원주문 값을 두는 뜻입니다.
              if (keepLabel !== '선택 해제') {
                onClose();
                return;
              }
              setDraft(EMPTY_SHADE);
              setArmed(null);
              setMessage('');
            }}
            className="h-9 shrink-0 rounded-md border border-[#DDE2EA] px-4 text-[13.5px] text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            {keepLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              onApply(draftSystem, draft);
              onClose();
            }}
            className="h-9 shrink-0 rounded-md bg-[#1279E8] px-7 text-[13.5px] font-bold text-white hover:bg-[#0F68C9]"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
