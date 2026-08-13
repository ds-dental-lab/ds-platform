// =========================================================
// 놓을 위치: src/components/account/AccountForm.tsx
//
// 계정 정보 — 우리 조직의 사업자 정보입니다.
//
// ★ 청구서에 그대로 실립니다.
//   비어 있으면 문서에 '-' 로 찍힙니다. 그래서 무엇이 비었는지
//   칸마다 알려 주고, 위에 몇 칸 남았는지 세어 둡니다.
//
// ★ 아직 개설 전이라 비워 두어도 됩니다 (사용자 2026-08-12).
//   상호만 있으면 저장됩니다. 나중에 채우면 그날부터 청구서에 나옵니다.
//   지난 청구서는 뽑을 때의 값이 아니라 지금 값으로 다시 그려집니다 —
//   아직 아무것도 안 나갔으니 지금은 그게 맞습니다.
//
// ★ 조직 종류와 코드는 여기 없습니다.
//   주문·정산이 그 값으로 붙어 있어 DB 트리거가 막습니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitAccount, type AccountInput } from '@/server/actions/account';
import {
  INVOICE_METHODS,
  INVOICE_METHOD_LABEL,
  wantsEmail,
  wantsFax,
  type InvoiceMethod,
} from '@/server/domain/invoice-method';

export interface AccountFormProps {
  /** 이 섹터의 뿌리 주소 — /clinic · /design · /lab */
  basePath: string;
  org: {
    name: string;
    code: string | null;
    orgType: 'clinic' | 'design_center' | 'lab';
    ceoName: string | null;
    bizNo: string | null;
    tel: string | null;
    fax: string | null;
    address: string | null;
    invoiceEmail: string | null;
    taxEmail: string | null;
    invoiceMethod: InvoiceMethod;
    closingDay: number;
  };
  /** 고칠 수 있는 사람인가 (owner · admin) */
  editable: boolean;
}

/** 아래줄에 나란히 서는 곁길 단추들 */
const SUB_LINK =
  'h-10 rounded-md border border-[#DDE2EA] px-3.5 text-[12.5px] font-semibold leading-10 text-[#4A5567] hover:bg-[#F4F6F9]';

const TYPE_LABEL = {
  clinic: '치과',
  design_center: '디자인센터',
  lab: '기공소',
} as const;

