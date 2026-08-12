// =========================================================
// 놓을 위치: src/components/account/PrivacyBoard.tsx
//
// 처리방침에 실릴 값을 정하는 화면. 디자인센터 관리자만.
//
// ★ 여기서 정한 것이 공개 화면(/privacy)에 그대로 나갑니다.
//   그래서 '미리 보기' 링크를 옆에 둡니다 — 저장하고 나가서 확인하는
//   길이 없으면, 무엇이 공개됐는지 아무도 안 봅니다.
//
// ★ 시행일을 넣는 것이 곧 공개입니다.
//   비어 있는 동안 공개 화면은 '초안' 이라고 밝힙니다. 그래서 이 칸에는
//   날짜만 두지 않고 그게 무슨 뜻인지 적어 둡니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitPrivacySettings, submitPrivacyOfficer } from '@/server/actions/account';
import { missingFields, isDraft, type PolicyFacts } from '@/server/domain/privacy';
import type { SeatOption } from '@/server/repositories/member';

export interface PrivacyBoardProps {
  facts: PolicyFacts;
  officerUserId: string | null;
  seats: SeatOption[];
}

export default function PrivacyBoard({ facts, officerUserId, seats }: PrivacyBoardProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const [dept, setDept] = useState(facts.officerDept ?? '');
  const [tel, setTel] = useState(facts.officerTel ?? '');
  const [email, setEmail] = useState(facts.officerEmail ?? '');
  const [effectiveOn, setEffectiveOn] = useState(facts.effectiveOn ?? '');
  const [officer, setOfficer] = useState(officerUserId ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const missing = missingFields(facts);
  const draft = isDraft(facts);

  async function save() {
    setError('');
    setNote('');
    setSaving(true);

    const result = await submitPrivacySettings({
      officerDept: dept,
      officerTel: tel,
      officerEmail: email,
      effectiveOn: effectiveOn || null,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNote('저장했습니다.');
    startTransition(() => router.refresh());
  }

  async function changeOfficer(next: string) {
    const before = officer;

    setOfficer(next);
    setError('');
    setSaving(true);

    const result = await submitPrivacyOfficer(next);
    setSaving(false);

    if (!result.ok) {
      setOfficer(before);
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ★ 지금 공개 상태가 어떤지를 맨 위에 둡니다 */}
      <div
        className={
          'rounded-lg border px-4 py-3.5 text-[13px] leading-relaxed ' +
          (draft
            ? 'border-[#F0D9A8] bg-[#FEF8EC] text-[#8A6320]'
            : 'border-[#BFE3D2] bg-[#EAF7F1] text-[#12664A]')
        }
      >
        {draft ? (
          <>
            <b className="font-bold">지금은 초안입니다.</b> 공개 화면에 &lsquo;아직 법률 검토를
            거치지 않았다&rsquo;고 표시됩니다. <b className="font-bold">시행일을 넣으면</b> 그
            표시가 사라지고 정식 처리방침이 됩니다.
          </>
        ) : (
          <>
            <b className="font-bold">{facts.effectiveOn} 시행 중입니다.</b> 공개 화면에 정식
            처리방침으로 표시됩니다.
          </>
        )}
      </div>

      {missing.length > 0 && (
        <p className="rounded-lg border border-[#F3C6C6] bg-[#FDECEA] px-4 py-3 text-[12.5px] font-semibold text-[#B3312C]">
          아직 빈 칸: {missing.join(' · ')}
        </p>
      )}

      <section className="rounded-[10px] border border-[#E8EBF0] bg-white">
        <header className="flex flex-wrap items-center gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14px] font-bold text-[#1A2130]">개인정보 보호책임자</h2>
          <Link
            href="/privacy"
            target="_blank"
            className="ml-auto text-[12.5px] font-semibold text-[#1279E8] hover:underline"
          >
            공개 화면 보기 ↗
          </Link>
        </header>

        <div className="flex flex-col gap-4 px-5 py-5">
          <Field label="성명">
            {/*
              ★ 이름을 글자로 안 받습니다. 계정을 가리킵니다 —
                사람이 바뀌면 문서도 따라가야 합니다.
            */}
            <select
              value={officer}
              disabled={saving || refreshing}
              onChange={(e) => changeOfficer(e.target.value)}
              className="h-10 w-full rounded-md border border-[#DDE2EA] bg-white px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
            >
              {!officer && <option value="">고르세요</option>}
              {seats.map((seat) => (
                <option key={seat.userId} value={seat.userId}>
                  {seat.name}
                </option>
              ))}
            </select>
            <Hint>이 계정의 이름이 처리방침에 그대로 나갑니다.</Hint>
          </Field>

          <Field label="부서 (없으면 비워 두세요)">
            <Input value={dept} onChange={setDept} placeholder="없으면 비워 두세요" />
            <Hint>비우면 처리방침에 부서 줄이 아예 안 나옵니다.</Hint>
          </Field>

          <Field label="연락처">
            <Input value={tel} onChange={setTel} placeholder="비우면 회사 대표번호를 씁니다" />
          </Field>

          <Field label="전자우편">
            <Input value={email} onChange={setEmail} placeholder="비우면 계정 이메일을 씁니다" />
            <Hint>공개되는 주소입니다. 개인 메일이 부담되면 따로 만드는 편이 낫습니다.</Hint>
          </Field>

          <Field label="시행일">
            <input
              type="date"
              value={effectiveOn}
              onChange={(e) => setEffectiveOn(e.target.value)}
              className="h-10 w-[190px] rounded-md border border-[#DDE2EA] px-3 text-[13.5px] tabular-nums outline-none focus:border-[#1279E8]"
            />
            <Hint>
              <b className="font-bold text-[#8A6320]">법률 검토를 마친 뒤에</b> 넣으세요. 비우면
              다시 초안으로 돌아갑니다.
            </Hint>
          </Field>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#F0F2F5] pt-4">
            <button
              type="button"
              onClick={save}
              disabled={saving || refreshing}
              className="h-9 rounded-md bg-[#1279E8] px-4 text-[12.5px] font-bold text-white hover:bg-[#0F68C9] disabled:bg-[#D5DAE2]"
            >
              {saving ? '저장 중…' : '저장'}
            </button>

            {note && <span className="text-[12.5px] font-semibold text-[#12855B]">{note}</span>}
            {error && <span className="text-[12.5px] font-semibold text-[#B3312C]">{error}</span>}
          </div>
        </div>
      </section>

      <p className="px-1 text-[12px] leading-relaxed text-[#98A2B3]">
        보관기간·수탁자·사업자 정보는 여기서 따로 적지 않습니다. 각각{' '}
        <b className="font-semibold text-[#7C8595]">보관기간·파기</b>,{' '}
        <b className="font-semibold text-[#7C8595]">사용자</b>,{' '}
        <b className="font-semibold text-[#7C8595]">계정정보</b> 화면의 값을 처리방침이 그대로
        읽어 갑니다 — 두 곳에 적으면 언젠가 서로 어긋납니다.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5567]">{label}</span>
      {children}
    </label>
  );
}

function Input({
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
      className="h-10 w-full rounded-md border border-[#DDE2EA] px-3 text-[13.5px] outline-none focus:border-[#1279E8]"
    />
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="mt-1.5 block text-[11.5px] leading-relaxed text-[#98A2B3]">{children}</span>;
}
