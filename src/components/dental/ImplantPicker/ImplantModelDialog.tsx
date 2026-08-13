// =========================================================
// 놓을 위치: src/components/dental/ImplantPicker/ImplantModelDialog.tsx
//
// 임플란트 모델 등록 팝업. (기능명세서 §4.2.4, 사용자가 준 화면)
//   제조사 · 타입 · 사이즈 · 스크류 · 옵션 다섯 칸을 나란히 놓고
//   왼쪽부터 좁혀 갑니다. 상위를 바꾸면 아래가 지워집니다.
//
// ★ 고를 것이 없는 칸은 비워 둡니다.
//   "고를 게 없어서 빈 것"과 "고를 수 있는데 안 고른 것"은 다릅니다 —
//   앞의 경우는 그대로 진행됩니다 (domain/implant 의 isComplete).
// =========================================================

'use client';

import { useState } from 'react';
import {
  getTypes,
  getSizes,
  getScrews,
  selectManufacturer,
  selectType,
  isComplete,
  getMissingStep,
  formatSelection,
  EMPTY_SELECTION,
  type ImplantCatalog,
  type ImplantOption,
  type ImplantSelection,
} from '@/server/domain/implant';

export interface ImplantModelDialogProps {
  catalog: ImplantCatalog;
  value?: ImplantSelection;
  title?: string;
  confirmLabel?: string;
  onConfirm: (selection: ImplantSelection) => void;
  onClose: () => void;
}

export default function ImplantModelDialog({
  catalog,
  value = EMPTY_SELECTION,
  title = '임플란트 모델 등록',
  confirmLabel = '추가',
  onConfirm,
  onClose,
}: ImplantModelDialogProps) {
  const [draft, setDraft] = useState<ImplantSelection>(value);

  const { manufacturerCode, typeCode } = draft;
  const types = getTypes(catalog, manufacturerCode);
  const sizes = getSizes(catalog, manufacturerCode, typeCode);
  const screws = getScrews(catalog, manufacturerCode, typeCode);

  const complete = isComplete(catalog, draft);
  const missing = getMissingStep(catalog, draft);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
      <div className="flex max-h-[90vh] w-full max-w-[1100px] flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
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

        <div className="mx-6 grid min-h-0 flex-1 grid-cols-5 overflow-hidden rounded-lg border border-[#E8EBF0]">
          <Column title="제조사">
            {catalog.map((m) => (
              <Card
                key={m.code}
                label={m.name}
                on={manufacturerCode === m.code}
                onClick={() => setDraft(selectManufacturer(m.code))}
              />
            ))}
          </Column>

          <Column title="타입" hint={!manufacturerCode ? '제조사를 먼저 고르세요' : undefined}>
            {types.map((t) => (
              <Card
                key={t.code}
                label={t.name}
                on={typeCode === t.code}
                onClick={() => setDraft(selectType(draft, t.code))}
              />
            ))}
          </Column>

          <Column
            title="사이즈"
            hint={
              !typeCode
                ? '타입을 먼저 고르세요'
                : sizes.length === 0
                  ? '이 타입은 사이즈 구분이 없습니다'
                  : undefined
            }
          >
            {sizes.map((s: ImplantOption) => (
              <Card
                key={s.code}
                label={s.name}
                on={draft.sizeCode === s.code}
                onClick={() => setDraft({ ...draft, sizeCode: s.code })}
              />
            ))}
          </Column>

          <Column
            title="스크류"
            hint={
              !typeCode
                ? '타입을 먼저 고르세요'
                : screws.length === 0
                  ? '이 타입은 스크류 구분이 없습니다'
                  : undefined
            }
          >
            {screws.map((s: ImplantOption) => (
              <Card
                key={s.code}
                label={s.name}
                on={draft.screwCode === s.code}
                onClick={() => setDraft({ ...draft, screwCode: s.code })}
              />
            ))}
          </Column>

          <Column title="옵션">
            <input
              value={draft.option}
              onChange={(e) => setDraft({ ...draft, option: e.target.value })}
              placeholder="직접 입력"
              className="w-full rounded-md border border-[#DDE2EA] px-3 py-2 text-[14px] outline-none focus:border-[#1B63E8]"
            />
            <p className="mt-2 text-[12.5px] text-[#98A2B3]">
              목록 없이 매번 직접 적습니다.
            </p>
          </Column>
        </div>

        <div className="flex items-center gap-3 px-6 py-4">
          <span
            className={
              'font-mono text-[14px] ' + (complete ? 'text-[#1A2130]' : 'text-[#98A2B3]')
            }
          >
            {formatSelection(catalog, draft) || '선택 없음'}
          </span>

          {!complete && missing && (
            <span className="text-[13.5px] text-[#E09A1B]">{missing} 를 골라 주세요</span>
          )}

          <button
            type="button"
            onClick={() => {
              onConfirm(draft);
              onClose();
            }}
            disabled={!complete}
            className="ml-auto rounded-md bg-[#1B63E8] px-6 py-2 text-[13.5px] font-bold text-white hover:bg-[#155ACB] disabled:cursor-not-allowed disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Column({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col border-r border-[#E8EBF0] last:border-r-0">
      <h4 className="border-b border-[#E8EBF0] py-3.5 text-center text-[14px] font-bold text-[#1A2130]">
        {title}
      </h4>

      <div className="flex min-h-[320px] flex-col gap-2 overflow-y-auto p-3">
        {hint ? (
          <p className="py-6 text-center text-[13px] text-[#98A2B3]">{hint}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'truncate rounded-full border px-3 py-2 text-center text-[14px] transition-colors ' +
        (on
          ? 'border-[#1B63E8] bg-[#EDF3FE] font-bold text-[#1B63E8]'
          : 'border-[#E8EBF0] bg-white text-[#4A5567] hover:border-[#98A2B3]')
      }
    >
      {label}
    </button>
  );
}
