// =========================================================
// 놓을 위치: src/components/site/LandingPage.tsx
//
// 회사 홈페이지. 로그인 안 한 사람이 `/` 로 오면 이 화면입니다.
// (사용자 요청 2026-08-12 — "모델리스 전문 기공소 느낌의 홈페이지")
//
// ★ 2026-11-16 겉모습을 다시 짰습니다 (사용자 "세련되게 다시" → 시안 → "진행해줘").
//   글은 전과 같고, 자주 묻는 것 한 절이 늘었습니다.
//
// ★ 겉모습의 규칙 셋
//   1) 파랑(#1279E8)은 **누르는 것에만** — 단추와 링크. 꾸밈에는 안 씁니다
//   2) 면은 로고의 남색(#16324F)과 도자기빛 흰색(#F3F6F7) 둘
//   3) 상자 대신 **가는 선**으로 나눕니다. 상자는 폼과 가입 칸 둘뿐
//
// ★ 지어낸 숫자를 안 씁니다.
//   "20년 경력 · 거래처 200곳 · 정확도 99%" 같은 것은 홈페이지에 흔하지만,
//   확인할 수 없는 것을 적어 두면 나중에 지우기도 어렵고 물어보면 곤란해집니다.
//   대신 **실제로 이 시스템이 하는 일**을 적었습니다 — 그건 전부 사실입니다.
//
// ★ 채워 넣으실 곳은 SITE 한 곳에 모아 뒀습니다.
//
// ★ 로그인 버튼이 곧 플랫폼 입구입니다.
//   홈페이지와 플랫폼을 따로 두지 않았습니다 — 주소가 둘이면 거래처가
//   어디로 들어가야 하는지 헷갈립니다.
//
// ★ 영상 조각(MillingStage)은 손대지 않았습니다.
// =========================================================

import Link from 'next/link';
import { SITE_LEGAL } from '@/server/domain/site';
import ContactForm from '@/components/site/ContactForm';
import MillingStage from '@/components/site/MillingStage';
import { SitePicto, type SitePictoName } from '@/components/site/SitePicto';
import DenFlowLogo from '@/components/brand/DenFlowLogo';
import ChannelTalk from '@/components/site/ChannelTalk';
import ScrollReveal from '@/components/site/ScrollReveal';

/** ★ 고치실 곳은 여기뿐입니다 */
const SITE = {
  name: '덴플로우 디지털 기공소',
  tagline: '디지털 기공소',
  tel: '010-3365-3145',

  // ★ 첫 화면의 밀링 영상. 셋 중 위에 있는 것부터 씁니다.
  //
  //   1) heroYouTube — 유튜브 아이디. 지금 이것이 나갑니다
  //   2) heroVideo   — 우리 서버에 올린 파일 (`public/media/` 에 넣고 경로를 적습니다).
  //                    쓰시려면 heroYouTube 를 비우셔야 합니다
  //   3) 둘 다 비우면 직접 그린 밀링 장면이 나갑니다
  //
  // ★ **지금 걸린 영상은 우리가 찍은 것이 아닙니다.**
  //   유튜브 'Dental Bean' 채널의 "Milling zirconia # shorts" 입니다.
  //   퍼가기(embed)를 허용해 둔 영상이라 붙이는 것 자체는 됩니다. 다만
  //   회사 홈페이지 첫 화면에 놓이면 **우리 장비로 보입니다.**
  //   나중에 우리 밀링을 찍으면 `heroVideo` 로 바꾸시는 편이 좋습니다.
  //   출처를 한 줄 달고 싶으시면 `videoCredit` 에 적으시면 나옵니다.
  heroYouTube: '1WDxkbn4LxQ',
  heroVideo: '',
  heroPoster: '',

  // ★ 여기까지만 틀고 처음으로 돌아갑니다 (사용자 요청 2026-08-14).
  //   0 으로 두면 영상 끝까지 갑니다.
  heroStopAt: 20,

  videoCredit: '',

  /*
    ★ 채널톡 상담 버튼 (오른쪽 아래). 사용자 요청 2026-08-15.

      비어 있으면 **아무것도 안 붙습니다** — 스크립트도 안 받습니다.
      키를 못 받은 채로 켜 두면 홈페이지를 열 때마다 남의 서버를
      부르고 오류만 쌓입니다.

      받는 법:
        1) channel.io 가입 → 채널 만들기
        2) 설정 → 보안 및 개발 → **플러그인 설치**
        3) '웹사이트' 를 고르면 나오는 코드에서
           `pluginKey: "여기"` 의 값만 아래에 붙여 넣기

      ★ 채널 개설에 사업자등록은 필요 없습니다. 개인으로도 됩니다 —
        지금 막혀 있는 다른 것들(플레이스·알림톡)과 다릅니다.
  */
  channelTalkKey: '3d578efd-f26e-4d69-a92a-fa4f89a320b9',
};

