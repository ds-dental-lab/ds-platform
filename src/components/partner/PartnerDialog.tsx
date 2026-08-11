// =========================================================
// 놓을 위치: src/components/partner/PartnerDialog.tsx
//
// 거래처 등록·수정. (사용자탭의 '+ 추가 등록' 과 행 클릭)
// 칸 순서는 시안 그대로입니다 —
//   구분 · 상호 · 대표자명 · 대표 전화번호 · 사업자등록번호 · 주소
//   ─────
//   청구서 수령 방식 · 수신 이메일 · 팩스 · 세금계산서 이메일 · 정산 기준일
//
// ★ 구분(치과/기공소)은 만들 때만 고릅니다.
//   주문이 clinic_org_id · lab_org_id 로 이 조직을 이미 어느 쪽으로
//   알고 붙어 있습니다. 나중에 바꾸면 그 주문들이 뒤틀립니다.
//
// ★ '거래중지' 는 지우기가 아닙니다.
//   지난 주문과 정산은 그대로 남고, 새 주문만 막힙니다.
// =========================================================

'use client';

import { useState } from 'react';
import {
  submitCreatePartner,
  submitUpdatePartner,
  type PartnerInput,
} from '@/server/actions/partner';
import type { InvoiceMethod, PartnerRow, PartnerType } from '@/server/repositories/partner';

const METHODS: { value: InvoiceMethod; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'email', label: '이메일' },
  { value: 'fax', label: '팩스' },
];

/** 시안이 내놓는 것은 둘뿐입니다 */
const CLOSING_DAYS = [1, 26];

export interface PartnerDialogProps {
  /** 없으면 새로 만들기 */
  row: PartnerRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function PartnerDialog({ row, onClose, onSaved }: PartnerDialogProps) {
  const editing = row !== null;

  const [orgType, setOrgType] = useState<PartnerType>(row?.orgType ?? 'clinic');
  const [name, setName] = useState(row?.name ?? '');
  const [ceoName, setCeoName] = useState(row?.ceoName ?? '');
  const [tel, setTel] = useState(row?.tel ?? '');
  const [bizNo, setBizNo] = useState(row?.bizNo ?? '');
  const [address, setAddress] = useState(row?.address ?? '');

  const [invoiceMethod, setInvoiceMethod] = useState<InvoiceMethod>(row?.invoiceMethod ?? 'all');
  const [invoiceEmail, setInvoiceEmail] = useState(row?.invoiceEmail ?? '');
  const [fax, setFax] = useState(row?.fax ?? '');
  const [taxEmail, setTaxEmail] = useState(row?.taxEmail ?? '');
  const [closingDay, setClosingDay] = useState(row?.closingDay ?? 26);

  const [isActive, setIsActive] = useState(row?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 수령 방식에 따라 받을 곳이 갈립니다
  const needsEmail = invoiceMethod !== 'fax';
  const needsFax = invoiceMethod !== 'email';

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const input: PartnerInput = {
      name,
      ceoName,
      tel,
      bizNo,
      address,
      invoiceMethod,
      invoiceEmail,
      fax,
      taxEmail,
      closingDay,
      isActive,
    };

    const result = editing
      ? await submitUpdatePartner(row.id, input)
      : await submitCreatePartner({ ...input, orgType });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
      <div className="flex max-h-[92vh] w-full max-w-[460px] flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h3 className="text-[16px] font-bold tracking-tight text-[#1A2130]">
            {editing ? '거래처 정보' : '거래처 등록'}
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
          <Field label="구분" hint={editing ? '만든 뒤에는 못 바꿉니다' : undefined}>
            <select
              value={orgType}
              disabled={editing}
              onChange={(e) => setOrgType(e.target.value as PartnerType)}
              className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8] disabled:bg-[#F4F6F9] disabled:text-[#98A2B3]"
            >
              <option value="clinic">치과</option>
              <option value="lab">기공소</option>
            </select>
          </Field>

          <Field label="상호">
            <Text value={name} onChange={setName} placeholder="창동)연세현치과의원" />
          </Field>

          <Field label="대표자명">
            <Text value={ceoName} onChange={setCeoName} />
          </Field>

          <Field label="대표 전화번호">
            <Text value={tel} onChange={setTel} placeholder="02-000-0000" />
          </Field>

          <Field label="사업자등록번호">
            <Text value={bizNo} onChange={setBizNo} placeholder="000-00-00000" />
          </Field>

          <Field label="주소">
            <Text value={address} onChange={setAddress} />
          </Field>

          <hr className="border-[#E8EBF0]" />

          <Field label="청구서 수령 방식">
            <Radios
              options={METHODS.map((m) => ({ value: m.value, label: m.label }))}
              value={invoiceMethod}
              onChange={(v) => setInvoiceMethod(v as InvoiceMethod)}
            />
          </Field>

          {needsEmail && (
            <Field label="청구서 수신 이메일">
              <Text
                value={invoiceEmail}
                onChange={setInvoiceEmail}
                placeholder="invoice@example.com"
              />
            </Field>
          )}

          {needsFax && (
            <Field label="팩스 번호">
              <Text value={fax} onChange={setFax} placeholder="02-000-0000" />
            </Field>
          )}

          <Field label="세금계산서 수신 이메일">
            <Text value={taxEmail} onChange={setTaxEmail} placeholder="tax@example.com" />
          </Field>

          <Field label="정산 기준일">
            <Radios
              options={CLOSING_DAYS.map((d) => ({ value: String(d), label: `${d}일` }))}
              value={String(closingDay)}
              onChange={(v) => setClosingDay(Number(v))}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5 py-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            <span>
              <b className="text-[13px] font-semibold text-[#1A2130]">거래중</b>
              <span className="ml-2 text-[11.5px] text-[#98A2B3]">
                내리면 새 주문만 막힙니다. 지난 주문은 그대로입니다
              </span>
            </span>
          </label>
        </div>

        {error && <p className="px-6 pb-1 text-[12.5px] text-[#D8453F]">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-[#E8EBF0] px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-[#DDE2EA] px-4 text-[13px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="h-9 rounded-md bg-[#5546C8] px-5 text-[13px] font-bold text-white hover:bg-[#4536B8] disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 조각들 ----------

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

function Text({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8]"
    />
  );
}

function Radios({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <span className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;

        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              'h-9 rounded-md border px-4 text-[13px] font-semibold ' +
              (on
                ? 'border-[#5546C8] bg-[#EFEDFB] text-[#5546C8]'
                : 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]')
            }
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}
