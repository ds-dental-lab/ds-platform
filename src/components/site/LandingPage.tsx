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
import { SiteArt } from '@/components/site/SiteArt';

/** ★ 고치실 곳은 여기뿐입니다 */
const SITE = {
  name: 'DS 덴탈랩',
  tagline: '모델리스 전문 기공소',
  lead: '모델을 뜨지 않습니다. 스캔 데이터에서 바로 설계하고 밀링합니다.',
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
};

export default function LandingPage({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="min-h-screen bg-white text-[#1A2130]">
      <Header loggedIn={loggedIn} />
      <Hero />
      <Scope />
      <Why />
      <Flow />
      <Products />
      <Platform />
      <Contact />
      <Footer />
    </div>
  );
}

// ---------- 머리 ----------

function Header({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8EBF0] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1080px] items-center px-6">
        <Logo />

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

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg className="h-[22px] w-[32px] shrink-0" viewBox="0 0 142 100" fill="none" aria-label={SITE.name}>
        <path d="M10 8 H40 A42 42 0 0 1 40 92 H10 Z" stroke="#1B2A4A" strokeWidth="12" strokeLinejoin="miter" />
        <path d="M126 58 C126 78 108 92 88 92 C74 92 62 84 58 72 C54 60 62 50 74 46" stroke="#1B2A4A" strokeWidth="12" strokeLinecap="round" />
        <path d="M74 46 C86 42 100 40 108 34" stroke="#1B2A4A" strokeWidth="12" strokeLinecap="round" />
      </svg>
      <span className="text-[17px] font-extrabold leading-none tracking-[-0.045em]">
        DS <span className="font-semibold text-[#9AA3AE]">DENTAL LAB</span>
      </span>
    </span>
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
          <p className="text-[14px] font-bold tracking-[0.14em] text-[#1279E8]">{SITE.tagline.toUpperCase()}</p>

          <h1 className="mt-4 text-[34px] font-extrabold leading-[1.25] tracking-[-0.045em] sm:text-[44px]">
            모델을 뜨지 않습니다.
            <br />
            <span className="text-[#1279E8]">스캔에서 바로 보철로.</span>
          </h1>

          <p className="mt-6 max-w-[520px] text-[15px] leading-relaxed text-[#4A5567]">
            석고 모델을 만들고 굳히고 다듬는 시간이 통째로 빠집니다. 구강 스캔 데이터를 받아
            그대로 설계하고 밀링합니다. <b className="font-bold text-[#1A2130]">덜 거치니 덜 틀어집니다.</b>
          </p>

          <div className="mt-9 flex flex-wrap gap-2.5">
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

        <div>
          <MillingStage
            youtubeId={SITE.heroYouTube || undefined}
            src={SITE.heroVideo || undefined}
            poster={SITE.heroPoster || undefined}
            stopAt={SITE.heroStopAt || undefined}
            credit={SITE.videoCredit || undefined}
          />
          <p className="mt-3.5 text-center text-[12.5px] text-[#98A2B3]">
            지르코니아 디스크 밀링
          </p>
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

function Flow() {
  return (
    <Section id="flow" eyebrow="PROCESS" title="스캔을 보내면, 이렇게 갑니다" dark>
      <div className="mt-10 grid gap-px overflow-hidden rounded-xl bg-[#2A3550] sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s) => (
          <div key={s.step} className="flex flex-col bg-[#1B2438] px-5 py-6">
            <div className="flex items-center gap-2.5">
              <SiteArt name={s.art} className="h-7 w-7 shrink-0 text-[#7FA9F0]" />
              <span className="text-[12.5px] font-extrabold tracking-[0.1em] text-[#5B8DE8]">{s.step}</span>
            </div>
            <h3 className="mt-3.5 text-[15.5px] font-extrabold tracking-[-0.02em] text-white">{s.title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#9FADC7]">{s.body}</p>
          </div>
        ))}
      </div>
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
 *   애초에 맞지 않습니다. 아래에 한 줄로 밝혀 둡니다.
 *   **안 적으면 덴쳐 주문이 들어옵니다.**
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

      <p className="mt-6 text-[14px] text-[#98A2B3]">
        브리지·폰틱, 치은 포셀린, 중복 등록까지 주문 화면에서 그대로 지정하실 수 있습니다.
      </p>

      {/* ★ 안 하는 것을 적어 두는 편이 서로 시간을 아낍니다 */}
      <p className="mt-2 text-[14px] text-[#98A2B3]">
        틀니·부분틀니 등 가철성 보철은 취급하지 않습니다.
      </p>
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
          <div className="sm:sticky sm:top-24">
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

          <ContactForm />
        </div>
      </div>
    </section>
  );
}

// ---------- 취급 범위 · 스캐너 ----------

function Scope() {
  return (
    <section className="border-b border-[#E8EBF0] bg-white">
      <div className="mx-auto grid max-w-[1080px] gap-10 px-6 py-16 sm:grid-cols-2">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#EAF2FE] text-[#1279E8]">
            <SiteArt name="bridge" className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-[21px] font-extrabold leading-snug tracking-[-0.035em]">
              크라운부터 임플란트까지,<br />모두 가능합니다.
            </h2>
            <p className="mt-3.5 text-[13.5px] leading-relaxed text-[#4A5567]">
              크라운·브릿지 / 인레이·온레이 / 임플란트 보철·어버트먼트를 제작합니다.
              상세 수가는 수가표로 안내드립니다.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#EAF2FE] text-[#1279E8]">
            <SiteArt name="file" className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-[21px] font-extrabold leading-snug tracking-[-0.035em]">
              어떤 스캐너를 쓰셔도<br />받습니다.
            </h2>
            <p className="mt-3.5 text-[13.5px] leading-relaxed text-[#4A5567]">
              구강스캔 파일(STL 등)을 보내 주시면 됩니다. 쓰시는 스캐너를 알려 주시면
              맞춰 안내드리겠습니다.
            </p>
          </div>
        </div>
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

        <div className="flex gap-4 sm:ml-auto">
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
      <div className="mx-auto max-w-[1080px] px-6 py-18 sm:py-24">
        <p className="text-[13px] font-bold tracking-[0.14em] text-[#1279E8]">{eyebrow}</p>
        <h2
          className={
            'mt-3 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px] ' +
            (dark ? 'text-white' : 'text-[#1A2130]')
          }
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
