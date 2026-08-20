// =========================================================
// 놓을 위치: src/components/site/LandingPage.tsx
//
// 회사 홈페이지. 로그인 안 한 사람이 `/` 로 오면 이 화면입니다.
// (사용자 요청 2026-08-12 — "모델리스 전문 기공소 느낌의 홈페이지")
//
// ★ 지어낸 숫자를 안 씁니다.
//   "20년 경력 · 거래처 200곳 · 정확도 99%" 같은 것은 홈페이지에 흔하지만,
//   확인할 수 없는 것을 적어 두면 나중에 지우기도 어렵고 물어보면 곤란해집니다.
//   대신 **실제로 이 시스템이 하는 일**을 적었습니다 — 그건 전부 사실입니다.
//
// ★ 채워 넣으실 곳은 SITE 한 곳에 모아 뒀습니다.
//   글이 화면 곳곳에 흩어져 있으면 고치다가 하나를 빠뜨립니다.
//
// ★ 로그인 버튼이 곧 플랫폼 입구입니다.
//   홈페이지와 플랫폼을 따로 두지 않았습니다 — 주소가 둘이면 거래처가
//   어디로 들어가야 하는지 헷갈립니다.
// =========================================================

import Link from 'next/link';
import ContactForm from '@/components/site/ContactForm';
import MillingStage from '@/components/site/MillingStage';
import { SiteArt, type SiteArtName } from '@/components/site/SiteArt';
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

export default function LandingPage({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="min-h-screen bg-white text-[#1A2130]">
      {/*
        ★ 스크롤하면 글이 올라오는 효과 (2026-08-18).
          감추는 일은 CSS 가, 보여 주는 일은 이 조각이 합니다.

        ★ **`<html>` 을 건드리지 않습니다.**
          처음에는 인라인 스크립트로 `<html>` 에 표시를 달았는데,
          그 자리는 React 가 그리는 곳이라 서버가 보낸 HTML 과
          달라집니다. 수화(hydration)가 깨지면서 **첫 화면이 안 보인 채
          멈췄습니다** — 효과를 붙이려다 홈페이지를 백지로 만들 뻔했습니다.
          class 를 data 속성으로 바꿔도 똑같이 깨졌습니다.
          지금은 CSS 의 `@media (scripting: enabled)` 가 그 일을 합니다.
      */}
      <ScrollReveal />

      <Header loggedIn={loggedIn} />
      <Hero />
      <Scope />
      <Why />
      <Flow />
      <Products />
      <Platform />
      <Contact />
      <Footer />

      {/*
        ★ 상담 버튼은 **이 화면에만** 답니다. 로그인해서 쓰는 플랫폼에는
          주문마다 대화 칸이 이미 있고, 그게 그 건에 붙어 기록으로
          남습니다. 채널톡을 거기까지 띄우면 같은 이야기가 두 곳으로
          갈라집니다. 여기 오는 분은 아직 거래처가 아닙니다.

        ★ 키가 비어 있으면 아무것도 안 붙습니다.
      */}
      {SITE.channelTalkKey && <ChannelTalk pluginKey={SITE.channelTalkKey} />}
    </div>
  );
}

// ---------- 머리 ----------

function Header({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8EBF0] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1080px] items-center px-6">
        <Logo big />

        <nav className="ml-auto flex items-center gap-1 sm:gap-5">
          <a href="#why" className="hidden text-[13.5px] font-semibold text-[#4A5567] hover:text-[#1279E8] sm:block">
            모델리스
          </a>
          <a href="#flow" className="hidden text-[13.5px] font-semibold text-[#4A5567] hover:text-[#1279E8] sm:block">
            진행 과정
          </a>
          <a href="#products" className="hidden text-[13.5px] font-semibold text-[#4A5567] hover:text-[#1279E8] sm:block">
            취급 보철
          </a>
          <a href="#contact" className="hidden text-[13.5px] font-semibold text-[#4A5567] hover:text-[#1279E8] sm:block">
            수가표 요청
          </a>

          <Link
            href={loggedIn ? '/' : '/login'}
            className="ml-2 grid h-9 place-items-center rounded-lg bg-[#1279E8] px-4 text-[13.5px] font-bold text-white hover:bg-[#0F68C9]"
          >
            {loggedIn ? '내 화면으로' : '로그인'}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/**
 * ★ 마크도 글자도 공용 조각입니다 (2026-08-18).
 *   전에는 여기만 따로 그린 마크가 있었고(2026-08-14 합침), 그다음엔
 *   글자만 홈페이지가 달랐습니다 — `DS DENTAL LAB` → `Denflow`.
 *   플랫폼과 다른 로고를 홈페이지가 달고 있어도 아무도 모릅니다.
 *   이제 로그인·사이드바와 **같은 조각**을 씁니다.
 *
 * ★ 맨 위와 맨 아래가 이것 하나를 씁니다.
 */