export default function AccountForm({ org, editable, basePath }: AccountFormProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<AccountInput>({
    name: org.name,
    ceoName: org.ceoName ?? '',
    bizNo: org.bizNo ?? '',
    tel: org.tel ?? '',
    fax: org.fax ?? '',
    address: org.address ?? '',
    invoiceEmail: org.invoiceEmail ?? '',
    taxEmail: org.taxEmail ?? '',
    invoiceMethod: org.invoiceMethod,
  });

  const busy = saving || refreshing;

  // 청구서에 꼭 있어야 하는 칸들. 비면 문서에 '-' 로 찍힙니다
  const forInvoice: Exclude<keyof AccountInput, 'invoiceMethod'>[] = ['ceoName', 'bizNo', 'address'];
  const emptyForInvoice = forInvoice.filter((k) => !form[k].trim()).length;

  function set(key: Exclude<keyof AccountInput, 'invoiceMethod'>, value: string) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setMethod(invoiceMethod: InvoiceMethod) {
    setSaved(false);
    setForm((prev) => ({ ...prev, invoiceMethod }));
  }

  async function save() {
    setError('');
    setSaving(true);

    const result = await submitAccount(form);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        {/* ---------- 머리 ---------- */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#E8EBF0] px-6 py-4">
          <h2 className="text-[15px] font-bold tracking-tight text-[#1A2130]">계정 정보</h2>

          <span
            className="rounded px-2 py-0.5 text-[11px] font-bold"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            {TYPE_LABEL[org.orgType]}
          </span>

          {org.code && (
            <span className="text-[12px] tabular-nums text-[#98A2B3]">{org.code}</span>
          )}

          {saved && (
            <span className="ml-auto text-[12.5px] font-semibold text-[#12855B]">
              저장했습니다
            </span>
          )}
        </div>

        {/* ---------- 안내 ---------- */}
        {emptyForInvoice > 0 && (
          <p className="border-b border-[#E8EBF0] bg-[#FEF7EA] px-6 py-3 text-[12.5px] leading-relaxed text-[#8A5A12]">
            청구서에 들어가는 칸 <b className="font-bold">{emptyForInvoice}개</b>가 비어 있습니다.
            지금은 문서에 &lsquo;-&rsquo; 로 찍힙니다 — 개설한 뒤에 채워 주세요.
          </p>
        )}

        {/* ---------- 칸 ---------- */}
        <div className="space-y-4 px-6 py-5">
          <Field label="상호" required>
            <Text value={form.name} onChange={(v) => set('name', v)} disabled={!editable} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="대표자명" invoice>
              <Text
                value={form.ceoName}
                onChange={(v) => set('ceoName', v)}
                disabled={!editable}
              />
            </Field>

            <Field label="사업자등록번호" invoice>
              <Text
                value={form.bizNo}
                onChange={(v) => set('bizNo', v)}
                placeholder="000-00-00000"
                disabled={!editable}
              />
            </Field>
          </div>

          <Field label="주소" invoice>
            <Text value={form.address} onChange={(v) => set('address', v)} disabled={!editable} />
          </Field>

          {/* 팩스는 정산서가 가는 곳이라 아래 '받을 곳' 옆으로 옳겼습니다 */}
          <Field label="대표 전화번호">
            <Text
              value={form.tel}
              onChange={(v) => set('tel', v)}
              placeholder="02-000-0000"
              disabled={!editable}
            />
          </Field>

          <hr className="border-[#E8EBF0]" />

          {/*
            ★ 정산서를 어디로 받을지 (사용자 요청 2026-08-12).
              고른 곳은 값이 있어야 저장됩니다 — 이메일로 받겠다고 해 놓고
              칸이 비어 있으면 정산서가 갈 데가 없습니다. 마감을 누르고 며칠
              뒤에야 "안 왔다" 는 전화를 받습니다.
          */}
          <div>
            <span className="mb-1 block text-[12px] font-semibold text-[#4A5567]">
              정산서 받을 곳
            </span>
            <div className="flex gap-1.5">
              {INVOICE_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setMethod(method)}
                  disabled={!editable}
                  aria-pressed={form.invoiceMethod === method}
                  className={
                    'h-10 flex-1 rounded-md border text-[13px] font-semibold disabled:opacity-60 ' +
                    (form.invoiceMethod === method
                      ? 'border-[#12855B] bg-[#E6F4EE] text-[#12855B]'
                      : 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]')
                  }
                >
                  {form.invoiceMethod === method && <span className="mr-1">✓</span>}
                  {INVOICE_METHOD_LABEL[method]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="청구서 수신 이메일"
              want={wantsEmail(form.invoiceMethod)}
              missing={wantsEmail(form.invoiceMethod) && !form.invoiceEmail.trim()}
            >
              <Text
                value={form.invoiceEmail}
                onChange={(v) => set('invoiceEmail', v)}
                placeholder="invoice@example.com"
                disabled={!editable}
              />
            </Field>

            <Field
              label="팩스 번호"
              want={wantsFax(form.invoiceMethod)}
              missing={wantsFax(form.invoiceMethod) && !form.fax.trim()}
            >
              <Text
                value={form.fax}
                onChange={(v) => set('fax', v)}
                placeholder="02-000-0000"
                disabled={!editable}
              />
            </Field>
          </div>

          <Field label="세금계산서 수신 이메일">
            <Text
              value={form.taxEmail}
              onChange={(v) => set('taxEmail', v)}
              placeholder="tax@example.com"
              disabled={!editable}
            />
          </Field>

          {/*
            ★ 정산 기준일은 여기서 못 바꿉니다.
              바꾸면 자기 청구 기간을 스스로 옮기는 셈이 됩니다.
              디자인센터가 사용자탭에서 정합니다.
          */}
          {org.orgType !== 'design_center' && (
            <Field label="정산 기준일">
              <span className="flex h-10 items-center rounded-md bg-[#F8F9FB] px-3 text-[13px] text-[#4A5567]">
                매월 {org.closingDay}일
              </span>
            </Field>
          )}
        </div>

        {error && <p className="px-6 pb-2 text-[12.5px] text-[#D8453F]">{error}</p>}

        {/* ---------- 아래줄 ---------- */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E8EBF0] px-6 py-4">
          {/*
            ★ 여기 말고는 갈 데가 없는 화면들입니다 (사용자 요청 2026-08-13).
              사이드바에 자리가 없어 주소를 직접 쳐야만 열렸습니다.

              ① **직원 계정은 디자인센터에만** 답니다.
                 치과·기공소는 사이드바 '사용자' 탭이 곧 직원 계정입니다.
                 디자인센터만 그 탭을 거래처(치과·기공소) 관리가 쓰고 있어,
                 우리 직원 계정이 계정정보 밑으로 밀려나 있었습니다.
                 관리자만 열립니다 (`requireManagerSector`).

              ② **열람 기록 링크는 안 답니다.** 사용자가 두 번 빼라고
                 했습니다 (2026-08-12, 2026-08-13 — *"너무 불필요한
                 기능이다"*). 중간에 한 번 다시 달았다가 도로 뺐습니다.
                 **또 달지 마세요.**

                 ★ 기록 자체는 그대로 남습니다. `record_access` 는 계속
                   돌고, 보관기간 화면의 '열람 기록' 항목도 그대로입니다.
                   처리방침도 "남긴다" 라고 적혀 있으므로 **사실과
                   어긋나지 않습니다.** 없앤 것은 **보러 가는 길**뿐입니다.
                   화면(`/{sector}/account/audit`)도 주소로는 열립니다.
          */}
          <div className="mr-auto flex flex-wrap items-center gap-2">
            {editable && (
              <Link href={`${basePath}/account/retention`} className={SUB_LINK}>
                보관기간·파기
              </Link>
            )}

            {editable && org.orgType === 'design_center' && (
              <Link href={`${basePath}/account/members`} className={SUB_LINK}>
                직원 계정
              </Link>
            )}

            {!editable && (
              <span className="text-[12px] text-[#98A2B3]">관리자만 고칠 수 있습니다.</span>
            )}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy || !editable}
            className="h-10 rounded-md px-5 text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#C4CBD6]"
            style={editable && !busy ? { background: 'var(--brand)' } : undefined}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      <div className="pb-10" />
    </div>
  );
}

// ---------- 조각들 ----------

function Field({
  label,
  required,
  invoice,
  want,
  missing,
  children,
}: {
  label: string;
  required?: boolean;
  /** 청구서에 실리는 칸 */
  invoice?: boolean;
  /** 정산서를 여기로 받겠다고 고른 칸 */
  want?: boolean;
  /** 고른 곳인데 비어 있는가 */
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-[#4A5567]">
        {label}
        {required && <b className="font-bold text-[#D8453F]">*</b>}
        {invoice && (
          <span className="rounded bg-[#F4F6F9] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#98A2B3]">
            청구서
          </span>
        )}
        {want && (
          <span className="font-bold text-[#12855B]" title="정산서를 여기로 받습니다">
            ✓
          </span>
        )}
        {missing && (
          <span className="font-normal text-[#D8453F]">여기로 받겠다고 했는데 비어 있습니다</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Text({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#1279E8] disabled:bg-[#F8F9FB] disabled:text-[#98A2B3]"
    />
  );
}
