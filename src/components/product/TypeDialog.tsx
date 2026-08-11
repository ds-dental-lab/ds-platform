// =========================================================
// 놓을 위치: src/components/product/TypeDialog.tsx
//
// 보철물 종류 등록. (제품탭의 '+ 종류 등록')
//
// 덴쳐 · 교정처럼 새 종류를 만들 때 씁니다.
//
// ★ 종류는 성질을 들고 있어야 합니다.
//   '모델 필수' 와 '재료 이름만 약칭' 이 그것입니다. 임플란트가 그랬듯,
//   새 종류도 자기 규칙을 여기서 정해 둡니다. 코드에는 없습니다.
// =========================================================

'use client';

import { useState } from 'react';
import { submitCreateType } from '@/server/actions/product';

/** 고르기 쉽게 몇 가지만 세워 둡니다 */
const COLORS = [
  { name: '분홍', line: '#E0409A' },
  { name: '파랑', line: '#1B63E8' },
  { name: '보라', line: '#7C6BE8' },
  { name: '초록', line: '#12855B' },
  { name: '주황', line: '#E09A1B' },
  { name: '회색', line: '#5C6779' },
];

export interface TypeDialogProps {
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function TypeDialog({ nextSortOrder, onClose, onSaved }: TypeDialogProps) {
  const [name, setName] = useState('');
  const [abbr, setAbbr] = useState('');
  const [color, setColor] = useState(COLORS[3].line);
  const [needsImplantModel, setNeedsImplantModel] = useState(false);
  const [abbrMaterialOnly, setAbbrMaterialOnly] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const result = await submitCreateType({
      name,
      abbr,
      color,
      needsImplantModel,
      abbrMaterialOnly,
      sortOrder: nextSortOrder,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
      <div className="w-full max-w-[460px] rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h3 className="text-[16px] font-bold tracking-tight text-[#1A2130]">
            보철물 종류 등록
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

        <div className="space-y-4 px-6 py-3">
          <p className="rounded-md bg-[#F4F6F9] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#4A5567]">
            종류를 만든 뒤 <b className="font-semibold">제품 등록</b>에서 재료를 붙이면 치과
            주문등록에 나타납니다.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#4A5567]">이름</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예) 덴쳐"
                className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#4A5567]">
                약칭
                <span className="ml-1 font-normal text-[#98A2B3]">요약에 씁니다</span>
              </span>
              <input
                value={abbr}
                onChange={(e) => setAbbr(e.target.value)}
                placeholder="예) Dn"
                className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8]"
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-[#4A5567]">
              색
              <span className="ml-1 font-normal text-[#98A2B3]">치식도와 칩에 쓰입니다</span>
            </span>

            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.line}
                  type="button"
                  onClick={() => setColor(c.line)}
                  aria-label={c.name}
                  aria-pressed={color === c.line}
                  className={
                    'h-8 w-8 rounded-full border-2 transition-transform ' +
                    (color === c.line ? 'scale-110' : 'border-transparent hover:scale-105')
                  }
                  style={{
                    background: c.line,
                    borderColor: color === c.line ? '#1A2130' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12.5px] font-bold text-[#1A2130]">이 종류의 규칙</p>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 hover:bg-[#F8F9FB]">
              <input
                type="checkbox"
                checked={needsImplantModel}
                onChange={(e) => setNeedsImplantModel(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <b className="text-[13px] font-semibold text-[#1A2130]">모델 선택 필수</b>
                <span className="block text-[11.5px] text-[#98A2B3]">
                  임플란트처럼 제조사·타입을 반드시 고르게 합니다
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 hover:bg-[#F8F9FB]">
              <input
                type="checkbox"
                checked={abbrMaterialOnly}
                onChange={(e) => setAbbrMaterialOnly(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <b className="text-[13px] font-semibold text-[#1A2130]">약칭에 재료 이름만</b>
                <span className="block text-[11.5px] text-[#98A2B3]">
                  켜면 &lsquo;Zir-Cr&rsquo; 이 아니라 &lsquo;Abut+Zir(SCRP)&rsquo; 처럼 나옵니다
                </span>
              </span>
            </label>
          </div>

          {error && <p className="text-[12.5px] text-[#D8453F]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E8EBF0] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-md border border-[#DDE2EA] px-5 text-[13px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !abbr.trim()}
            className="h-10 rounded-md bg-[#5546C8] px-6 text-[13px] font-bold text-white hover:bg-[#4536B8] disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
          >
            {saving ? '저장 중…' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