/**
 * ★ 맨 위는 크게, 맨 아래는 그대로 (사용자 요청 2026-08-18).
 *   머리줄 로고는 **처음 눈이 닿는 곳**이라 간판만 한 크기가 필요합니다.
 *   바닥은 이미 읽고 내려온 자리여서 같이 키우면 무겁습니다.
 *   높이 64px 머리줄에 28px 마크면 위아래로 18px씩 남습니다.
 */
function Logo({ big = false }: { big?: boolean }) {
  return big ? (
    <DenFlowLogo markHeight={28} fontSize={21} gap={11} />
  ) : (
    <DenFlowLogo markHeight={22} fontSize={17} />
  );
}

// ---------- 첫 화면 ----------

/**
 * ★ 첫 화면을 두 칸으로 나눴습니다 (2026-08-14).
 *   전에는 글만 있고 오른쪽이 통째로 비어 있었습니다. 기공소 홈페이지에
 *   처음 온 사람이 가장 먼저 확인하고 싶은 것은 **뭘로 만드느냐**입니다.
 *   좁은 화면에서는 글이 위, 장면이 아래로 자연스럽게 접힙니다.
 */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[#E8EBF0] bg-gradient-to-b from-[#F7FAFF] to-white">
      <div className="mx-auto grid max-w-[1080px] items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_minmax(0,360px)] lg:gap-16">
        <div>
          <p data-reveal className="text-[14px] font-bold tracking-[0.14em] text-[#1279E8]">{SITE.tagline.toUpperCase()}</p>

          {/*
            ★ 첫 줄이 길어서 크기를 줄였습니다 (2026-08-14). 브라우저에서
              재서 맞춘 값입니다.

              44px 로 두면 두 칸 배치(lg)에서 넘쳐 '간결하게' 한 마디만
              다음 줄로 떨어집니다. 그 모양이 제일 안 좋습니다.

            ★ 36px 도 아슬아슬했습니다 — 1024px 화면에서 여유가 21px
              뿐이었습니다. 한글 글꼴은 기계마다 다릅니다(윈도우는 맑은
              고딕, 맥은 애플 SD 산돌고딕). 여기서 딱 맞는 값은 **저쪽에서
              넘칩니다.** 재 보고 정할 때는 넉넉한 쪽으로 잡아야 합니다.
          */}
          {/* ★ 제일 큰 글이라 **안 늦춥니다.** 첫 화면의 큰 글이 늦게
                뜨면 화면 전체가 느린 것처럼 보입니다(LCP) */}
          <h1
            data-reveal
            className="mt-4 text-balance text-[27px] font-extrabold leading-[1.3] tracking-[-0.045em] sm:text-[34px]"
          >
            모델은 생략하고, 과정은 간결하게
            <br />
            <span className="text-[#1279E8]">스캔에서 바로 보철로</span>
          </h1>

          <p
            data-reveal
            style={{ transitionDelay: '90ms' }}
            className="mt-6 max-w-[520px] text-[15px] leading-relaxed text-[#4A5567]"
          >
            모델 제작의 번거로움 없이
            <br />
            스캔 데이터에서 최종 보철까지
            <br />
            <b className="font-bold text-[#1A2130]">하나의 디지털 프로세스로</b>
          </p>

          <div data-reveal style={{ transitionDelay: '180ms' }} className="mt-9 flex flex-wrap gap-2.5">
            <a
              href="#contact"
              className="grid h-12 place-items-center rounded-lg bg-[#1279E8] px-7 text-[15px] font-bold text-white hover:bg-[#0F68C9]"
            >
              수가표 요청하기
            </a>
            <a
              href="#flow"
              className="grid h-12 place-items-center rounded-lg border border-[#DDE2EA] px-7 text-[15px] font-bold text-[#4A5567] hover:bg-[#F4F6F9]"
            >
              진행 과정 보기
            </a>
          </div>
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

// ---------- 왜 모델리스인가 ----------

const REASONS = [
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
    <Section id="why" eyebrow="WHY MODELLESS" title="왜 모델리스인가">
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {REASONS.map((r, i) => (
          <div key={r.title} className="rounded-xl border border-[#E8EBF0] bg-white p-6">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#EAF2FE] text-[15px] font-extrabold text-[#1279E8]">
              {i + 1}
            </span>
            <h3 className="mt-4 text-[16px] font-extrabold tracking-[-0.02em]">{r.title}</h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#4A5567]">{r.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------- 진행 과정 ----------

/**
 * ★ 한 단계에 한 줄만 씁니다 (사용자 요청 2026-08-14 — "설명을 줄이고
 *   간단명료하게"). 진행 과정은 **읽는 곳이 아니라 훑는 곳**입니다.
 *   자세한 것은 수가표를 받고 통화할 때 나옵니다.
 *
 * ★ '사전 검토' 를 스캔 전송 바로 뒤에 넣었습니다 (사용자 요청).
 *   지어낸 단계가 아닙니다 — 실제로 디자인센터가 스캔을 보고
 *   '재스캔' 으로 되돌리는 길이 시스템에 있습니다. 이 단계를 안 적으면
 *   치과 입장에서는 보낸 뒤 감감무소식으로 보입니다.
 */
const STEPS = [
  { step: '01', art: 'scan', title: '스캔 전송', body: '스캔 파일과 처방을 올립니다.' },
  { step: '02', art: 'review', title: '사전 검토', body: '스캔 상태를 먼저 봅니다. 다시 떠야 하면 그때 알려 드립니다.' },
  { step: '03', art: 'design', title: '디자인', body: '담당 디자이너가 맡아 설계합니다.' },
  { step: '04', art: 'mill', title: '제작', body: '설계 그대로 밀링합니다.' },
  { step: '05', art: 'ship', title: '납품', body: '요청하신 날에 맞춰 보냅니다.' },
] as const;

/**
 * ★ 칸(타일)에서 **걸음(stepper)** 으로 바꿨습니다 (사용자 요청 2026-08-14 —
 *   "아이콘이 크고 단계별로 직관적으로").
 *
 *   타일 다섯 개는 '다섯 가지' 로 보입니다. 순서가 있는 일인데 순서가
 *   안 읽혔습니다. 동그라미를 선으로 이어 두면 **왼쪽에서 오른쪽으로
 *   흐르는 한 줄**이 됩니다.
 *
 * ★ 아이콘을 27px → 36px 로 키우고 동그라미 안에 넣었습니다.
 *   어두운 바탕이라 선이 얇으면 멀리서 뭉갭니다 — 굵기도 한 단계 올렸습니다.
 *
 * ★ 잇는 선은 **마지막 칸에는 안 그립니다.** 그리면 다음에 뭔가 더
 *   있는 것처럼 보입니다.
 */
function Flow() {
  return (
    <Section id="flow" eyebrow="PROCESS" title="스캔을 보내면, 이렇게 갑니다" dark>
      <ol className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
        {STEPS.map((s, i) => (
          <li key={s.step} className="relative flex flex-col items-center text-center">
            {/*
              다음 걸음으로 잇는 선. 마지막 칸에는 안 그립니다 —
              그리면 뒤에 뭔가 더 있는 것처럼 보입니다.

              ★ 가로로 늘어설 때(lg)와 세로로 쌓일 때(좁은 화면)의 선이
                다릅니다. 두 칸씩 놓이는 중간 폭에서는 **아무 선도 안
                그립니다** — 그 배치에서 아래로 선을 그으면 바로 다음
                걸음이 아니라 두 칸 건너를 가리킵니다.
            */}
            {i < STEPS.length - 1 && (
              <>
                {/* 가로 — 동그라미 한가운데 높이 */}
                <span
                  aria-hidden
                  className="absolute left-1/2 top-9 hidden h-px w-full bg-[#33456B] lg:block"
                />
                {/* 세로 — 동그라미 아래부터 다음 동그라미 위까지 (72px + 칸 사이 40px) */}
                <span
                  aria-hidden
                  className="absolute left-1/2 top-[72px] h-[calc(100%-32px)] w-px bg-[#33456B] sm:hidden"
                />
              </>
            )}

            <span className="relative z-10 grid h-[72px] w-[72px] place-items-center rounded-full border border-[#33456B] bg-[#1B2438]">
              <SiteArt name={s.art} className="h-9 w-9 text-[#8FB6F5]" strokeWidth={1.7} />
            </span>

            <span className="mt-4 text-[12px] font-extrabold tracking-[0.16em] text-[#5B8DE8]">
              {s.step}
            </span>

            <h3 className="mt-1.5 text-[17px] font-extrabold tracking-[-0.02em] text-white">
              {s.title}
            </h3>

            <p className="mt-2 max-w-[220px] text-[13.5px] leading-relaxed text-[#9FADC7]">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// ---------- 취급 보철 ----------

/**
 * ★ 여기 적힌 것이 **실제 제품 표와 글자·색까지 같습니다.**
 *   홈페이지에만 있는 품목을 적어 두면 주문 화면에서 못 고르고,
 *   그 전화를 저희가 받습니다.
 *
 * ★ 고정성만 합니다 (사용자 확인 2026-08-14).
 *   덴쳐 같은 가철성 보철은 취급하지 않습니다 — 모델리스 공정과
 *   애초에 맞지 않습니다.
 *
 * ★ 그렇다고 **"안 합니다" 를 화면에 적지는 않습니다.**
 *   한 줄 적어 뒀다가 사용자 요청으로 뺐습니다(2026-08-14).
 *   덧붙이던 안내문 두 줄도 같이 뺐습니다 — 목록만 두는 편이
 *   깔끔하다는 판단입니다. 다시 넣지 마세요.
 */
const PRODUCTS = [
  { name: '크라운', art: 'crown', items: ['지르코니아', 'PMMA'], color: '#E0409A', soft: '#FCEAF3' },
  { name: '인레이', art: 'inlay', items: ['하이브리드', '지르코니아'], color: '#1B63E8', soft: '#EDF3FE' },
  { name: '임플란트', art: 'implant', items: ['Abut + Zir (SCRP)', 'Abut + Zir (Cementation)', 'Abut + PMMA', '커스텀 어버트먼트'], color: '#7C6BE8', soft: '#EDEBFB' },
] as const;

function Products() {
  return (
    <Section id="products" eyebrow="PRODUCTS" title="취급 보철">
      <p className="mt-3 text-[14.5px] leading-relaxed text-[#4A5567]">
        지르코니아 크라운 · 인레이 · 임플란트 보철을 만듭니다. 전부 밀링으로 나옵니다.
      </p>

      <div className="mt-9 grid gap-5 sm:grid-cols-3">
        {PRODUCTS.map((p) => (
          <div key={p.name} className="rounded-xl border border-[#E8EBF0] p-6">
            <div className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
                style={{ background: p.soft, color: p.color }}
              >
                <SiteArt name={p.art} className="h-6 w-6" />
              </span>
              <span
                className="inline-block rounded-md px-2.5 py-1 text-[14px] font-extrabold"
                style={{ background: p.soft, color: p.color }}
              >
                {p.name}
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {p.items.map((item) => (
                <li key={item} className="flex gap-2 text-[13.5px] text-[#4A5567]">
                  <span style={{ color: p.color }}>·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
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
    <Section eyebrow="DEN FLOW" title="주문부터 정산까지, 전화 없이">
      <div className="mt-8 grid gap-8 sm:grid-cols-[1.1fr_1fr] sm:items-center">
        <ul className="space-y-3.5">
          {PLATFORM.map((line) => (
            <li key={line} className="flex gap-3 text-[14.5px] leading-relaxed text-[#4A5567]">
              <svg className="mt-[3px] h-[17px] w-[17px] shrink-0 text-[#1279E8]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10.5 8 14.5 16 5.5" />
              </svg>
              {line}
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-[#E8EBF0] bg-[#F7FAFF] p-7">
          <p className="text-[14px] font-bold text-[#1A2130]">거래 치과로 등록하시면</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[#4A5567]">
            주문 화면이 바로 열립니다. 가입하시면 확인 후 승인해 드립니다.
          </p>
          <Link
            href="/signup"
            className="mt-5 grid h-11 place-items-center rounded-lg bg-[#1279E8] text-[14px] font-bold text-white hover:bg-[#0F68C9]"
          >
            가입 신청
          </Link>
        </div>
      </div>
    </Section>
  );
}

// ---------- 문의 ----------

function Contact() {
  return (
    <section id="contact" className="border-t border-[#E8EBF0] bg-[#F7FAFF]">
      <div className="mx-auto max-w-[1080px] px-6 py-18 sm:py-24">
        <div className="grid gap-10 sm:grid-cols-[0.9fr_1.1fr] sm:items-start">
          {/* ★ 붙어 따라오는 칸(sticky)이라 통째로 올립니다 —
                안쪽을 따로 올리면 따라오는 동안 계속 움직입니다 */}
          <div data-reveal className="sm:sticky sm:top-24">
            <p className="text-[13px] font-bold tracking-[0.14em] text-[#1279E8]">CONTACT</p>
            <h2 className="mt-3 text-[26px] font-extrabold leading-[1.3] tracking-[-0.035em] sm:text-[30px]">
              수가표부터
              <br />
              받아 보세요
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-[#4A5567]">
              거래를 정하지 않으셔도 됩니다. 품목별 수가와 납기를 먼저 보시고
              판단하시면 됩니다.
            </p>

            <div className="mt-7 rounded-xl border border-[#DDE7F7] bg-white p-5">
              <p className="text-[13.5px] font-bold text-[#7C8595]">바로 통화를 원하시면</p>
              <a
                href={`tel:${SITE.tel.replace(/-/g, '')}`}
                className="mt-1.5 block text-[21px] font-extrabold tracking-[-0.03em] text-[#1A2130] hover:text-[#1279E8]"
              >
                {SITE.tel}
              </a>
            </div>
          </div>

          {/* 폼은 살짝 늦게 — 왼쪽 글이 먼저 읽히고 폼이 따라옵니다 */}
          <div data-reveal style={{ transitionDelay: '110ms' }}>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 취급 범위 · 스캐너 ----------

/*
  ★ 네 가지 약속 (사용자 요청 2026-08-18, 시안 지르카).
    어두운 띠 위에 흰 카드 넷 — 제목이 위, 그림이 가운데, 두 줄이 아래.
    카드 한 장이 **한 호흡**에 읽혀야 합니다. 그래서 문장을 넣지 않고
    '걱정 한 줄 → 답 한 줄' 로 끊었습니다.

  ★ 다섯에서 넷으로 줄였습니다.
    넷이면 큰 화면에서 한 줄에 딱 떨어집니다. 다섯은 3+2 로 갈라져
    마지막 줄이 남는데, 한눈에 보이는 것이 이 자리의 목적입니다.

  ★ 네 가지 모두 **실제로 되는 것**입니다 — 파일만 받으면 되는 것,
    주문 상태·실시간 대화, 제품 표 그대로, 리메이크 사유 통계
    (/design/stats). 홈페이지에 적은 것을 화면이 못 하면 그게 제일
    나쁩니다.

  ★ 남색은 로고 몸통(#16324F), 강조는 로고 꼬리(#14B8A6)입니다.
    진행 과정 절의 검정(#141B2B)과 일부러 다르게 뒀습니다 — 어두운
    띠가 둘인데 같은 색이면 같은 절이 두 번 나온 것처럼 보입니다.
*/

const PROMISES: {
  art: SiteArtName;
  title: string;
  /** 걱정 — 흐리게 */
  worry: string;
  /** 답 — 진하게 */
  answer: string;
}[] = [
  {
    art: 'scan',
    title: '스캐너 무관',
    worry: '장비 바꾸실 필요 없이',
    answer: '쓰시던 그대로, 파일만',
  },
  {
    art: 'track',
    title: '실시간 진행상황 공유',
    worry: '굳이 물어보지 않으셔도',
    answer: '접수 → 배송 화면에서 바로',
  },
  {
    art: 'bridge',
    title: '모델리스 전 품목',
    worry: '크라운·브릿지, 인레이·온레이',
    answer: '임플란트 보철까지 모델 없이',
  },
  {
    art: 'chart',
    title: '리메이크 통계 & 분석',
    worry: '원인 모르고 넘어가지 않게',
    answer: '매달 모아 분석하고 고칩니다',
  },
];

function Scope() {
  return (
    <section className="bg-[#16324F]">
      <div className="mx-auto max-w-[1080px] px-6 py-16 sm:py-20">
        {/*
          ★ 한 줄로 크게 (사용자 요청 2026-08-18).
            두 줄로 나눠 두었더니 위가 설명, 아래가 제목이라 눈이 두 번
            움직였습니다. 한 문장이면 한 번에 읽힙니다.

          ★ 상호만 로고 꼬리색으로 둡니다. 한 줄에 색이 둘이면
            거기서 끊어 읽게 되는데, 끊기는 자리가 쉼표라 자연스럽습니다.

          ★ 크기를 셋으로 나눴습니다 — 좁은 화면에서 42px 로 두면
            열네 글자가 넘칩니다. 한글 글꼴은 기계마다 폭이 달라서
            (윈도우 맑은고딕 · 맥 애플SD산돌고딕) 딱 맞는 값을 하나로
            잡으면 저쪽에서 넘칩니다. `text-balance` 로 쉼표에서
            고르게 나뉘도록 뒀습니다.
        */}
        <h2
          data-reveal
          className="text-balance text-center text-[25px] font-extrabold leading-[1.25] tracking-[-0.04em] text-white sm:text-[34px] lg:text-[42px]"
        >
          스캔에서 세팅까지, <span className="text-[#6FD8CB]">덴플로우</span>
        </h2>

        {/* ★ 큰 화면에서 넷이 한 줄. 한눈에 보이는 것이 이 자리의 목적입니다 */}
        <ul className="mt-12 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p, i) => (
            <li
              key={p.title}
              data-reveal
              style={{ transitionDelay: `${i * 80}ms` }}
              className="flex flex-col items-center rounded-2xl bg-white px-5 py-8 text-center"
            >
              {/*
                ★ 제목이 카드에서 제일 먼저 읽히는 것이라 크게 잡았습니다.
                  다만 '리메이크 통계 & 분석' 은 열두 글자라 248px 카드에서
                  한 줄에 안 들어갑니다. 한 카드만 두 줄이 되면 그 카드의
                  그림이 아래로 밀려 넷의 눈높이가 어긋납니다.
                  그래서 **모든 제목이 두 줄 자리를 차지**하게 뒀습니다
                  (min-h 2.6em = 1.3줄높이 × 2). 짧은 제목 아래가 조금
                  비지만, 그림 넷이 나란한 편이 훨씬 잘 읽힙니다.
              */}
              <b className="flex min-h-[2.6em] items-center text-balance text-[21px] font-extrabold leading-[1.3] tracking-[-0.04em] text-[#16324F] sm:text-[22px]">
                {p.title}
              </b>

              {/*
                ★ 그림을 키우면서 **선도 같이 굵혔습니다**(1.7 → 1.95).
                  선 굵기를 그대로 두고 크기만 키우면, 그림이 커질수록
                  선이 상대적으로 가늘어져 오히려 흐려 보입니다.
              */}
              <span className="my-5 grid h-[68px] w-[68px] place-items-center rounded-2xl bg-[#EAF6F4] text-[#0E8C7F]">
                <SiteArt name={p.art} className="h-10 w-10" strokeWidth={1.95} />
              </span>

              <span className="text-[14px] font-medium leading-relaxed text-[#7C8595]">
                {p.worry}
              </span>
              <b className="mt-1.5 text-balance text-[16px] font-extrabold leading-[1.45] tracking-[-0.02em] text-[#1A2130]">
                {p.answer}
              </b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- 바닥 ----------

function Footer() {
  return (
    <footer className="border-t border-[#E8EBF0] bg-white">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4 px-6 py-9 sm:flex-row sm:items-center">
        <div>
          <Logo />
          <p className="mt-2.5 text-[13.5px] text-[#98A2B3]">
            {SITE.tagline} · {SITE.tel}
          </p>
        </div>

        <div className="flex flex-wrap gap-4 sm:ml-auto">
          <Link href="/terms" className="text-[13.5px] font-semibold text-[#4A5567] hover:text-[#1279E8]">
            이용약관
          </Link>
          <Link href="/privacy" className="text-[13.5px] font-semibold text-[#4A5567] hover:text-[#1279E8]">
            개인정보 처리방침
          </Link>
          <Link href="/login" className="text-[13.5px] font-semibold text-[#4A5567] hover:text-[#1279E8]">
            로그인
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ---------- 틀 ----------

function Section({
  id,
  eyebrow,
  title,
  children,
  dark = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <section id={id} className={dark ? 'bg-[#141B2B]' : 'bg-white'}>
      {/*
        ★ 머리글에만 답니다 (2026-08-18).
          안쪽 내용까지 조각조각 올리면, 한 화면에서 대여섯 개가 따로
          움직여 어지럽습니다. 절의 제목이 올라오고 내용이 따라오는
          정도가 읽기에 제일 편합니다.
      */}
      <div className="mx-auto max-w-[1080px] px-6 py-18 sm:py-24">
        <p data-reveal className="text-[13px] font-bold tracking-[0.14em] text-[#1279E8]">
          {eyebrow}
        </p>
        <h2
          data-reveal
          style={{ transitionDelay: '80ms' }}
          className={
            'mt-3 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px] ' +
            (dark ? 'text-white' : 'text-[#1A2130]')
          }
        >
          {title}
        </h2>
        <div data-reveal style={{ transitionDelay: '160ms' }}>
          {children}
        </div>
      </div>
    </section>
  );
}
