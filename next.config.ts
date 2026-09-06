import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    ★ 서버 함수에서 sharp 를 뺍니다 (2026-09-06).
      함수 하나가 19MB 였는데 그중 10MB 가 sharp(이미지 변환기)와 그 wasm
      판이었습니다. 우리 코드는 sharp 를 안 부르고, 이미지 축소는 Vercel 이
      함수 밖에서 합니다(/_next/image). 함수가 작을수록 콜드 스타트가
      짧습니다 — 느림의 정체가 그것이었습니다 (api/warm 의 설명).
  */
  outputFileTracingExcludes: {
    '*': ['**/node_modules/sharp/**', '**/node_modules/@img/**'],
  },
  experimental: {
    /*
      ★ 미리 받아 둔 화면을 얼마나 오래 믿을지 (2026-09-06).
        탭·주문 줄에 마우스를 올리면 그 화면을 통째로 미리 받습니다
        (SectorShell · OrderTableRow 의 router.prefetch). 기본값은 5분인데,
        5분 전 화면이 그대로 뜨면 새 주문이 빠져 보일 수 있습니다.
        30초면 20초마다 도는 자동 갱신(AutoRefresh)과 같은 결이라
        사람이 이미 감수하고 있는 늦음 안에 듭니다.
    */
    staleTimes: { static: 30 },
  },
};

export default nextConfig;
