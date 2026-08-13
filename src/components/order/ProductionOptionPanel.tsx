// =========================================================
// 놓을 위치: src/components/order/ProductionOptionPanel.tsx
//
// 제작옵션. (기능명세서 §4.2.8 — 훅 · 폰틱타입)
//
// 한 치과 안에 A원장·B원장이 있고 늘 쓰는 값이 서로 다릅니다.
// 이름을 붙여 저장해 두고 칩 하나로 불러옵니다.
//
// ★ 이름은 언제든 고칩니다.
//   '원장1' 로 만들어 두고 나중에 실제 이름으로 바꾸는 일이 흔해,
//   지우고 다시 만들게 하지 않고 그 자리에서 고치게 했습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import OrderSection, { SECTION_ICON } from '@/components/order/OrderSection';
import {
  submitSaveOptionPreset,
  submitRenameOptionPreset,
  submitUpdateOptionPreset,
  submitDeleteOptionPreset,
} from '@/server/actions/option-preset';
import type { ProductionOptionGroup } from '@/server/repositories/production-option';
import type { OptionPreset } from '@/server/repositories/option-preset';

export interface ProductionOptionPanelProps {
  groups: ProductionOptionGroup[];
  presets: OptionPreset[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

/** 저장된 묶음과 지금 고른 값이 같은가 */
function sameSelection(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

export default function ProductionOptionPanel({
  groups,
  presets,
  value,
  onChange,
}: ProductionOptionPanelProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /** 이름을 받는 중 — 'new' 는 새로 저장, 그 밖에는 그 프리셋의 이름 고치기 */
  const [naming, setNaming] = useState<'new' | string | null>(null);
  const [draftName, setDraftName] = useState('');

  const busy = saving || refreshing;

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    setSaving(true);
    const result = await action();
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? '처리하지 못했습니다');
      return false;
    }

    startTransition(() => router.refresh());
    return true;
  }

  function openNaming(target: 'new' | string, initial: string) {
    setNaming(target);
    setDraftName(initial);
    setError('');
  }

  async function confirmNaming() {
    if (!naming) return;

    const ok =
      naming === 'new'
        ? await run(() => submitSaveOptionPreset(draftName, value))
        : await run(() => submitRenameOptionPreset(naming, draftName));

    if (ok) setNaming(null);
  }

  return (
    <OrderSection icon={SECTION_ICON.option} title="제작옵션">
      {/* ---------- 저장해 둔 묶음 ---------- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {presets.map((preset) => {
          const on = sameSelection(preset.selections, value);

          return (
            <span
              key={preset.id}
              className={
                'inline-flex items-center rounded-full border transition-colors ' +
                (on
                  ? 'border-[#1279E8] bg-[#EDF3FE]'
                  : 'border-[#E8EBF0] bg-white hover:border-[#98A2B3]')
              }
            >
              <button
                type="button"
                onClick={() => onChange({ ...value, ...preset.selections })}
                className={
                  'py-1.5 pl-3.5 pr-2 text-[13.5px] font-semibold ' +
                  (on ? 'text-[#1279E8]' : 'text-[#4A5567]')
                }
              >
                {preset.name}
              </button>

              <button
                type="button"
                title="이름 바꾸기"
                aria-label={`${preset.name} 이름 바꾸기`}
                onClick={() => openNaming(preset.id, preset.name)}
                className="px-1 text-[11px] text-[#98A2B3] hover:text-[#1279E8]"
              >
                ✎
              </button>

              {/* 지금 고른 값으로 덮어쓰기 — 켜져 있을 땐 바뀐 게 없어 숨깁니다 */}
              {!on && (
                <button
                  type="button"
                  title="지금 설정으로 덮어쓰기"
                  aria-label={`${preset.name} 덮어쓰기`}
                  disabled={busy}
                  onClick={() => run(() => submitUpdateOptionPreset(preset.id, value))}
                  className="px-1 text-[11px] text-[#98A2B3] hover:text-[#1279E8]"
                >
                  ⟳
                </button>
              )}

              <button
                type="button"
                title="지우기"
                aria-label={`${preset.name} 지우기`}
                disabled={busy}
                onClick={() => run(() => submitDeleteOptionPreset(preset.id))}
                className="py-1.5 pl-1 pr-3 text-[13px] text-[#C4CBD6] hover:text-[#D8453F]"
              >
                ✕
              </button>
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => openNaming('new', '')}
          disabled={groups.length === 0}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#C4CBD6] px-3.5 py-1.5 text-[13.5px] font-semibold text-[#4A5567] hover:border-[#1279E8] hover:text-[#1279E8] disabled:cursor-not-allowed disabled:text-[#C4CBD6]"
        >
          + 현재 설정 저장
        </button>
      </div>

      {/* 이름 입력 — 팝업까지 갈 일이 아니라 그 자리에서 받습니다 */}
      {naming && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-[#DDE2EA] bg-[#F8F9FB] px-3 py-2.5">
          <span className="text-[13.5px] font-bold text-[#1A2130]">
            {naming === 'new' ? '이 설정의 이름' : '이름 바꾸기'}
          </span>

          <input
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirmNaming();
              if (e.key === 'Escape') setNaming(null);
            }}
            placeholder="예) A원장"
            maxLength={20}
            className="h-9 w-40 rounded border border-[#DDE2EA] px-2.5 text-[14px] outline-none focus:border-[#1279E8]"
          />

          <button
            type="button"
            onClick={confirmNaming}
            disabled={busy || !draftName.trim()}
            className="h-9 rounded bg-[#1279E8] px-4 text-[13.5px] font-bold text-white disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
          >
            저장
          </button>

          <button
            type="button"
            onClick={() => setNaming(null)}
            className="h-9 rounded border border-[#DDE2EA] bg-white px-3 text-[13.5px] text-[#4A5567]"
          >
            취소
          </button>
        </div>
      )}

      {error && <p className="mb-3 text-[13.5px] text-[#D8453F]">{error}</p>}

      {/* ---------- 옵션 본체 ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id}>
            <label className="mb-1.5 block text-[14px] font-bold text-[#1A2130]">
              {group.name}
            </label>
            <select
              value={value[group.id] ?? ''}
              onChange={(e) => onChange({ ...value, [group.id]: e.target.value })}
              className="h-11 w-full rounded border border-[#DDE2EA] px-3 text-[14px] outline-none focus:border-[#1279E8]"
            >
              {group.values.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.value}
                </option>
              ))}
            </select>
          </div>
        ))}

        {groups.length === 0 && (
          <p className="text-[14px] text-[#98A2B3]">등록된 제작옵션이 없습니다.</p>
        )}
      </div>
    </OrderSection>
  );
}
