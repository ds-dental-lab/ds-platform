// =========================================================
// 놓을 위치: src/app/manifest.ts
//
// 홈 화면에 얹기 위한 명세. (명세서 SPEC_shade-photo Phase 3)
//
// ★★ **시작 자리가 `/` 입니다** (2026-09-04, 사용자 요청 — PC 바로가기·
//   크롬 '앱 설치' 에서도 이 아이콘으로 뜨게).
//   전에는 `/m` 이었습니다 — 홈 화면에 얹는 사람은 진료실뿐이라고 봤고,
//   홈페이지가 뜨면 촬영까지 두 번을 더 눌러야 했으니까요.
//   그런데 8/24 에 `/` 가 **치과+폰이면 /m 으로** 보내게 됐습니다
//   (page.tsx · domain/device). 그래서 이제 `/` 로 두어도 진료실 폰은
//   똑같이 촬영 화면에 떨어지고, 센터 PC 에서 설치하면 제 HOME 으로
//   갑니다. `/m` 그대로면 센터가 설치했을 때 '치과 계정으로 들어와야
//   합니다' 가 첫 화면이 됩니다.
//
// ★ 이름도 상호 그대로입니다. 제안엔 "DenFlow" 였는데 상호는 한글
//   하나로 통일했습니다 (2026-08-18) — 검색·탭·바로가기가 같은 이름이어야
//   합니다. 진료실 폰에서 보이는 짧은 이름은 '덴플로우' 입니다.
//
// ★ `standalone` — 주소창이 사라집니다. 진료실 폰은 화면이 곧 전부라
//   그 60px 이 아깝고, PC 에서는 크롬 테두리 없는 독립 창이 됩니다.
//
// ★ 아이콘은 `logo.png` 를 안 씁니다. 그건 검색엔진에게 주는 그림이라
//   주소가 안 변해야 하는 파일입니다 (scripts/make-icons.mjs).
//
// ★ `maskable` — 안드로이드가 동그라미·네모로 잘라 갑니다. 여백을
//   넉넉히 둔 그림이라 잘려도 마크가 살아남습니다.
// =========================================================

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '덴플로우 디지털 기공소',
    short_name: '덴플로우',
    description: '스캔에서 바로 보철로 — 치과·센터·기공소가 한 주문을 함께 봅니다',

    // ★ 로그인·소속·기기에 따라 `/` 가 갈라 보냅니다 (진료실 폰 → /m)
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',

    // 브랜드 토큰 (CLAUDE.md)
    background_color: '#F4F7FA',
    theme_color: '#16324F',

    lang: 'ko',

    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
