// =========================================================
// 놓을 위치: src/components/account/TermsBoard.tsx
//
// 이용약관 시행일을 정하는 화면. 디자인센터 관리자만.
//
// ★ 칸이 하나뿐입니다.
//   약관 본문은 코드(domain/terms)에 있고, 상호·사업자등록번호·연락처는
//   계정정보에서 읽습니다. 여기서 정할 것은 **언제부터 시행하는가** 하나입니다.
//
// ★ 그래서 날짜만 두지 않고 그게 무슨 뜻인지 적어 둡니다.
//   이 칸을 채우는 순간 공개 화면에서 '초안' 딱지가 떨어집니다.
//   무심코 오늘 날짜를 넣으면 검토 안 끝난 문서가 정식 약관이 됩니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitTermsEffectiveOn } from '@/server/actions/account';
import { isDraft, missingTermsFields, type TermsFacts } from '@/server/domain/terms';

export default function TermsBoard({ facts }: { facts: TermsFacts }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [effectiveOn, setEffectiveOn] = useState(facts.effectiveOn ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const draft = isDraft(facts);
  const missing = missingTermsFields(facts);

  async function save() {
    setError('');
    setNote('');
    setSaving(true);

    const result = await submitTermsEffectiveOn(effectiveOn || null);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNote('저장했습니다.');
    startTransition(() => router.refresh());
  }

  return (
    <section className="rounded-lg border border-[#E8EBF0] bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#E8EBF0] px-6 py-4">
        <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#1A2130]">이용약관</h2>
        {/* ★ 저장하고 나가서 확인하는 길이 없으면 무엇이 공개됐는지 아무도 안 봅니다 */}
        <Link
          href="/terms"
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[13px] font-semibold text-[#1279E8] hover:underline"
        >
          공개 화면 보기 ↗
        </Link>
      </header>

      <div className="px-6 py-5">
        {draft ? (
          <p className="rounded-lg border border-[#F0D9A8] bg-[#FEF8EC] px-4 py-3 text-[13.5px] leading-relaxed text-[#8A6320]">
            지금 공개 화면에는 <b className="font-bold">&lsquo;초안입니다&rsquo;</b>라고 뜹니다.{' '}
            <b className="font-bold">시행일을 넣으면</b> 그 딱지가 떨어지고 정식 약관이 됩니다.
            법률 검토를 마친 뒤에 넣어 주세요.
          </p>
        ) : (
          <p className="rounded-lg border border-[#CFE3F8] bg-[#F2F7FE] px-4 py-3 text-[13.5px] leading-relaxed text-[#2C5D97]">
            <b className="font-bold">{facts.effectiveOn} 시행 중입니다.</b> 공개 화면에 정식
            약관으로 나갑니다. 비우면 다시 초안으로 되돌아갑니다.
          </p>
        )}

        {missing.length > 0 && (
          <p className="mt-3 text-[13px] leading-relaxed text-[#B3312C]">
            아직 안 채운 것: {missing.join(', ')}
            {/* ★ 상호·사업자등록번호·주소는 계정정보에서 읽습니다.
                  여기서 또 받으면 두 곳이 어긋납니다 */}
            <span className="text-[#98A2B3]">
              {' '}
              (시행일 말고는 계정정보 화면에서 채웁니다)
            </span>
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[#7C8595]">시행일</span>
            <input
              type="date"
              value={effectiveOn}
              onChange={(e) => setEffectiveOn(e.target.value)}
              className="h-10 rounded-md border border-[#DDE2EA] px-3 text-[14px] text-[#1A2130] outline-none focus:border-[#1279E8]"
            />
          </label>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 rounded-md bg-[#1279E8] px-5 text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#C4CBD6]"
          >
            {saving ? '저장 중…' : '저장'}
          </button>

          {note && <span className="text-[13px] text-[#2E7D5B]">{note}</span>}
          {error && <span className="text-[13px] text-[#D8453F]">{error}</span>}
        </div>
      </div>
    </section>
  );
}
