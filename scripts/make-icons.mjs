// =========================================================
// 놓을 위치: scripts/make-icons.mjs
// 쓰는 법:  node scripts/make-icons.mjs
//
// src/app/icon.svg 하나에서 래스터 아이콘 둘을 만듭니다.
//   src/app/favicon.ico   16·32·48 세 장을 담은 ICO
//   src/app/apple-icon.png 180x180 (아이폰 홈 화면)
//   public/logo.png        512x512 (검색 결과 로고 · 구조화 데이터)
//   public/pwa-192.png     192x192 (안드로이드 홈 화면)
//   public/pwa-512.png     512x512 (설치 화면 · 스플래시)
//
// ★ 손으로 고치는 파일이 아닙니다. 마크를 바꾸면 icon.svg 만 고치고
//   이것을 다시 돌리세요. 셋이 어긋나면 탭·홈화면·북마크에서
//   서로 다른 로고가 보입니다.
//
// ★ 아이폰용은 **모서리를 안 깎고 여백을 더 줍니다.**
//   iOS 가 알아서 둥글게 자릅니다. 우리가 미리 깎아 두면 두 번 깎여
//   모서리에 흰 자국이 남고, 자를 때 그림 끝이 잘려 나갑니다.
//
// ★ logo.png 만 `public/` 에 둡니다.
//   검색엔진에게 "이것이 우리 로고" 라고 알려 주는 그림이라 **주소가
//   안 변해야** 합니다. src/app 규약 파일들은 빌드마다 해시가 붙는데,
//   그러면 구글이 매번 다른 그림으로 봅니다.
//
// ★ ICO 를 아직 만드는 이유: /favicon.ico 를 그냥 찔러 보는 곳이
//   남아 있습니다(북마크·검색·구형 브라우저). SVG 가 주력이고
//   이것은 대비책입니다. ICO 안에는 PNG 를 그대로 넣습니다.
// =========================================================

import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const APP = new URL('../src/app/', import.meta.url);

/* 아이폰용 — 모서리 안 깎고(rx 0) 그림을 줄여 여백을 둡니다.
   그림은 icon.svg 와 같은 denflow_C_v2 마크입니다 (2026-08-14 교체) */
const APPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#16324F"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="13"
     transform="translate(50 50) scale(0.66) translate(-60 -56)">
    <path d="M14 82 H 24
             C 33 82, 27 44, 44 34
             C 51 30, 55 40, 60 40
             C 65 40, 69 30, 76 34
             C 93 44, 87 82, 96 82" stroke="#FFFFFF"/>
    <path d="M96 82 H 106" stroke="#14B8A6"/>
  </g>
</svg>`;

/** PNG 여러 장을 ICO 한 덩어리로 묶습니다. */
function packIco(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // 예약
  head.writeUInt16LE(1, 2); // 1 = 아이콘
  head.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const dir = [];

  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 256 은 0 으로 적는 규약
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // 팔레트 없음
    e.writeUInt8(0, 3); // 예약
    e.writeUInt16LE(1, 4); // 평면
    e.writeUInt16LE(32, 6); // 비트수
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    dir.push(e);
    offset += png.length;
  }

  return Buffer.concat([head, ...dir, ...images.map((i) => i.png)]);
}

const svg = await readFile(new URL('icon.svg', APP));

const sizes = [16, 32, 48];
const images = [];
for (const size of sizes) {
  images.push({
    size,
    png: await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer(),
  });
}

await writeFile(new URL('favicon.ico', APP), packIco(images));

await sharp(Buffer.from(APPLE), { density: 384 })
  .resize(180, 180)
  .png()
  .toFile(new URL('apple-icon.png', APP).pathname.replace(/^\//, ''));

// 검색 결과에 뜨는 로고. 아이폰용과 같은 그림을 크게 뽑습니다 —
// 구글은 정사각을 원하고, 작으면(112px 미만) 아예 안 씁니다
await sharp(Buffer.from(APPLE), { density: 512 })
  .resize(512, 512)
  .png()
  .toFile(new URL('../public/logo.png', import.meta.url).pathname.replace(/^\//, ''));

/*
  홈 화면에 얹는 아이콘. (명세서 Phase 3 — "아이콘=brand 심볼")

  ★ logo.png 를 그대로 쓰지 않습니다. 그건 **검색엔진에게 주는 그림**
    이라 주소가 안 변해야 하는 파일입니다. 쓰임이 다른 것을 한 파일로
    묶으면, 한쪽 사정으로 고칠 때 다른 쪽이 조용히 망가집니다.

  ★ `maskable` 로 씁니다 — 안드로이드가 동그라미·네모로 잘라 갑니다.
    APPLE 그림이 이미 여백을 넉넉히 둔 정사각이라 잘려도 마크가
    살아남습니다.
*/
for (const size of [192, 512]) {
  await sharp(Buffer.from(APPLE), { density: 512 })
    .resize(size, size)
    .png()
    .toFile(new URL(`../public/pwa-${size}.png`, import.meta.url).pathname.replace(/^\//, ''));
}

console.log(`favicon.ico  ${sizes.join('·')} 세 장`);
console.log('apple-icon.png  180x180');
console.log('public/logo.png  512x512');
console.log('public/pwa-192.png · pwa-512.png');
