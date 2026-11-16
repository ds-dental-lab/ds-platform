// =========================================================
// 놓을 위치: src/components/site/ContactForm.tsx
//
// 홈페이지 수가표 요청 폼.
//
// ★ 홈페이지에서 제일 중요한 칸입니다.
//   보고 마음이 동한 사람이 전화를 걸까 말까 망설이는 그 순간에,
//   치과명과 연락처만 남기고 갈 수 있어야 합니다.
//
// ★★ **한 번에 하나씩 묻습니다** (사용자 2026-11-16 — 시안을 보고 "진행해줘").
//   전에는 두 토막을 한 화면에 다 보였습니다. 묻는 것은 그때와 똑같습니다 —
//   스캐너 · 불만족점(선택) · 치과명 · 연락처 · 이메일 · 동의. 순서와 방식만 바꿨습니다.
//
// ★ 누르기만 하면 되는 질문을 앞에 뒀습니다. 첫 화면이 빈 칸 셋이면 거기서 닫지만,
//   단추 하나를 누르고 나면 끝까지 가기 쉽습니다. 연락처는 맨 마지막에 묻습니다.
//
// ★ 보내고 나면 화면을 통째로 바꿉니다.
//   "보냈습니다" 를 폼 아래에 작게 띄우면 두 번 세 번 누릅니다.
//
// ★ 담당자 성함·지역·'더 하실 말씀' 은 안 받습니다 (사용자 2026-09-04). 다시 넣지 마세요.
// ★ 스캐너는 기본값을 안 둡니다. 미리 골라 두면 안 읽고 넘어갑니다.
// ★ 동의 문구는 domain/contact 가 쥡니다 — 화면과 처리방침이 같은 뜻이어야 합니다.
// =========================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { submitContact } from '@/server/actions/contact';
import {
  SCANNER_LABEL,
  PAIN_LABEL,
  CONSENT,
  type ContactScanner,
  type PainPoint,
} from '@/server/domain/contact';

const TOTAL = 4;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1279E8]';

