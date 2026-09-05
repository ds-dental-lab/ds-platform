import type { Metadata } from "next";
import "./globals.css";
import EnvBadge from "@/components/layout/EnvBadge";
import {
  SITE_URL,
  SITE_TITLE,
  SITE_DESCRIPTION,
  NAVER_VERIFICATION,
  GOOGLE_VERIFICATION,
} from "@/server/domain/site";

/*
  ★ 웹폰트를 안 씁니다 (2026-08-13 — 화면이 느리다는 지적을 재 보고).

    create-next-app 이 넣은 Geist·Geist Mono 가 **모든 화면에서 preload**
    되고 있었는데, 정작 어디에도 안 붙어 있었습니다.
    globals.css 의 `--font-sans: var(--font-sans)` 가 **자기 자신을 가리켜**
    값이 비었고, 그래서 브라우저 기본 글꼴이 그려지고 있었습니다.
    로그인 화면에서 잰 결과 woff2 두 개가 첫 그림을 붙잡고 있었습니다.

    빼도 **보이는 것은 그대로입니다** — 원래 안 쓰이던 글꼴입니다.
    대신 `--font-sans`·`--font-mono` 에 내려받을 것이 없는 시스템 글꼴을
    적어 두었습니다(globals.css). 로그인·가입 화면은 예전부터 자기
    글꼴 목록을 따로 갖고 있어 영향이 없습니다.

  ★ 청구서의 나눔고딕은 그대로입니다 (lib/fonts).
    거기는 인쇄물이라 기계마다 달라지면 안 됩니다.
*/

/*
  ★ 검색 결과에 뜨는 글입니다 (사용자 요청 2026-08-15 —
    "네이버 검색하면 나오게 하고싶어").

    제목은 **상호만** 나갑니다 (2026-08-18 요청).
    한때 `DenFlow` 한 단어였다가, 무엇을 하는 곳인지 알려야 한다며
    `DS 덴탈랩 · 모델리스 전문 기공소` 로 늘렸는데, 상호를 아는
    사람이 검색했을 때 지저분하다는 지적을 받았습니다.
    설명은 description 과 구조화 데이터가 맡습니다 — 제목은 간판입니다.

  ★ 구조화 데이터(누구인가 · 로고)는 홈페이지에만 답니다.
    `components/site/SiteJsonLd` 가 그 일을 하고, 여기 메타 정보와
    같은 `domain/site` 값을 봅니다.

  ★ 값은 `domain/site` 한 곳에서 옵니다. 여기·robots·sitemap 이
    같은 주소를 봐야 검색엔진이 한 사이트로 셉니다.

  ★ `openGraph` 는 카카오톡·네이버 블로그에 주소를 붙였을 때 뜨는
    미리보기입니다. 없으면 링크가 맨 글자로 나가서 아무도 안 누릅니다.

  ★ 소유확인 코드는 비어 있으면 태그가 아예 안 붙습니다.
    채우는 법은 `domain/site` 주석에 적어 뒀습니다.
*/
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // 다른 화면은 "무엇 · 덴플로우 디지털 기공소" 로 나갑니다
    template: `%s · ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: 'DenFlow',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'ko_KR',
  },
  verification: { other: siteVerification() },
};

/** 값이 든 것만 붙입니다. 빈 태그가 나가면 소유확인이 오히려 실패합니다 */
function siteVerification(): Record<string, string> {
  const tags: Record<string, string> = {};

  if (NAVER_VERIFICATION) tags['naver-site-verification'] = NAVER_VERIFICATION;
  if (GOOGLE_VERIFICATION) tags['google-site-verification'] = GOOGLE_VERIFICATION;

  return tags;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/*
          ★ 큰 PNG 아이콘 하나를 더 답니다 (사용자 요청 2026-09-04 — PC
            바로가기가 이 모양으로 나오게). favicon.ico·icon.svg·
            apple-icon 은 Next 가 파일 규약으로 이미 답니다. 그런데
            크롬의 '바로가기 만들기' 는 페이지의 <link rel="icon"> 중
            **제일 큰 래스터**를 집는데, SVG 는 크기가 없어 48px ICO 를
            골라 흐릿하게 나옵니다. 512 PNG 가 있으면 그걸 씁니다.
          ★ 파일은 manifest 와 같은 /pwa-512.png — make-icons.mjs 가
            icon.svg 에서 만듭니다. 손으로 고치는 파일이 아닙니다.
        */}
        <link rel="icon" type="image/png" sizes="512x512" href="/pwa-512.png" />
      </head>
      {/*
        ★ body 를 flex 로 두면 안 됩니다.
          create-next-app 이 남긴 `flex flex-col` 인데, 이 안의 페이지는
          **fit-content** 로 크기가 잡힙니다. 그래서 치식도처럼 넓은 것이
          하나만 있어도 **페이지 전체가 창보다 넓어집니다.**
          그러면 상단바·사이드바는 `fixed` 라 창에 붙어 있는데 본문만
          옆으로 밀려 — 오른쪽으로 스크롤하면 머리가 잘린 화면이 됩니다.
          블록으로 두면 페이지는 창 폭에 맞고, 넓은 것은 제자리에서
          가로로 스크롤합니다. 여기에 기대는 화면은 없습니다.
      */}
      <body className="min-h-full">
        {/* 시험 환경에서만 보이는 띠. 운영에서는 아무것도 안 그립니다 */}
        <EnvBadge />
        {children}
      </body>
    </html>
  );
}
