// =========================================================
// 놓을 위치: src/components/dental/ImplantPicker/index.tsx
//
// 임플란트 계단식 선택. (기능명세서 §4.2.4)
//   제조사 → 타입 → 사이즈 · 스크류 → 옵션(자유 입력)
//   상위를 바꾸면 하위가 초기화됩니다.
//   고를 항목이 없는 칸은 비워 둡니다.
// =========================================================

'use client';

import { useState } from 'react';
import {
  MANUFACTURERS,
  EMPTY_SELECTION,
  getTypes,
  getSizes,
  getScrews,
  selectManufacturer,
  selectType,
  isComplete,
  getMissingStep,
  formatSelection,
  type ImplantOption,
  type ImplantSelection,
} from '@/server/domain/implant';

export interface ImplantPickerProps {
  value?: ImplantSelection;
  onChange?: (selection: ImplantSelection) => void;
}

export default function ImplantPicker({
  value = EMPTY_SELECTION,
  onChange,
}: ImplantPickerProps) {
  const [selection, setSelection] = useState<ImplantSelection>(value);

  function update(next: ImplantSelection) {
    setSelection(next);
    onChange?.(next);
  }

  const { manufacturerCode, typeCode } = selection;

  const types = getTypes(manufacturerCode);
  const sizes = getSizes(manufacturerCode, typeCode);
  const screws = getScrews(manufacturerCode, typeCode);

  const complete = isComplete(selection);
  const missing = getMissingStep(selection);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="grid grid-cols-1 divide-y divide-gray-200 md:grid-cols-5 md:divide-x md:divide-y-0">
        {/* ---------- 제조사 ---------- */}
        <Column title="제조사">
          {MANUFACTURERS.map((m) => (
            <Card
              key={m.code}
              name={m.name}
              code={m.code}
              selected={manufacturerCode === m.code}
              onClick={() => update(selectManufacturer(m.code))}
            />
          ))}
        </Column>

        {/* ---------- 타입 ---------- */}
        <Column title="타입" hint={!manufacturerCode ? '제조사를 먼저 고르세요' : undefined}>
          {types.map((t) => (
            <Card
              key={t.code}
              name={t.name}
              code={t.code}
              selected={typeCode === t.code}
              onClick={() => update(selectType(selection, t.code))}
            />
          ))}
        </Column>

        {/* ---------- 사이즈 ---------- */}
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
          {sizes.map((s) => (
            <OptionCard
              key={s.code}
              option={s}
              selected={selection.sizeCode === s.code}
              onClick={() => update({ ...selection, sizeCode: s.code })}
            />
          ))}
        </Column>

        {/* ---------- 스크류 ---------- */}
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
          {screws.map((s) => (
            <OptionCard
              key={s.code}
              option={s}
              selected={selection.screwCode === s.code}
              onClick={() => update({ ...selection, screwCode: s.code })}
            />
          ))}
        </Column>

        {/* ---------- 옵션 (자유 입력) ---------- */}
        <Column title="옵션">
          <input
            type="text"
            value={selection.option}
            placeholder="직접 입력"
            onChange={(e) => update({ ...selection, option: e.target.value })}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-2 text-[12px] text-gray-400">
            목록 없이 매번 직접 적습니다.
          </p>
        </Column>
      </div>

      {/* ---------- 요약 ---------- */}
      <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
        <span className="font-mono text-sm text-gray-700">
          {formatSelection(selection) || '선택 없음'}
        </span>
        <span
          className={`text-[13px] ${complete ? 'font-semibold text-green-700' : 'text-gray-400'}`}
        >
          {complete ? '선택 완료' : `${missing} 를 골라 주세요`}
        </span>
      </div>
    </div>
  );
}

// ---------- 칸 ----------

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
    <div className="min-w-0 p-4">
      <h3 className="mb-3 text-center text-[13px] font-bold text-gray-800">{title}</h3>
      <div className="flex flex-col gap-2">
        {hint ? <p className="py-3 text-center text-[12px] text-gray-400">{hint}</p> : children}
      </div>
    </div>
  );
}

// ---------- 카드 ----------

function Card({
  name,
  code,
  selected,
  onClick,
}: {
  name: string;
  code: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-400'
      }`}
    >
      <div className="text-[13px]">
        <span className="text-gray-400">이름 : </span>
        <span className="font-semibold text-gray-900">{name}</span>
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-gray-400">코드 : {code}</div>
    </button>
  );
}

function OptionCard({
  option,
  selected,
  onClick,
}: {
  option: ImplantOption;
  selected: boolean;
  onClick: () => void;
}) {
  return <Card name={option.name} code={option.code} selected={selected} onClick={onClick} />;
}
