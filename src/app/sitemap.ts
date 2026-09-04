// =========================================================
// 놓을 위치: src/app/sitemap.ts  (Next 규약 — /sitemap.xml 로 나갑니다)
//
// 검색엔진에 "이 주소들을 봐 달라" 고 내미는 목록입니다.
// (사용자 요청 2026-08-15)
//
// ★ **로그인해야 열리는 화면은 안 넣습니다.** robots.txt 에서 막아 둔
//   것을 여기 적으면 서로 모순됩니다 — 막아 놓고 봐 달라는 꼴입니다.
//   검색엔진이 그걸 경고로 알려 주기도 합니다.
//
// ★ `lastModified` 를 `new Date()` 로 두지 않습니다.
//   그러면 sitemap 을 부를 때마다 "방금 바뀌었다" 고 말하게 됩니다.
//   내용은 그대로인데 매번 바뀌었다고 하면, 검색엔진이 이 값을
//   **믿지 않기 시작합니다.** 실제로 글을 고친 날을 손으로 적습니다.
// =========================================================

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/server/domain/site';

/** 홈페이지 글을 마지막으로 고친 날 — 고칠 때 같이 올려 주세요 */
const HOME_UPDATED = new Date('2026-08-18');

/** 처리방침을 마지막으로 고친 날 */
const PRIVACY_UPDATED = new Date('2026-08-13');

/** 이용약관을 마지막으로 고친 날 */
const TERMS_UPDATED = new Date('2026-08-19');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: HOME_UPDATED,
      changeFrequency: 'monthly',
      priority: 1,
    },
    /*
      ★★ /signup 을 **뺐습니다** (사용자 지적 2026-09-04).
        "거래처가 되려면 지나는 문" 이라며 넣어 뒀는데, 네이버가 상호
        검색에 홈페이지 대신 **가입 페이지를 첫 결과로** 내보냈습니다.
        제목에 옛 상호(DS 덴탈랩)까지 캐시된 채로요.

        가입 페이지는 검색에서 들어올 이유가 없습니다 — 홈페이지에서
        '거래 신청' 을 누르면 갑니다. 검색이 잡아야 할 것은 간판 하나,
        홈페이지입니다. (auth)/signup/layout 에서 noindex 도 같이 겁니다.
    */
    {
      url: `${SITE_URL}/terms`,
      lastModified: TERMS_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: PRIVACY_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
