// =========================================================
// 놓을 위치: src/components/product/ProductDialog.tsx
//
// 제품 등록·수정. (제품탭의 '+ 제품 등록' 과 행 클릭)
//
// ★ 종류는 만들 때만 고릅니다.
//   이미 있는 제품의 종류를 옮기면 지난 주문이 가리키던 짝이 끊깁니다.
//   수정 창에서는 종류를 잠가 둡니다.
//
// ★ 못 쓰는 항목의 값은 아예 받지 않습니다.
//   폰틱을 끄면 폰틱 가격 칸이 사라집니다. 값이 남아 있으면
//   "안 되는데 값은 있는" 줄이 되어 나중에 헷갈립니다.
// =========================================================

'use client';

import { useState } from 'react';
import {
  submitCreateProduct,
  submitUpdateProduct,
  type ProductInput,
} from '@/server/actions/product';
import type { ProductRow, TypeOption } from '@/server/repositories/prosthesis';

export interface ProductDialogProps {
  types: TypeOption[];
  /** 없으면 새로 만들기 */
  row: ProductRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductDialog({ types, row, onClose, onSaved }: ProductDialogProps) {
  const editing = row !== null;

  const [typeId, setTypeId] = useState(row?.typeId ?? types[0]?.id ?? '');
  const [name, setName] = useState(row?.materialName ?? '');
  const [abbr, setAbbr] = useState(row?.materialAbbr ?? '');
  const [hasShade, setHasShade] = useState(row?.hasShade ?? true);
  const [hasPontic, setHasPontic] = useState(row?.hasPontic ?? false);
  const [hasPink, setHasPink] = useState(row?.hasPink ?? false);
  const [price, setPrice] = useState(text(row?.price));
  const [ponticPrice, setPonticPrice] = useState(text(row?.ponticPrice));
  const [pinkPrice, setPinkPrice] = useState(text(row?.pinkPrice));
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 1));
  const [isActive, setIsActive] = useState(row?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const input: ProductInput = {
      typeId,
      name,
      abbr,
      hasShade,
      hasPontic,
      hasPink,
      price: num(price),
      ponticPrice: num(ponticPrice),
      pinkPrice: num(pinkPrice),
      sortOrder: Number(sortOrder) || 1,
      isActive,
    };

    const result = editing
      ? await submitUpdateProduct(row.materialId, input)
      : await submitCreateProduct(input);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h3 className="text-[16px] font-bold tracking-tight text-[#1A2130]">
            {editing ? '제품 수정' : '제품 등록'}
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="보철물 종류">
              <select
                value={typeId}
                disabled={editing}
                onChange={(e) => setTypeId(e.target.value)}
                title={editing ? '만든 뒤에는 종류를 옮길 수 없습니다' : undefined}
                className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8] disabled:bg-[#F4F6F9] disabled:text-[#98A2B3]"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isActive ? '' : ' (중지)'}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="표시 순서" hint="작을수록 앞에 나옵니다">
              <input
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8]"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="재료 이름">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예) 지르코니아"
                className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8]"
              />
            </Field>

            <Field label="약칭" hint="요약에 'Zir-Cr' 처럼 쓰입니다">
              <input
                value={abbr}
                onChange={(e) => setAbbr(e.target.value)}
                placeholder="예) Zir"
                className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8]"
              />
            </Field>
          </div>

          {/* ---------- 성질 ---------- */}
          <div>
            <p className="mb-2 text-[12.5px] font-bold text-[#1A2130]">이 제품이 되는 것</p>

            <div className="space-y-1.5">
              <Check on={hasShade} onChange={setHasShade} label="쉐이드">
                끄면 주문등록에서 쉐이드창이 뜨지 않습니다
              </Check>
              <Check on={hasPontic} onChange={setHasPontic} label="폰틱 (브릿지 연결)">
                끄면 우클릭 폰틱과 브릿지 연결이 막힙니다
              </Check>
              <Check on={hasPink} onChange={setHasPink} label="핑크 포셀린">
                끄면 휠클릭이 막힙니다
              </Check>
            </div>
          </div>

          {/* ---------- 가격 ---------- */}
          <div>
            <p className="mb-2 text-[12.5px] font-bold text-[#1A2130]">
              가격
              <span className="ml-1.5 font-normal text-[#98A2B3]">
                비워 두면 아직 안 정한 것, 0 은 무료입니다
              </span>
            </p>

            <div className="grid grid-cols-3 gap-3">
              <Field label="판매 가격">
                <Won value={price} onChange={setPrice} />
              </Field>

              {hasPontic && (
                <Field label="가격(Pontic)">
                  <Won value={ponticPrice} onChange={setPonticPrice} />
                </Field>
              )}

              {hasPink && (
                <Field label="가격(핑크 포셀린)">
                  <Won value={pinkPrice} onChange={setPinkPrice} />
                </Field>
              )}
            </div>
          </div>

          <Check on={isActive} onChange={setIsActive} label="판매중">
            끄면 치과 주문등록 목록에서 빠집니다. 지난 주문은 그대로입니다
          </Check>

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
            {saving ? '저장 중…' : editing ? '수정' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 조각들 ----------

function text(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** 빈 칸은 null 입니다 — '아직 안 정함' 과 '0원' 을 나눕니다 */
function num(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[#4A5567]">
        {label}
        {hint && <span className="ml-1 font-normal text-[#98A2B3]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Won({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        inputMode="numeric"
        placeholder="미정"
        className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-right text-[13px] tabular-nums outline-none focus:border-[#5546C8]"
      />
      <span className="shrink-0 text-[12px] text-[#98A2B3]">원</span>
    </span>
  );
}

function Check({
  on,
  onChange,
  label,
  children,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 hover:bg-[#F8F9FB]">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4"
      />
      <span className="min-w-0">
        <b className="text-[13px] font-semibold text-[#1A2130]">{label}</b>
        {children && (
          <span className="block text-[11.5px] text-[#98A2B3]">{children}</span>
        )}
      </span>
    </label>
  );
}