const INK = '#14263A';
const FONT =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif";

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1279E8]';

export default function LandingPage({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: FONT, color: INK }}>
      {/*
        ★ 글꼴은 프리텐다드입니다 (2026-11-16). 전에는 보는 기계의 기본 글꼴이라
          윈도우(맑은 고딕)와 맥이 서로 다르게 보였고, 그래서 제목 크기를 기계마다
          넘치지 않게 작게 잡아야 했습니다.
        ★ **홈페이지에만** 받습니다 — 플랫폼 화면은 전과 같습니다.
        ★ 지금은 바깥(jsDelivr)에서 받습니다. 못 받으면 전의 기본 글꼴로 보입니다.
          우리 서버로 옮기려면 글꼴 파일을 public/fonts 에 넣고 이 줄을 바꿉니다.
      */}
      <link
        rel="stylesheet"
        precedence="default"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
      />

      {/*
        ★ 스크롤하면 글이 올라오는 효과 (2026-08-18).
        ★ **`<html>` 을 건드리지 않습니다** — 수화가 깨져 첫 화면이 백지가 됐던 일이 있습니다.
          감추는 일은 CSS 의 `@media (scripting: enabled)` 가 합니다.
      */}
      <ScrollReveal />
      <Header loggedIn={loggedIn} />
      <Hero />
      <Scope />
      <Why />
      <Flow />
      <Products />
      <Platform />
      <Faq />
      <Contact />
      <Footer />

      {/*
        ★ 상담 버튼은 **이 화면에만** 답니다. 플랫폼에는 주문마다 대화 칸이 이미 있습니다.
        ★ 키가 비어 있으면 아무것도 안 붙습니다.
      */}
      {SITE.channelTalkKey && <ChannelTalk pluginKey={SITE.channelTalkKey} />}
    </div>
  );
}

const WRAP = 'mx-auto max-w-[1120px] px-6';
const H2 = 'text-balance break-keep text-[27px] font-extrabold leading-[1.25] tracking-[-0.04em] sm:text-[36px]';

// ---------- 머리 ----------

