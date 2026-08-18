// =========================================================
// 놓을 위치: src/components/site/SiteJsonLd.tsx
//
// 검색엔진에게 "이 사이트가 누구인가" 를 기계가 읽는 형식으로
// 알려 줍니다. (사용자 요청 2026-08-18 — "검색창에 로고가 비어있는데")
//
// ★ 이것이 **통째로 없었습니다.**
//   제목·설명·og:image 는 다 있었는데 구조화 데이터가 0개였습니다.
//   그래서 검색엔진 입장에서 우리는 '어떤 웹페이지' 일 뿐, **로고를
//   가진 조직**이 아니었습니다. 로고 자리가 비는 것이 당연합니다.
//
// ★ 로고는 주소가 안 변하는 곳(`public/logo.png`)을 가리킵니다.
//   구글은 이 그림을 따로 받아 두고 한동안 재사용합니다. 빌드마다
//   주소가 바뀌면 매번 새 그림으로 보고, 결국 아무것도 안 붙습니다.
//
// ★ 지어낸 것을 안 넣습니다.
//   주소(사업장)·SNS·평점은 아직 확인된 것이 없어 **아예 뺐습니다.**
//   구조화 데이터에 없는 사실을 적으면 그건 검색엔진에게 하는 거짓말이고,
//   들키면 사이트 전체가 신뢰를 잃습니다. 사업자등록이 나오면 그때
//   주소를 넣고 LocalBusiness 로 올립니다 ([[ds-flow-backlog]]).
//
// ★ WebSite 의 name 이 **구글이 결과에 찍는 사이트 이름**입니다.
//   제목 태그와 따로 놉니다 — 둘을 안 맞추면 결과에 엉뚱한 이름이 뜹니다.
//   상호·제목·사이트명이 모두 `domain/site` 의 한 값에서 나옵니다.
// =========================================================

import {
  SITE_URL,
  SITE_NAME,
  SITE_NAME_TIGHT,
  SITE_DESCRIPTION,
  SITE_LOGO,
  SITE_LOGO_SIZE,
  SITE_TEL,
} from '@/server/domain/site';

const ORG_ID = `${SITE_URL}/#organization`;

const GRAPH = [
  {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    // 붙여 쓴 이름 — 그렇게 쳐도 여기로 모이게
    alternateName: SITE_NAME_TIGHT,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    telephone: SITE_TEL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}${SITE_LOGO}`,
      width: SITE_LOGO_SIZE,
      height: SITE_LOGO_SIZE,
    },
    // 미리보기 그림과 같은 것 — 검색엔진이 큰 그림을 찾을 때 씁니다
    image: `${SITE_URL}/opengraph-image`,
  },
  {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    // 구글이 결과에 찍는 사이트 이름
    name: SITE_NAME,
    alternateName: SITE_NAME_TIGHT,
    inLanguage: 'ko-KR',
    publisher: { '@id': ORG_ID },
  },
];

export default function SiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      // 우리가 만든 값만 들어갑니다 — 바깥에서 오는 글자가 없습니다
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': GRAPH }),
      }}
    />
  );
}
