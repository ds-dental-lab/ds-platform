// =========================================================
// 놓을 위치: src/app/terms/page.tsx
//
// 이용약관. (사용자 요청 2026-08-19)
//
// ★ 로그인 없이 열립니다.
//   가입하기 전에 읽어야 하는 문서입니다. 로그인해야 보이는 약관은
//   동의를 받을 수 없습니다.
//
// ★ 숫자와 이름을 이 파일에 안 씁니다.
//   본문은 domain/terms, 상호·사업자등록번호·연락처·시행일은
//   organizations 에서 읽습니다. 처리방침(/privacy)과 같은 방식입니다.
//
// ★ 시행일이 없으면 '초안' 이라고 밝힙니다.
//   법률 검토를 안 거친 문서가 공개된 약관 행세를 하면 안 됩니다.
//   지금은 사업자등록 전이라 비어 있는 것이 맞습니다.
// =========================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTermsFacts } from '@/server/repositories/terms';
import { isDraft, CHAPTERS, type Article } from '@/server/domain/terms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // ★ 상호를 여기 또 적지 않습니다. 뿌리 레이아웃의 틀이 붙습니다.
  title: '이용약관',
};

export default async function TermsPage() {
  const facts = await getTermsFacts();
  const draft = isDraft(facts);
  const company = facts.orgName ?? '회사';

  // ★ 안 채운 칸은 가운뎃점만 남기지 않고 통째로 빠집니다
  const contact = [
    facts.orgName,
    facts.bizNo && `사업자등록번호 ${facts.bizNo}`,
    facts.address,
    facts.tel,
    facts.email,
  ].filter((v): v is string => Boolean(v?.trim()));

  return (
    <main className="mx-auto max-w-[760px] px-6 py-12 text-[#1A2130]">
      <header className="border-b border-[#E8EBF0] pb-6">
        <Link href="/login" className="text-[13.5px] font-semibold text-[#1279E8] hover:underline">
          ← DenFlow
        </Link>
        <h1 className="mt-3 text-[26px] font-extrabold tracking-[-0.04em]">이용약관</h1>
        <p className="mt-2 text-[14px] text-[#7C8595]">
          {facts.effectiveOn ? `${facts.effectiveOn} 시행` : '시행일이 정해지지 않았습니다'}
        </p>
      </header>

      {/* ★ 검토 전이라는 것을 감추지 않습니다 */}
      {draft && (
        <p className="mt-6 rounded-lg border border-[#F0D9A8] bg-[#FEF8EC] px-4 py-3.5 text-[14px] leading-relaxed text-[#8A6320]">
          <b className="font-bold">초안입니다.</b> 아직 법률 검토를 거치지 않았고 시행일이
          정해지지 않았습니다. 이 문서는 시스템이 실제로 하는 일을 그대로 옮긴 것으로,
          공개 전에 검토를 받아야 합니다.
        </p>
      )}

      {/*
        ★ 상호를 못 읽었을 때 "회사(이하 '회사')는" 이 되지 않게 갈라 줍니다.
          이름이 없으면 낱말을 정의할 것도 없습니다 — 그냥 '회사' 로 부릅니다.
          (DB 를 못 읽는 길이 실제로 있습니다. repositories/terms 참고)
      */}
      <p className="mt-7 text-[13.5px] leading-relaxed text-[#4A5567]">
        {facts.orgName ? (
          <>
            <b className="font-bold text-[#1A2130]">{company}</b>(이하 &lsquo;회사&rsquo;)는
          </>
        ) : (
          <b className="font-bold text-[#1A2130]">회사</b>
        )}
        {facts.orgName ? ' ' : '는 '}
        보철 제작주문 플랫폼 <b className="font-bold text-[#1A2130]">DenFlow</b>(이하
        &lsquo;서비스&rsquo;)의 이용에 관하여 회원과 다음과 같이 약관을 정합니다.
      </p>

      {/* ---------- 목차 ---------- */}
      <nav className="mt-8 rounded-lg border border-[#E8EBF0] bg-[#F8F9FB] px-5 py-4">
        <h2 className="text-[13px] font-bold text-[#7C8595]">목차</h2>
        <ol className="mt-3 space-y-3">
          {CHAPTERS.map((chapter) => (
            <li key={chapter.n}>
              <b className="text-[13px] font-bold text-[#1A2130]">
                {chapter.n} {chapter.title}
              </b>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {chapter.articles.map((article) => (
                  <li key={article.n}>
                    <a
                      href={`#article-${article.n}`}
                      className="text-[12.5px] text-[#4A5567] hover:text-[#1279E8] hover:underline"
                    >
                      제{article.n}조 {article.title}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </nav>

      {/* ---------- 본문 ---------- */}
      {CHAPTERS.map((chapter) => (
        <section key={chapter.n} className="mt-10">
          <h2 className="border-b border-[#E8EBF0] pb-2 text-[16.5px] font-extrabold tracking-[-0.03em]">
            <span className="text-[#98A2B3]">{chapter.n}</span> {chapter.title}
          </h2>
          {chapter.articles.map((article) => (
            <ArticleBlock key={article.n} article={article} />
          ))}
        </section>
      ))}

      {/* ---------- 부칙 ---------- */}
      <section className="mt-10">
        <h2 className="border-b border-[#E8EBF0] pb-2 text-[16.5px] font-extrabold tracking-[-0.03em]">
          부칙
        </h2>
        <p className="mt-4 text-[13.5px] leading-relaxed text-[#4A5567]">
          {facts.effectiveOn ? (
            <>이 약관은 {facts.effectiveOn}부터 시행합니다.</>
          ) : (
            <span className="text-[#B3312C]">시행일이 정해지지 않았습니다.</span>
          )}
        </p>
      </section>

      <footer className="mt-12 border-t border-[#E8EBF0] pt-6 text-[13.5px] leading-relaxed text-[#98A2B3]">
        {/*
          ★ 채운 것이 하나도 없으면 '문의처' 제목만 덩그러니 남습니다.
            빈 제목은 고장으로 보입니다 — 아예 안 냅니다.
        */}
        {contact.length > 0 && (
          <>
            <p className="mb-2 font-semibold text-[#7C8595]">문의처</p>
            <p>{contact.join(' · ')}</p>
          </>
        )}
        <p className="mt-3">
          개인정보의 처리에 관한 사항은{' '}
          <Link href="/privacy" className="font-semibold text-[#1279E8] hover:underline">
            개인정보 처리방침
          </Link>
          에서 정합니다.
        </p>
      </footer>
    </main>
  );
}

// ---------- 조각들 ----------

function ArticleBlock({ article }: { article: Article }) {
  return (
    <article id={`article-${article.n}`} className="mt-7 scroll-mt-6">
      <h3 className="text-[15px] font-extrabold tracking-[-0.02em]">
        <span className="text-[#98A2B3]">제{article.n}조</span> ({article.title})
      </h3>

      <div className="mt-2.5 space-y-3">
        {article.paras.map((para, i) => (
          <div key={i}>
            <p className="text-[13.5px] leading-relaxed text-[#4A5567]">
              {/* ★ 항 번호는 화면이 붙입니다. 글에 박아 두면 조를 하나
                    끼워 넣을 때 번호를 손으로 다 고쳐야 합니다 */}
              {!article.plain && (
                <span className="mr-1 font-semibold text-[#7C8595]">({i + 1})</span>
              )}
              {para.text}
            </p>

            {para.items && (
              <ol className="mt-2 space-y-1.5 pl-1">
                {para.items.map((item, k) => (
                  <li
                    key={k}
                    className="flex gap-2 text-[13.5px] leading-relaxed text-[#4A5567]"
                  >
                    <span className="shrink-0 font-semibold text-[#98A2B3]">{k + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