function Header({ loggedIn }: { loggedIn: boolean }) {
  const link = `hidden text-[14.5px] font-semibold text-[#3D4E60] hover:text-[#14263A] sm:block ${FOCUS}`;
  return (
    <header className="sticky top-0 z-40 border-b border-[#E3E8EB] bg-white/92 backdrop-blur">
      {/* ★ 320px 폰에서 로고·로그인·수가표 요청이 18px 넘쳤습니다 (운영에서 잰 값 2026-11-16).
            360px 아래에서만 옆 여백과 단추를 조금 줄입니다 */}
      <div className={`${WRAP} flex h-[68px] items-center max-[359px]:px-4`}>
        {/* 320px 에서는 로고가 로그인 단추에 닿아 보여 조금 줄입니다 */}
        <span className="origin-left max-[359px]:scale-[0.88]">
          <DenFlowLogo markHeight={28} fontSize={21} gap={11} />
        </span>
        <nav className="ml-auto flex items-center gap-1 sm:gap-7">
          <a href="#why" className={link}>모델리스</a>
          <a href="#flow" className={link}>진행 과정</a>
          <a href="#products" className={link}>취급 보철</a>
          <a href="#faq" className={link}>자주 묻는 것</a>
          {/*
            ★ 참고 사이트에서 가져온 것 (사용자 2026-11-16): 머리줄의 **채운 단추는 문의**, 로그인은 테두리만.
              처음 온 분이 누를 것이 제일 눈에 띄어야 하고, 거래처는 로그인을 어차피 찾습니다.
          */}
          <Link
            href={loggedIn ? '/' : '/login'}
            className={`ml-2 grid h-10 shrink-0 place-items-center whitespace-nowrap rounded-lg border border-[#C9D3D9] px-3 text-[14px] max-[359px]:ml-0 max-[359px]:px-2.5 max-[359px]:text-[13px] sm:px-4 sm:text-[14.5px] font-bold text-[#14263A] hover:border-[#14263A] ${FOCUS}`}
          >
            {loggedIn ? '내 화면으로' : '로그인'}
          </Link>
          <a
            href="#contact"
            className={`ml-1 grid h-10 shrink-0 place-items-center whitespace-nowrap rounded-lg bg-[#1279E8] px-3 text-[14px] max-[359px]:px-2.5 max-[359px]:text-[13px] font-bold text-white hover:bg-[#0F68C9] sm:ml-0 sm:px-5 sm:text-[14.5px] ${FOCUS}`}
          >
            수가표 요청
          </a>
        </nav>
      </div>
    </header>
  );
}

// ---------- 첫 화면 ----------

