// =========================================================
// 놓을 위치: src/components/billing/InvoiceContactBar.tsx
//
// 정산 화면에서 거래처의 '정산서 받을 곳' 을 그 자리에서 고칩니다.
// (사용자 요청 2026-08-12 — 초록 체크로 어디를 원하는지 보이고,
//  디자인센터도 이메일·팩스를 넣고 체크를 누를 수 있게)
//
// ★ 여기서 고치게 두는 이유.
//   치과가 자기 계정정보에 이메일을 안 넣어 둔 채로 마감 날이 옵니다.
//   전화로 물어 그 자리에서 적는 것이 현실이고, 그때 사용자탭까지
//   갔다 오게 하면 결국 아무도 안 채웁니다.
//
// ★ 초록 체크는 '치과가 원하는 곳' 입니다.
//   값이 있는지(●)와 어디로 받는지(✓)는 다른 이야기입니다.
//   전에는 ● 하나로 '값 있음' 만 보여 줬는데, 그것만으로는 이메일이
//   적혀 있어도 실은 팩스로 받는 곳인지 알 수 없었습니다.
//
// ★ 고른 곳이 비어 있으면 빨갛게 짚습니다.
//   그것이 정산서가 아무 데도 안 가는 유일한 경우입니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitPartnerContact } from '@/server/actions/partner';
import {
  INVOICE_METHODS,
  INVOICE_METHOD_LABEL,
  missingContact,
  wantsEmail,
  wantsFax,
  type InvoiceMethod,
} from '@/server/domain/invoice-method';

export interface InvoiceContactBarProps {
  orgId: string;
  method: InvoiceMethod;
  email: string | null;
  fax: string | null;
}

export default function InvoiceContactBar({
  orgId,
  method,
  email,
  fax,
}: InvoiceContactBarProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const [form, setForm] = useState({ method, email: email ?? '', fax: fax ?? '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const dirty =
    form.method !== method || form.email !== (email ?? '') || form.fax !== (fax ?? '');

  const missing = missingContact({
    method: form.method,
    email: form.email,
    fax: form.fax,
  });

  async function save() {
    setError('');
    setSaving(true);

    const result = await submitPartnerContact({
      orgId,
      invoiceMethod: form.method,
      invoiceEmail: form.email,
      fax: form.fax,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-md border border-[#E8EBF0] bg-[#FBFCFD] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-[#4A5567]">정산서 받을 곳</span>

        <div className="flex gap-1">
          {INVOICE_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setSaved(false);
                setForm((prev) => ({ ...prev, method: m }));
              }}
              aria-pressed={form.method === m}
              className={
                'h-7 rounded px-2.5 text-[13px] font-semibold ' +
                (form.method === m
                  ? 'bg-[#E6F4EE] text-[#12855B]'
                  : 'text-[#98A2B3] hover:bg-[#F0F3F7]')
              }
            >
              {form.method === m && <span className="mr-0.5">✓</span>}
              {INVOICE_METHOD_LABEL[m]}
            </button>
          ))}
        </div>

        {missing.length > 0 && (
          <span className="text-[12.5px] font-semibold text-[#D8453F]">
            {missing.includes('email') && '이메일'}
            {missing.length === 2 && '·'}
            {missing.includes('fax') && '팩스'} 가 비어 정산서가 갈 데가 없습니다
          </span>
        )}

        {saved && !dirty && (
          <span className="text-[12.5px] font-semibold text-[#12855B]">저장했습니다</span>
        )}

        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || refreshing}
          className="ml-auto h-7 rounded bg-[#1279E8] px-3 text-[13px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#C4CBD6]"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <Field label="이메일" want={wantsEmail(form.method)}>
          <input
            value={form.email}
            onChange={(e) => {
              setSaved(false);
              setForm((prev) => ({ ...prev, email: e.target.value }));
            }}
            placeholder="invoice@example.com"
            className="h-9 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[14px] outline-none focus:border-[#1279E8]"
          />
        </Field>

        <Field label="팩스 번호" want={wantsFax(form.method)}>
          <input
            value={form.fax}
            onChange={(e) => {
              setSaved(false);
              setForm((prev) => ({ ...prev, fax: e.target.value }));
            }}
            placeholder="02-000-0000"
            className="h-9 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[14px] outline-none focus:border-[#1279E8]"
          />
        </Field>
      </div>

      {error && <p className="mt-2 text-[13px] font-semibold text-[#D8453F]">{error}</p>}
    </div>
  );
}

function Field({
  label,
  want,
  children,
}: {
  label: string;
  /** 정산서를 여기로 받는가 */
  want: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-[#4A5567]">
        {label}
        {want && (
          <span className="font-bold text-[#12855B]" title="이 거래처가 여기로 받겠다고 한 곳입니다">
            ✓
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
