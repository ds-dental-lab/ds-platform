// =========================================================
// 놓을 위치: src/components/fit-value/FitValueDialog.tsx
//
// 내면값 수정 창. 관리탭에서 치과 줄을 누르면 열립니다.
//
// ★ 수치 칸은 글자로 들고 있다가 저장할 때 수로 바꿉니다 (readFit).
//   number input 은 '-0.0' 을 치는 중간 상태를 지워 버립니다 —
//   음수 소수를 치는 칸에서 제일 나쁜 동작입니다.
//
// ★ 어느 칸이 잘못됐는지는 이름으로 알립니다 (checkFitValues).
//   칸이 아홉인데 "값이 잘못됐습니다" 만 뜨면 아홉 칸을 다 봅니다.
// =========================================================

'use client';

import { useState } from 'react';
import { submitSaveFitValues } from '@/server/actions/fit-value';
import {
  FIT_NUMBER_FIELDS,
  IMPLANT_MAX,
  NOTE_MAX,
  readFit,
  type FitNumberKey,
  type FitValues,
} from '@/server/domain/fit-value';

export interface FitValueDialogProps {
  clinicOrgId: string;
  clinicName: string;
  /** 아직 안 적었으면 null */
  values: FitValues | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function FitValueDialog({
  clinicOrgId,
  clinicName,
  values,
  onClose,
  onSaved,
}: FitValueDialogProps) {
  // 수치는 글자로 듭니다 — 치는 중간 상태를 지키려고요
  const [numbers, setNumbers] = useState<Record<FitNumberKey, string>>(() => {
    const init = {} as Record<FitNumberKey, string>;
    for (const field of FIT_NUMBER_FIELDS) {
      const v = values?.[field.key];
      init[field.key] = v === null || v === undefined ? '' : String(v);
    }
    return init;
  });

  const [hook, setHook] = useState(values?.hook ?? false);
  const [implantNote, setImplantNote] = useState(values?.implantNote ?? '');
  const [note, setNote] = useState(values?.note ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const input: FitValues = {
      naturalTooth: readFit(numbers.naturalTooth),
      cnc: readFit(numbers.cnc),
      inlay: readFit(numbers.inlay),
      pla: readFit(numbers.pla),
      pmma: readFit(numbers.pmma),
      contactAdj: readFit(numbers.contactAdj),
      contactSingle: readFit(numbers.contactSingle),
      hook,
      implantNote,
      note,
    };

    const result = await submitSaveFitValues(clinicOrgId, input);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  const materials = FIT_NUMBER_FIELDS.filter((f) => f.group === 'material');
  const contacts = FIT_NUMBER_FIELDS.filter((f) => f.group === 'contact');

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
      <div className="flex max-h-[92vh] w-full max-w-[480px] flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h3 className="text-[16px] font-bold tracking-tight text-[#1A2130]">
            {clinicName} 내면값
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-7 w-7 place-items-center rounded text-[#98A2B3] hover:bg-[#F4F6F9]"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-3">
          {/* ---------- 보철 재료 ---------- */}
          <section>
            <GroupLabel>보철 재료</GroupLabel>
            <div className="grid grid-cols-3 gap-2.5">
              {materials.map((field) => (
                <NumberBox
                  key={field.key}
                  label={field.label}
                  value={numbers[field.key]}
                  onChange={(v) => setNumbers((prev) => ({ ...prev, [field.key]: v }))}
                />
              ))}
            </div>
          </section>

          {/* ---------- 컨택 ---------- */}
          <section>
            <GroupLabel>컨택</GroupLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {contacts.map((field) => (
                <NumberBox
                  key={field.key}
                  label={field.label}
                  value={numbers[field.key]}
                  onChange={(v) => setNumbers((prev) => ({ ...prev, [field.key]: v }))}
                  placeholder="-0.05"
                />
              ))}
            </div>
          </section>

          {/* ---------- Hook · 임플란트 ---------- */}
          <section className="grid grid-cols-2 gap-3">
            <div>
              <GroupLabel>Hook</GroupLabel>
              <div className="flex gap-2">
                {([true, false] as const).map((on) => (
                  <button
                    key={String(on)}
                    type="button"
                    onClick={() => setHook(on)}
                    className={
                      'h-9 flex-1 rounded-md border text-[13.5px] font-semibold ' +
                      (hook === on
                        ? 'border-[#5546C8] bg-[#EFEDFB] text-[#5546C8]'
                        : 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]')
                    }
                  >
                    {on ? '있음' : '미사용'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <GroupLabel>임플란트</GroupLabel>
              <input
                value={implantNote}
                maxLength={IMPLANT_MAX}
                onChange={(e) => setImplantNote(e.target.value)}
                placeholder="OST TS / SS"
                className="h-9 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[14px] outline-none focus:border-[#5546C8]"
              />
            </div>
          </section>

          {/* ---------- 비고 ---------- */}
          <section>
            <GroupLabel>비고 · 치과 특징</GroupLabel>
            <textarea
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={'대구치 Implant Case\n- supra margin [ eq보다 살짝 높게 ]'}
              className="w-full resize-y rounded-md border border-[#DDE2EA] px-2.5 py-2 text-[14px] leading-relaxed outline-none focus:border-[#5546C8]"
            />
          </section>

          {/* ★ 저장이 곧 알림입니다 — 무엇이 일어나는지 미리 밝혀 둡니다 */}
          <p className="rounded-md bg-[#F8F9FB] px-3 py-2 text-[12.5px] leading-relaxed text-[#98A2B3]">
            저장하면 <b className="font-bold text-[#4A5567]">7일 동안</b> 주문상세의 치과명
            옆에 주황 점이 붙고, 카드를 열면 바뀐 날짜가 뜹니다. 디자이너가 그걸 보고
            새 값으로 작업합니다.
          </p>
        </div>

        {error && <p className="px-6 pb-1 text-[13.5px] text-[#D8453F]">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-[#E8EBF0] px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-[#DDE2EA] px-4 text-[14px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="h-9 rounded-md bg-[#5546C8] px-5 text-[14px] font-bold text-white hover:bg-[#4536B8] disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 조각들 ----------

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[13px] font-semibold text-[#4A5567]">{children}</span>
  );
}

function NumberBox({
  label,
  value,
  onChange,
  placeholder = '0.04',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block rounded-md border border-[#DDE2EA] px-2.5 py-1.5 focus-within:border-[#5546C8]">
      <span className="block text-[11.5px] font-semibold text-[#98A2B3]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="w-full text-[14px] font-semibold tabular-nums text-[#1A2130] outline-none placeholder:font-normal placeholder:text-[#C4CBD6]"
      />
    </label>
  );
}