export default function ContactForm() {
  const [step, setStep] = useState(1);
  const [scanner, setScanner] = useState<ContactScanner | ''>('');
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [clinicName, setClinicName] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function togglePain(p: PainPoint) {
    setPainPoints((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  function go(n: number) {
    setError('');
    setStep(n);
  }

  async function send() {
    setError('');
    setSending(true);
    const result = await submitContact({ clinicName, tel, email, agreed, scanner, painPoints });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center">
        <h3 className="text-[22px] font-extrabold tracking-[-0.03em]">보내 주셔서 고맙습니다</h3>
        <p className="mt-4 text-[15.5px] leading-[1.75] text-[#3D4E60]">
          남겨 주신 연락처로 <b className="font-bold text-[#14263A]">영업일 기준 1일 안에</b> 연락드리겠습니다.
          <br />
          급하시면 <a href="tel:01033653145" className="font-bold text-[#1279E8]">010-3365-3145</a> 로 전화 주셔도 됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-7 sm:p-10">
      {/* 지금 몇 번째인지 — 막대 넷 */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className={'h-1 flex-1 rounded-full transition-colors duration-300 ' + (i < step ? 'bg-[#16324F]' : 'bg-[#E3E8EB]')}
            />
          ))}
        </div>
        <span className="text-[13.5px] font-semibold tabular-nums text-[#5B6C7D]">
          {step} / {TOTAL}
        </span>
      </div>

      {/* 높이를 잡아 둡니다 — 질문이 바뀔 때 아래 화면이 들썩이지 않게 */}
      <div className="mt-8 min-h-[300px]" aria-live="polite">
        {step === 1 && (
          <Question title="구강스캐너를 쓰고 계신가요?" hint="누르시면 다음으로 넘어갑니다">
            <div className="grid gap-2.5">
              {(Object.keys(SCANNER_LABEL) as ContactScanner[]).map((v) => (
                <Tap
                  key={v}
                  on={scanner === v}
                  onClick={() => {
                    setScanner(v);
                    go(2);
                  }}
                >
                  {SCANNER_LABEL[v]}
                </Tap>
              ))}
            </div>
          </Question>
        )}

        {step === 2 && (
          <Question
            title="지금 거래하는 기공소에 불만족하는 점이 있으신가요?"
            hint="여러 개 골라도 됩니다 · 없으면 그냥 다음으로"
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(Object.keys(PAIN_LABEL) as PainPoint[]).map((v) => (
                <Tap key={v} on={painPoints.includes(v)} onClick={() => togglePain(v)} check>
                  {PAIN_LABEL[v]}
                </Tap>
              ))}
            </div>
          </Question>
        )}

        {step === 3 && (
          <Question title="치과 이름을 알려 주세요">
            <Input value={clinicName} onChange={setClinicName} placeholder="○○치과의원" autoFocus onEnter={() => clinicName.trim() && go(4)} />
          </Question>
        )}

        {step === 4 && (
          <Question title="수가표를 어디로 보내 드릴까요?">
            <div className="grid gap-4">
              <label className="block">
                <span className="block text-[14.5px] font-bold text-[#3D4E60]">이메일</span>
                <div className="mt-2">
                  <Input value={email} onChange={setEmail} placeholder="doctor@clinic.co.kr" type="email" autoFocus />
                </div>
              </label>
              <label className="block">
                <span className="block text-[14.5px] font-bold text-[#3D4E60]">연락처</span>
                <div className="mt-2">
                  <Input value={tel} onChange={setTel} placeholder="010-0000-0000" type="tel" />
                </div>
              </label>

              <label className="mt-1 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[#1279E8]"
                />
                <span className="text-[14px] leading-relaxed text-[#3D4E60]">
                  {CONSENT.line}.{' '}
                  <span className="whitespace-nowrap">
                    <b className="font-bold text-[#14263A]">동의합니다</b>
                    <Link href="/privacy" target="_blank" className="ml-2 font-semibold text-[#1279E8] underline underline-offset-2">
                      처리방침
                    </Link>
                  </span>
                </span>
              </label>
            </div>
          </Question>
        )}
      </div>

      {error && <p role="alert" className="mt-4 text-[14.5px] font-semibold text-[#D8453F]">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className={`h-[52px] rounded-lg px-5 text-[15px] font-bold text-[#5B6C7D] hover:text-[#14263A] ${FOCUS}`}
          >
            이전
          </button>
        )}

        {step === 2 && (
          <Primary onClick={() => go(3)}>{painPoints.length ? '다음' : '없어요, 다음'}</Primary>
        )}
        {step === 3 && (
          <Primary onClick={() => go(4)} disabled={!clinicName.trim()}>
            다음
          </Primary>
        )}
        {step === 4 && (
          <Primary onClick={send} disabled={sending}>
            {sending ? '보내는 중…' : '수가표 요청하기'}
          </Primary>
        )}
      </div>
    </div>
  );
}

// ---------- 조각 ----------

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-balance break-keep text-[22px] font-extrabold leading-[1.35] tracking-[-0.035em] text-[#14263A] sm:text-[24px]">
        {title}
      </h3>
      {hint && <p className="mt-2 text-[14px] text-[#5B6C7D]">{hint}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** 누르는 답. check 면 여러 개 고르는 답이라 오른쪽에 표시가 붙습니다 */
function Tap({
  on,
  onClick,
  check = false,
  children,
}: {
  on: boolean;
  onClick: () => void;
  check?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        `flex h-[58px] items-center justify-between rounded-xl border px-5 text-left text-[16.5px] font-bold transition-colors ${FOCUS} ` +
        (on
          ? 'border-[#16324F] bg-[#16324F] text-white'
          : 'border-[#C9D3D9] bg-white text-[#14263A] hover:border-[#16324F]')
      }
    >
      {children}
      {check && (
        <svg aria-hidden viewBox="0 0 20 20" className={'h-5 w-5 ' + (on ? 'opacity-100' : 'opacity-0')} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10.5 8 14.5 16 5.5" />
        </svg>
      )}
    </button>
  );
}

function Primary({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-[52px] flex-1 rounded-lg bg-[#1279E8] text-[16px] font-extrabold tracking-[-0.02em] text-white hover:bg-[#0F68C9] disabled:bg-[#D5DAE2] ${FOCUS}`}
    >
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // 한글 조합 중의 Enter 는 넘기지 않습니다 — 마지막 글자가 두 번 들어갑니다
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) onEnter?.();
      }}
      placeholder={placeholder}
      className="h-[56px] w-full rounded-xl border border-[#C9D3D9] px-4 text-[17px] outline-none focus:border-[#16324F]"
    />
  );
}
