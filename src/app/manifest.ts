// =========================================================
// 놓을 위치: src/app/manifest.ts
//
// 홈 화면에 얹기 위한 명세. (명세서 SPEC_shade-photo Phase 3)
//
// ★★ **시작 자리가 `/m` 입니다.** 이 앱을 홈 화면에 얹는 사람은
//   진료실 스태프뿐입니다 — 데스크톱을 쓰는 센터·기공소는 설치할
//   이유가 없습니다. 얹고 나서 눌렀는데 홈페이지가 뜨면, 거기서
//   또 두 번을 눌러야 촬영에 닿습니다. 3탭 흐름이 5탭이 됩니다.
//
// ★ `standalone` — 주소창이 사라집니다. 진료실 폰은 화면이 곧 전부라
//   그 60px 이 아깝습니다.
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
    name: '덴플로우 쉐이드 촬영',
    short_name: '덴플로우',
    description: '진료실에서 찍은 쉐이드 사진이 의뢰서에 바로 붙습니다',

    start_url: '/m',
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