function Hero() {
  return (
    <section className="bg-[#F3F6F7]">
      <div className={`${WRAP} grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_minmax(0,360px)] lg:gap-16 lg:py-24`}>
        <div>
          {/*
            ★ 첫 줄은 가볍게, 둘째 줄은 무겁게.
              없어지는 것(인상재·석고 모델)은 가는 글씨로, 얻는 것(보철)은 굵은 글씨로.
              색으로 한 마디만 칠하던 것을 글씨 굵기로 바꿨습니다.
          */}
          <h1 data-reveal className="break-keep text-[27px] leading-[1.22] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
            <span className="block font-light text-[#5B6C7D]">인상재도, 석고 모델도 없이</span>
            <span className="block font-extrabold">스캔 한 번으로 보철까지</span>
          </h1>

          <p
            data-reveal
            style={{ transitionDelay: '90ms' }}
            className="mt-7 max-w-[520px] break-keep text-[15px] leading-[1.75] tracking-[-0.01em] text-[#3D4E60] sm:text-[17px]"
          >
            구강스캐너로 뜬 데이터를 그대로 설계하고 제작합니다.
            <br />
            모델을 뜨러 환자를 다시 부를 일이 없고,
            <br />
            <b className="font-bold text-[#14263A]">진행은 화면에서 바로 보입니다.</b>
          </p>

          <div data-reveal style={{ transitionDelay: '180ms' }} className="mt-9 flex flex-wrap gap-3">
            <a
              href="#contact"
              className={`grid h-[52px] place-items-center rounded-lg bg-[#1279E8] px-8 text-[16px] font-bold text-white hover:bg-[#0F68C9] ${FOCUS}`}
            >
              수가표 요청하기
            </a>
            <a
              href="#flow"
              className={`grid h-[52px] place-items-center rounded-lg border border-[#C9D3D9] bg-white px-8 text-[16px] font-bold text-[#14263A] hover:border-[#14263A] ${FOCUS}`}
            >
              진행 과정 보기
            </a>
          </div>

          {/* 약속 셋 — 체크 표시 알약 대신 가는 선 위의 세 칸 */}
          <ul
            data-reveal
            style={{ transitionDelay: '260ms' }}
            className="mt-12 grid max-w-[560px] grid-cols-3 border-t border-[#C9D3D9]"
          >
            {['스캐너 무관', '모델리스 전 품목', '실시간 진행 공유'].map((t) => (
              <li key={t} className="break-keep pr-3 pt-4 text-[13.5px] font-semibold leading-snug text-[#3D4E60] sm:text-[14.5px]">
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div data-reveal style={{ transitionDelay: '120ms' }}>
          <MillingStage
            youtubeId={SITE.heroYouTube || undefined}
            src={SITE.heroVideo || undefined}
            poster={SITE.heroPoster || undefined}
            stopAt={SITE.heroStopAt || undefined}
            credit={SITE.videoCredit || undefined}
          />
        </div>
      </div>
    </section>
  );
}

// ---------- 네 가지 약속 ----------

const PROMISES: { art: SitePictoName; title: string; worry: string; answer: string }[] = [
  { art: 'scan', title: '스캐너 무관', worry: '장비 바꾸실 필요 없이', answer: '쓰시던 그대로, 파일만' },
  { art: 'track', title: '실시간 진행상황 공유', worry: '굳이 물어보지 않으셔도', answer: '접수 → 배송 화면에서 바로' },
  { art: 'bridge', title: '모델리스 전 품목', worry: '크라운·브릿지, 인레이·온레이', answer: '임플란트 보철까지 모델 없이' },
  { art: 'chart', title: '리메이크 통계 & 분석', worry: '원인 모르고 넘어가지 않게', answer: '매달 모아 분석하고 고칩니다' },
];

function Scope() {
  return (
    <section className="bg-[#16324F]">
      <div className={`${WRAP} py-16 sm:py-24`}>
        <h2 data-reveal className={`${H2} text-white lg:text-[44px]`}>
          {/* ★ 글에는 민트색을 안 씁니다 (사용자 2026-11-16) — 전에는 '덴플로우' 만 민트였습니다 */}
          스캔에서 세팅까지, 덴플로우
        </h2>

        {/* 흰 카드 넷 → 남색 위에 선으로 나눈 네 칸. 민트색은 글·그림·선 어디에도 안 씁니다 (사용자 2026-11-16) */}
        <ul className="mt-12 grid sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {PROMISES.map((p, i) => (
            <li
              key={p.title}
              data-reveal
              style={{ transitionDelay: `${i * 80}ms` }}
              className="border-t border-white/15 py-7 sm:px-6 sm:first:pl-0 lg:border-l lg:border-t-0 lg:py-1 lg:first:border-l-0"
            >
              <SitePicto name={p.art} cut="#16324F" className="h-11 w-11 text-white" />
              <b className="mt-5 flex min-h-[2.6em] items-start text-balance break-keep text-[20px] font-extrabold leading-[1.3] tracking-[-0.035em] text-white">
                {p.title}
              </b>
              <span className="mt-2 block text-[14.5px] leading-relaxed text-[#9DB2C7]">{p.worry}</span>
              <b className="mt-1 block text-balance break-keep text-[16px] font-bold leading-[1.5] tracking-[-0.02em] text-white">
                {p.answer}
              </b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- 왜 모델리스인가 ----------

const REASONS: { title: string; body: string }[] = [
  {
    title: '거치는 단계가 적습니다',
    body:
      '모델을 뜨는 공정에는 인상 채득, 석고 주입, 경화, 트리밍이 들어갑니다. ' +
      '모델리스는 그 단계를 지나치므로 그만큼 날이 줄고, 단계마다 생기던 오차도 함께 사라집니다.',
  },
  {
    title: '스캔 원본을 그대로 씁니다',
    body:
      '모델을 다시 스캔하면 한 번 베낀 것을 또 베끼는 셈입니다. ' +
      '구강 스캐너가 뜬 데이터를 바로 설계에 올립니다.',
  },
  {
    title: '다시 만들 때 빠릅니다',
    body:
      '원본 데이터가 남아 있어 수정이 필요하면 그 자리에서 다시 설계합니다. ' +
      '모델을 다시 뜨러 환자를 부를 일이 없습니다.',
  },
];

function Why() {
  return (
    <section id="why" className="bg-white">
      <div className={`${WRAP} grid gap-10 py-18 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}>
        <h2 data-reveal className={`${H2} lg:sticky lg:top-28 lg:self-start`}>
          왜 모델리스인가
        </h2>

        {/* 카드 셋 → 읽는 글 세 토막. 순서가 없는 내용이라 번호를 뺐습니다 */}
        <ul>
          {REASONS.map((r, i) => (
            <li
              key={r.title}
              data-reveal
              style={{ transitionDelay: `${i * 70}ms` }}
              className="border-t border-[#DDE4E8] py-8 last:border-b"
            >
              <h3 className="break-keep text-[20px] font-extrabold tracking-[-0.03em] sm:text-[22px]">{r.title}</h3>
              <p className="mt-3 max-w-[560px] break-keep text-[15.5px] leading-[1.75] text-[#3D4E60]">{r.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- 진행 과정 ----------

const STEPS = [
  { step: '01', art: 'scan', title: '스캔 전송', body: '스캔 파일과 처방을 올립니다.' },
  { step: '02', art: 'review', title: '사전 검토', body: '스캔 상태를 먼저 봅니다. 다시 떠야 하면 그때 알려 드립니다.' },
  { step: '03', art: 'design', title: '디자인', body: '담당 디자이너가 맡아 설계합니다.' },
  { step: '04', art: 'mill', title: '제작', body: '설계 그대로 밀링합니다.' },
  { step: '05', art: 'ship', title: '납품', body: '요청하신 날에 맞춰 보냅니다.' },
] as const;

/*
  ★ 동그라미 + 아이콘 + 잇는 선을 걷어냈습니다 (사용자 2026-11-16 "AI스럽다").
    칸마다 **속을 채운 픽토그램**(SitePicto)과 작은 번호 — 진짜 순서가 있는 내용이라 번호는 남깁니다.
    넓은 화면은 굵은 윗선 아래 다섯 칸, 좁은 화면은 숫자 옆에 글이 놓인 다섯 줄.
*/
function Flow() {
  return (
    <section id="flow" className="bg-[#F3F6F7]">
      <div className={`${WRAP} py-18 sm:py-28`}>
        <h2 data-reveal className={H2}>
          스캔을 보내면, 이렇게 갑니다
        </h2>

        <ol data-reveal style={{ transitionDelay: '100ms' }} className="mt-10 border-t-2 border-[#14263A] lg:mt-14 lg:grid lg:grid-cols-5">
          {STEPS.map((s) => (
            <li
              key={s.step}
              className="grid grid-cols-[72px_1fr] items-center border-b border-[#C9D3D9] py-6 lg:block lg:border-b-0 lg:border-l lg:px-5 lg:py-0 lg:pt-8 lg:first:border-l-0 lg:first:pl-0"
            >
              <SitePicto name={s.art} cut="#F3F6F7" className="h-12 w-12 text-[#16324F] lg:h-14 lg:w-14" />
              <div className="lg:mt-8">
                <span className="text-[13.5px] font-bold tabular-nums text-[#8A97A5]">{s.step}</span>
                <h3 className="mt-0.5 text-[20px] font-extrabold tracking-[-0.03em]">{s.title}</h3>
                <p className="mt-2 break-keep text-[15px] leading-[1.7] text-[#3D4E60]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- 취급 보철 ----------

/*
  ★ 색 윗선 + 아이콘 + 목록 세 칸이던 것을 **표**로 바꿨습니다 (사용자 2026-11-16 "너무 AI스럽다").
    수가표를 받으러 온 분이 보는 자리라, 품목표처럼 읽히는 편이 맞습니다.
    꾸밈(제품 색·아이콘)은 뺐습니다. 품목 이름은 주문 화면의 제품 표와 같은 글자입니다.
*/
const PRODUCTS = [
  { name: '크라운', items: ['지르코니아', 'PMMA'] },
  { name: '인레이', items: ['하이브리드', '지르코니아'] },
  { name: '임플란트', items: ['Abut + Zir (SCRP)', 'Abut + Zir (Cementation)', 'Abut + PMMA', '커스텀 어버트먼트'] },
] as const;

function Products() {
  return (
    <section id="products" className="bg-white">
      <div className={`${WRAP} grid gap-10 py-18 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 data-reveal className={H2}>
            취급 보철
          </h2>
          <p data-reveal style={{ transitionDelay: '80ms' }} className="mt-4 max-w-[340px] break-keep text-[16px] leading-[1.75] text-[#3D4E60]">
            지르코니아 크라운 · 인레이 · 임플란트 보철을 만듭니다. 전부 밀링으로 나옵니다.
          </p>
        </div>

        <dl data-reveal style={{ transitionDelay: '120ms' }} className="border-t-2 border-[#14263A]">
          {PRODUCTS.map((p) => (
            <div key={p.name} className="grid gap-x-8 gap-y-3 border-b border-[#DDE4E8] py-7 sm:grid-cols-[150px_1fr]">
              <dt className="text-[21px] font-extrabold tracking-[-0.03em]">{p.name}</dt>
              <dd>
                <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {p.items.map((item) => (
                    <li key={item} className="text-[16px] leading-[1.6] text-[#2B3B4D]">
                      {item}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------- 플랫폼 ----------

const PLATFORM = [
  '스캔 파일 업로드부터 배송까지 한 화면에서',
  '요청시한을 달력에서 고르고, 휴일은 빼고 셉니다',
  '진행 상태가 바뀌면 알림이 옵니다',
  '리메이크·리페어를 주문에서 바로 신청',
  '월 정산과 청구서를 언제든 다시 확인',
];

function Platform() {
  return (
    <section className="border-t border-[#E3E8EB] bg-white">
      <div className={`${WRAP} grid gap-12 py-18 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-20`}>
        <div>
          <h2 data-reveal className={H2}>
            주문부터 정산까지, 전화 없이
          </h2>
          <ul data-reveal style={{ transitionDelay: '80ms' }} className="mt-9">
            {PLATFORM.map((line) => (
              <li key={line} className="break-keep border-t border-[#DDE4E8] py-4 text-[16px] text-[#2B3B4D] last:border-b">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div data-reveal style={{ transitionDelay: '140ms' }} className="rounded-2xl bg-[#16324F] p-8 sm:p-10">
          <p className="text-[21px] font-extrabold tracking-[-0.03em] text-white">거래 치과로 등록하시면</p>
          <p className="mt-3 break-keep text-[15.5px] leading-[1.7] text-[#B9C8D8]">
            주문 화면이 바로 열립니다. 가입하시면 확인 후 승인해 드립니다.
          </p>
          <Link
            href="/signup"
            className={`mt-7 grid h-[52px] place-items-center rounded-lg bg-[#1279E8] text-[16px] font-bold text-white hover:bg-[#2A8BF2] ${FOCUS} focus-visible:outline-white`}
          >
            가입 신청
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------- 자주 묻는 것 ----------

/*
  ★ 참고 사이트에서 가져온 것 (사용자 2026-11-16) — 문의 폼 바로 앞의 '첫 주문 전에 묻는 것'.
    폼 앞에서 망설이는 까닭을 미리 풀어 줍니다.

  ★ 답은 전부 **이 시스템이 실제로 하는 일**만 적었습니다. 새 약속은 없습니다.
  ★ '며칠' 같은 숫자는 적지 않았습니다 — 밖에 낸 적 없는 숫자라, 정하시면 그때 넣습니다.
*/
const FAQ: { q: string; a: string }[] = [
  {
    q: '쓰는 스캐너가 달라도 되나요?',
    a: '됩니다. 스캐너에서 내보낸 파일만 올리시면 됩니다. 장비나 프로그램을 바꾸실 필요가 없습니다.',
  },
  {
    q: '받는 날은 어떻게 정하나요?',
    a: '주문하실 때 달력에서 받으실 날을 고르십니다. 고를 수 있는 가장 빠른 날이 달력에 보이고, 휴일은 빼고 셉니다.',
  },
  {
    q: '진행 상황은 어떻게 알 수 있나요?',
    a: '접수부터 배송까지 단계가 화면에 보이고, 단계가 바뀌면 알림이 갑니다. 궁금한 것은 주문마다 있는 대화 칸에 남기시면 됩니다.',
  },
  {
    q: '맞지 않으면 어떻게 하나요?',
    a: '주문 화면에서 리메이크나 리페어를 바로 신청하실 수 있습니다. 원본 데이터가 남아 있어 그 자리에서 다시 설계합니다.',
  },
  {
    q: '정산은 어떻게 하나요?',
    a: '한 달에 한 번 정산합니다. 청구서는 화면에서 언제든 다시 보실 수 있습니다.',
  },
  {
    q: '거래를 시작하려면 무엇을 하면 되나요?',
    a: '수가표를 먼저 받아 보시고, 가입 신청을 하시면 확인 후 승인해 드립니다. 승인되면 주문 화면이 바로 열립니다.',
  },
];

function Faq() {
  return (
    <section id="faq" className="border-t border-[#E3E8EB] bg-white">
      <div className={`${WRAP} grid gap-10 py-18 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}>
        <h2 data-reveal className={`${H2} lg:sticky lg:top-28 lg:self-start`}>
          첫 주문 전에
          <br />
          많이 물으시는 것
        </h2>

        <div data-reveal style={{ transitionDelay: '80ms' }}>
          {FAQ.map((f) => (
            <details key={f.q} className="group border-t border-[#DDE4E8] last:border-b">
              <summary
                className={`flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[18px] font-bold tracking-[-0.025em] sm:text-[19px] [&::-webkit-details-marker]:hidden ${FOCUS}`}
              >
                <span className="break-keep">{f.q}</span>
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="h-5 w-5 shrink-0 text-[#5B6C7D] transition-transform duration-200 group-open:rotate-45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M10 4v12M4 10h12" />
                </svg>
              </summary>
              <p className="max-w-[560px] break-keep pb-7 text-[15.5px] leading-[1.75] text-[#3D4E60]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- 문의 ----------

function Contact() {
  return (
    <section id="contact" className="bg-[#F3F6F7]">
      <div className={`${WRAP} py-18 sm:py-28`}>
        <div className="grid gap-10 sm:grid-cols-[0.9fr_1.1fr] sm:items-start lg:gap-16">
          <div data-reveal className="sm:sticky sm:top-28">
            <h2 className={H2}>
              수가표부터
              <br />
              받아 보세요
            </h2>
            <p className="mt-5 max-w-[380px] break-keep text-[16px] leading-[1.75] text-[#3D4E60]">
              거래를 정하지 않으셔도 됩니다. 품목별 수가와 납기를 먼저 보시고
              판단하시면 됩니다.
            </p>

            <div className="mt-9 border-t border-[#C9D3D9] pt-5">
              <p className="text-[14.5px] font-semibold text-[#5B6C7D]">바로 통화를 원하시면</p>
              <a
                href={`tel:${SITE.tel.replace(/-/g, '')}`}
                className={`mt-1 inline-block text-[28px] font-extrabold tabular-nums tracking-[-0.03em] text-[#14263A] hover:text-[#1279E8] ${FOCUS}`}
              >
                {SITE.tel}
              </a>
            </div>
          </div>

          <div data-reveal style={{ transitionDelay: '110ms' }}>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 바닥 ----------

function Footer() {
  const link = `text-[14px] font-semibold text-[#3D4E60] hover:text-[#14263A] ${FOCUS}`;
  return (
    <footer className="border-t border-[#E3E8EB] bg-white">
      <div className={`${WRAP} flex flex-col gap-5 py-10 sm:flex-row sm:items-start`}>
        <div>
          <DenFlowLogo markHeight={22} fontSize={17} />
          <p className="mt-3 text-[14px] text-[#5B6C7D]">
            {SITE.tagline} · {SITE.tel}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#8A97A5]">
            {SITE_LEGAL.name} · 대표 {SITE_LEGAL.ceo} · 사업자등록번호 {SITE_LEGAL.bizNo}
            <br />
            {SITE_LEGAL.address}
          </p>
        </div>

        <div className="flex flex-wrap gap-6 sm:ml-auto">
          <Link href="/terms" className={link}>이용약관</Link>
          <Link href="/privacy" className={link}>개인정보 처리방침</Link>
          <Link href="/login" className={link}>로그인</Link>
        </div>
      </div>
    </footer>
  );
}
