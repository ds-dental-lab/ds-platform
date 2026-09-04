// =========================================================
// 놓을 위치: src/components/site/ContactForm.tsx
//
// 홈페이지 수가표·상담 요청 폼.
//
// ★ 홈페이지에서 제일 중요한 칸입니다.
//   보고 마음이 동한 사람이 전화를 걸까 말까 망설이는 그 순간에,
//   이름과 연락처만 남기고 갈 수 있어야 합니다.
//
// ★ 보내고 나면 화면을 통째로 바꿉니다.
//   "보냈습니다" 를 폼 아래에 작게 띄우면 두 번 세 번 누릅니다.
// =========================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { submitContact } from '@/server/actions/contact';
import {
  KIND_LABEL,
  SCANNER_LABEL,
  PAIN_LABEL,
  CONSENT,
  type ContactKind,
  type ContactScanner,
  type PainPoint,
} from '@/server/domain/contact';

export default function ContactForm() {
  const [clinicName, setClinicName] = useState('');
  const [personName, setPersonName] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<ContactKind>('price_list');
  const [message, setMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  // ★ 스캐너는 기본값을 안 둡니다. 미리 골라 두면 안 읽고 넘어갑니다
  const [scanner, setScanner] = useState<ContactScanner | ''>('');
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);

  function togglePain(p: PainPoint) {
    setPainPoints((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    setError('');
    setSending(true);

    const result = await submitContact({
      clinicName, personName, tel, email, kind, message, agreed, scanner, painPoints,
    });

    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#BFE3D2] bg-white p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#EAF7F1]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#12855B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </span>
        <h3 className="mt-5 text-[19px] font-extrabold tracking-[-0.03em]">보내 주셔서 고맙습니다</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-[#4A5567]">
          남겨 주신 연락처로 <b className="font-bold text-[#1A2130]">영업일 기준 1일 안에</b> 연락드리겠습니다.
          <br />
          급하시면 <a href="tel:01033653145" className="font-bold text-[#1279E8]">010-3365-3145</a> 로 전화 주셔도 됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E8EBF0] bg-white p-7 sm:p-9">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="치과명" required>
          <Input value={clinicName} onChange={setClinicName} placeholder="○○치과의원" />
        </Field>

        <Field label="원장님 · 담당자 성함" required>
          <Input value={personName} onChange={setPersonName} placeholder="홍길동" />
        </Field>

        <Field label="연락처" required>
          <Input value={tel} onChange={setTel} placeholder="010-0000-0000" type="tel" />
        </Field>

        <Field label="이메일" required hint="수가표를 이 주소로 보내 드립니다">
          <Input value={email} onChange={setEmail} placeholder="doctor@clinic.co.kr" type="email" />
        </Field>
      </div>

      <div className="mt-5">
        <Label required>무엇을 도와드릴까요</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(KIND_LABEL) as ContactKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={
                'h-12 rounded-lg border px-4 text-left text-[14px] font-semibold transition ' +
                (kind === k
                  ? 'border-[#1279E8] bg-[#F2F7FE] text-[#1279E8] shadow-[0_0_0_3px_rgba(18,121,232,.10)]'
                  : 'border-[#DDE2EA] text-[#4A5567] hover:border-[#B6C6DC]')
              }
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {/*
        ★ 질문 둘 (사용자 요청 2026-08-28). 네이버폼으로 옮기는 대신
          여기 넣었습니다 — 문의가 두 군데로 갈리지 않게.
      */}
      <div className="mt-5">
        <Label required>구강스캐너 보유 여부</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(Object.keys(SCANNER_LABEL) as ContactScanner[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={scanner === v}
              onClick={() => setScanner(v)}
              className={
                'h-12 rounded-lg border px-3 text-[14px] font-semibold transition ' +
                (scanner === v
                  ? 'border-[#1279E8] bg-[#F2F7FE] text-[#1279E8] shadow-[0_0_0_3px_rgba(18,121,232,.10)]'
                  : 'border-[#DDE2EA] text-[#4A5567] hover:border-[#B6C6DC]')
              }
            >
              {SCANNER_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <Label>현재 거래 기공소에 불만족하는 점 (복수 선택 · 선택)</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(PAIN_LABEL) as PainPoint[]).map((v) => {
            const on = painPoints.includes(v);
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => togglePain(v)}
                className={
                  'h-10 rounded-full border px-4 text-[13.5px] font-semibold transition ' +
                  (on
                    ? 'border-[#1279E8] bg-[#1279E8] text-white'
                    : 'border-[#DDE2EA] text-[#4A5567] hover:border-[#B6C6DC]')
                }
              >
                {PAIN_LABEL[v]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <Label>문의사항 (선택)</Label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="쓰시는 스캐너, 월 물량, 원하시는 납기 등을 적어 주시면 맞춰 안내드리겠습니다."
          className="mt-2 w-full rounded-lg border border-[#DDE2EA] px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-[#1279E8]"
        />
      </div>

      {/* ★ 동의 문구는 domain/contact 가 쥡니다 — 화면과 저장이 같은 글을 봐야 합니다 */}
      <label className="mt-5 flex cursor-pointer gap-3 rounded-lg bg-[#F7FAFF] p-4">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-[17px] w-[17px] shrink-0 accent-[#1279E8]"
        />
        <span className="text-[13.5px] leading-relaxed text-[#4A5567]">
          <b className="font-bold text-[#1A2130]">개인정보 수집·이용에 동의합니다</b> (필수)
          <br />
          수집 항목 {CONSENT.items} · 목적 {CONSENT.purpose} · {CONSENT.keep}.{' '}
          <Link href="/privacy" target="_blank" className="font-semibold text-[#1279E8] underline">
            처리방침
          </Link>
        </span>
      </label>

      {error && <p className="mt-3 text-[14px] font-semibold text-[#D8453F]">{error}</p>}

      <button
        type="button"
        onClick={send}
        disabled={sending}
        className="mt-5 h-13 w-full rounded-lg bg-[#1279E8] py-4 text-[15.5px] font-extrabold tracking-[-0.02em] text-white hover:bg-[#0F68C9] disabled:bg-[#D5DAE2]"
      >
        {sending ? '보내는 중…' : '수가표 요청하기'}
      </button>
    </div>
  );
}

// ---------- 조각 ----------

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-1.5 block text-[12.5px] text-[#98A2B3]">{hint}</span>}
    </label>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="block text-[13.5px] font-bold text-[#4A5567]">
      {children}
      {required && <span className="ml-1 text-[#D8453F]">*</span>}
    </span>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-lg border border-[#DDE2EA] px-3.5 text-[14.5px] outline-none focus:border-[#1279E8]"
    />
  );
}
