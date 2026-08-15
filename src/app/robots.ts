// =========================================================
// 놓을 위치: src/app/robots.ts  (Next 규약 — /robots.txt 로 나갑니다)
//
// 검색엔진에게 **어디까지 봐도 되는지** 알려 줍니다.
// (사용자 요청 2026-08-15 — "네이버 검색하면 나오게 하고싶어")
//
// ★★ 홈페이지와 플랫폼이 **한 주소**에 있습니다. 그래서 이 파일이
//   단순한 SEO 설정이 아니라 **개인정보 문제**이기도 합니다.
//   `/clinic` `/design` `/lab` 아래에는 환자 이름·차트번호가 오갑니다.
//
//   그 화면들은 로그인해야 열리니 검색엔진이 내용을 읽지는 못합니다.
//   다만 **주소 자체가 검색 결과에 남을 수는 있습니다** — 어디선가
//   링크가 걸리면 그렇습니다. 주문 주소가 검색에 뜨는 것만으로도
//   거래처가 놀랍니다. 그래서 명시적으로 막습니다.
//
// ★ 네이버 검색로봇 이름은 **Yeti** 입니다. `*` 로도 걸리지만 따로
//   적어 둡니다 — 네이버 쪽 안내가 그렇게 권하고, 무엇보다 나중에
//   이 파일을 읽는 사람이 "네이버는 어떻게 되나" 를 안 찾아봐도 됩니다.
//
// ★ `/reset` 은 막습니다. 비밀번호를 바꾸는 자리라 검색에서 들어올
//   일이 없고, 메일 링크로만 오는 곳입니다.
// =========================================================

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/server/domain/site';

/** 검색엔진에 안 보일 곳 — 로그인해야 열리는 화면들 */
const PRIVATE = ['/clinic/', '/design/', '/lab/', '/reset', '/playground/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      // 네이버
      { userAgent: 'Yeti', allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
