// =========================================================
// 놓을 위치: src/app/privacy/page.tsx
//
// 개인정보 처리방침. (사용자 결정 2026-08-12)
//
// ★ 로그인 없이 열립니다. 처리방침은 누구나 볼 수 있어야 합니다.
//
// ★ 숫자와 이름을 이 파일에 안 씁니다.
//   보관기간은 retention_settings, 사업자 정보와 책임자는 organizations
//   에서 읽습니다. 설정을 바꾸면 이 문서도 그날 바뀝니다 — 처리방침이
//   실제와 어긋나는 것이 가장 큰 위험이기 때문입니다.
//
// ★ 시행일이 없으면 '초안' 이라고 밝힙니다.
//   법률 검토를 안 거친 문서가 공개된 처리방침 행세를 하면 안 됩니다.
// =========================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { getPolicyFacts } from '@/server/repositories/privacy';
import {
  isDraft,
  keepRows,
  PURPOSES,
  NOT_COLLECTED,
  SAFEGUARDS,
  LEGAL_KEEP,
  HELP_DESKS,
} from '@/server/domain/privacy';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '개인정보 처리방침 — Den Flow',
};

export default async function PrivacyPolicyPage() {
  const facts = await getPolicyFacts();
  const draft = isDraft(facts);
  const rows = keepRows(facts);
  const company = facts.orgName ?? '회사';

  return (
    <main className="mx-auto max-w-[760px] px-6 py-12 text-[#1A2130]">
      <header className="border-b border-[#E8EBF0] pb-6">
        <Link href="/login" className="text-[12.5px] font-semibold text-[#1279E8] hover:underline">
          ← Den Flow
        </Link>
        <h1 className="mt-3 text-[26px] font-extrabold tracking-[-0.04em]">개인정보 처리방침</h1>
        <p className="mt-2 text-[13px] text-[#7C8595]">
          {facts.effectiveOn
            ? `${facts.effectiveOn} 시행`
            : '시행일이 정해지지 않았습니다'}
        </p>
      </header>

      {/* ★ 검토 전이라는 것을 감추지 않습니다 */}
      {draft && (
        <p className="mt-6 rounded-lg border border-[#F0D9A8] bg-[#FEF8EC] px-4 py-3.5 text-[13px] leading-relaxed text-[#8A6320]">
          <b className="font-bold">초안입니다.</b> 아직 법률 검토를 거치지 않았고 시행일이
          정해지지 않았습니다. 이 문서는 시스템이 실제로 하는 일을 그대로 옮긴 것으로,
          공개 전에 검토를 받아야 합니다.
        </p>
      )}

      <Section n="제1조" title="총칙">
        <P>
          <B>{company}</B>(이하 &lsquo;회사&rsquo;)는 「개인정보 보호법」 제30조에 따라
          정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하게 처리할 수 있도록
          다음과 같이 개인정보 처리방침을 수립·공개합니다.
        </P>
        <P>
          회사는 치과와 기공소를 잇는 보철 제작주문 플랫폼 <B>Den Flow</B>를 운영합니다.
          이 방침은 Den Flow 서비스에 적용됩니다.
        </P>
      </Section>

      <Section n="제2조" title="개인정보의 처리 목적과 항목">
        <P>회사는 다음의 목적으로만 개인정보를 처리하며, 목적이 바뀌면 별도의 조치를 취합니다.</P>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-[#E8EBF0] bg-[#F8F9FB] text-left">
                <Th>처리 목적</Th>
                <Th>필수 항목</Th>
                <Th>선택 항목</Th>
              </tr>
            </thead>
            <tbody>
              {PURPOSES.map((row) => (
                <tr key={row.purpose} className="border-b border-[#F0F2F5] align-top">
                  <Td className="font-semibold">{row.purpose}</Td>
                  <Td>{row.required}</Td>
                  <Td className="text-[#7C8595]">{row.optional || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <P className="mt-4">
          환자의 개인정보는 <B>치과가 입력</B>하며, 보철 제작에 필요한 범위에서 디자인센터와
          해당 주문을 배정받은 기공소에 제공됩니다.
        </P>

        <P className="mt-3">회사는 다음 정보를 수집하지 않습니다.</P>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-[#4A5567]">
          {NOT_COLLECTED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section n="제3조" title="개인정보의 처리 및 보유기간">
        {rows.length === 0 ? (
          <P className="text-[#B3312C]">보관기간이 아직 설정되지 않았습니다.</P>
        ) : (
          <>
            <P>회사는 다음 기간이 지나면 해당 정보를 파기합니다.</P>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[440px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-y border-[#E8EBF0] bg-[#F8F9FB] text-left">
                    <Th>대상</Th>
                    <Th>기산일</Th>
                    <Th>보유기간</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.what} className="border-b border-[#F0F2F5]">
                      <Td className="font-semibold">{row.what}</Td>
                      <Td className="text-[#7C8595]">{row.from}</Td>
                      <Td className="font-bold tabular-nums">{row.period}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <P className="mt-4">
          다만 다른 법령이 더 긴 보존을 정한 경우에는 <B>그 기간을 따릅니다.</B>
        </P>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse text-[13px]">
            <tbody>
              {LEGAL_KEEP.map((row) => (
                <tr key={row.what} className="border-b border-[#F0F2F5]">
                  <Td>{row.what}</Td>
                  <Td className="whitespace-nowrap font-bold">{row.period}</Td>
                  <Td className="whitespace-nowrap text-[#7C8595]">{row.law}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <P className="mt-4">회원 정보는 회원 탈퇴 시까지 보유합니다.</P>
      </Section>

      <Section n="제4조" title="개인정보의 제3자 제공 및 처리위탁">
        <P>
          회사는 정보주체의 개인정보를 <B>제3자에게 제공하지 않습니다.</B> 다만 보철 제작을
          위하여 다음과 같이 처리업무를 위탁하고 있습니다.
        </P>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-[#E8EBF0] bg-[#F8F9FB] text-left">
                <Th>수탁자</Th>
                <Th>위탁업무</Th>
              </tr>
            </thead>
            <tbody>
              {(facts.labs ?? []).map((lab) => (
                <tr key={lab.name} className="border-b border-[#F0F2F5]">
                  <Td className="font-semibold">{lab.name}</Td>
                  <Td>배정된 주문의 보철물 제작</Td>
                </tr>
              ))}
              <tr className="border-b border-[#F0F2F5]">
                <Td className="font-semibold">Supabase</Td>
                <Td>서비스 운영을 위한 클라우드 인프라 (국내 리전에 저장)</Td>
              </tr>
            </tbody>
          </table>
        </div>

        <P className="mt-4">
          회사는 위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 목적 외 처리 금지,
          기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등
          책임에 관한 사항을 문서에 명시합니다. 수탁자가 바뀌면 이 방침을 통해 공개합니다.
        </P>
      </Section>

      <Section n="제5조" title="정보주체의 권리·의무 및 행사방법">
        <P>
          정보주체는 언제든지 개인정보의 열람·정정·삭제·처리정지를 요구할 수 있습니다.
          요구는 서면, 전자우편, 팩스 등으로 하실 수 있으며 회사는 지체 없이 조치합니다.
        </P>
        <P className="mt-3">
          <B>환자 본인</B>의 권리 행사는 정보를 입력한 <B>치과를 통하여</B> 하실 수 있습니다.
          회사는 해당 치과의 요청에 따라 지체 없이 처리합니다.
        </P>
        <P className="mt-3">
          권리 행사는 법정대리인이나 위임을 받은 자를 통하여 하실 수 있으며, 이 경우
          위임장을 제출하셔야 합니다. 열람·처리정지 요구는 「개인정보 보호법」
          제35조 제4항, 제37조 제2항에 따라 제한될 수 있습니다.
        </P>
      </Section>

      <Section n="제6조" title="개인정보의 파기">
        <P>
          회사는 보유기간이 지나거나 처리 목적이 달성되어 개인정보가 불필요하게 되었을 때
          지체 없이 파기합니다.
        </P>
        <P className="mt-3">
          전자적으로 저장된 개인정보는 <B>복구할 수 없는 방법으로 삭제</B>하며, 저장소에
          보관된 파일도 함께 삭제합니다. 파기한 대상과 건수는 기록으로 남기되 파기한
          내용 자체는 남기지 않습니다.
        </P>
      </Section>

      <Section n="제7조" title="개인정보의 안전성 확보조치">
        <ol className="mt-1 space-y-3.5">
          {SAFEGUARDS.map((item, i) => (
            <li key={item.title} className="text-[13.5px] leading-relaxed text-[#4A5567]">
              <b className="font-bold text-[#1A2130]">
                {i + 1}. {item.title}
              </b>
              <br />
              {item.body}
            </li>
          ))}
        </ol>
      </Section>

      <Section n="제8조" title="개인정보 보호책임자">
        <P>
          회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 정보주체의 불만처리 및
          피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
        </P>

        <dl className="mt-4 rounded-lg border border-[#E8EBF0] bg-[#F8F9FB] px-5 py-4 text-[13.5px]">
          <Row label="성명" value={facts.officerName} />
          {/* ★ 부서는 없을 수 있습니다 (작은 회사). 없으면 줄 자체를 안 냅니다 —
                '미지정' 이라고 적으면 있어야 하는데 안 정한 것처럼 보입니다 */}
          {facts.officerDept?.trim() && <Row label="부서" value={facts.officerDept} />}
          <Row label="연락처" value={facts.officerTel} />
          <Row label="전자우편" value={facts.officerEmail} />
        </dl>

        <P className="mt-4">
          정보주체는 서비스를 이용하면서 발생한 모든 개인정보 보호 관련 문의, 불만처리,
          피해구제에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다.
        </P>
      </Section>

      <Section n="제9조" title="권익침해 구제방법">
        <P>
          정보주체는 개인정보 침해로 인한 구제를 받기 위하여 아래 기관에 분쟁 해결이나
          상담을 신청할 수 있습니다.
        </P>
        <ul className="mt-3 space-y-1.5 text-[13.5px] text-[#4A5567]">
          {HELP_DESKS.map((desk) => (
            <li key={desk.name}>
              <b className="font-semibold text-[#1A2130]">{desk.name}</b> — {desk.tel} (
              {desk.site})
            </li>
          ))}
        </ul>
      </Section>

      <Section n="제10조" title="처리방침의 변경">
        <P>
          이 개인정보 처리방침은 법령이나 서비스의 변경에 따라 내용이 추가·삭제·수정될 수
          있으며, 변경 시에는 시행 전에 공지사항을 통해 알립니다.
        </P>
      </Section>

      <footer className="mt-12 border-t border-[#E8EBF0] pt-6 text-[12.5px] leading-relaxed text-[#98A2B3]">
        <p>
          {facts.orgName && <span>{facts.orgName}</span>}
          {facts.bizNo && <span> · 사업자등록번호 {facts.bizNo}</span>}
          {facts.address && <span> · {facts.address}</span>}
          {facts.tel && <span> · {facts.tel}</span>}
        </p>
        {facts.effectiveOn && <p className="mt-1.5">본 방침은 {facts.effectiveOn}부터 시행합니다.</p>}
      </footer>
    </main>
  );
}

// ---------- 조각들 ----------

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="text-[15.5px] font-extrabold tracking-[-0.02em]">
        <span className="text-[#98A2B3]">{n}</span> {title}
      </h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[13.5px] leading-relaxed text-[#4A5567] ${className}`}>{children}</p>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <b className="font-bold text-[#1A2130]">{children}</b>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-[12px] font-semibold text-[#7C8595]">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 leading-relaxed text-[#4A5567] ${className}`}>{children}</td>;
}

/** ★ 안 채운 칸은 비워 두지 않고 그렇다고 말합니다 */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 py-1">
      <dt className="w-[70px] shrink-0 font-semibold text-[#7C8595]">{label}</dt>
      <dd className={value?.trim() ? 'text-[#1A2130]' : 'text-[#C4383A]'}>
        {value?.trim() || '미지정'}
      </dd>
    </div>
  );
}
