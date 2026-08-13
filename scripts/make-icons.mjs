// =========================================================
// 놓을 위치: scripts/make-icons.mjs
// 쓰는 법:  node scripts/make-icons.mjs
//
// src/app/icon.svg 하나에서 래스터 아이콘 둘을 만듭니다.
//   src/app/favicon.ico   16·32·48 세 장을 담은 ICO
//   src/app/apple-icon.png 180x180 (아이폰 홈 화면)
//
// ★ 손으로 고치는 파일이 아닙니다. 마크를 바꾸면 icon.svg 만 고치고
//   이것을 다시 돌리세요. 셋이 어긋나면 탭·홈화면·북마크에서
//   서로 다른 로고가 보입니다.
//
// ★ 아이폰용은 **모서리를 안 깎고 여백을 더 줍니다.**
//   iOS 가 알아서 둥글게 자릅니다. 우리가 미리 깎아 두면 두 번 깎여
//   모서리에 흰 자국이 남고, 자를 때 그림 끝이 잘려 나갑니다.
//
// ★ ICO 를 아직 만드는 이유: /favicon.ico 를 그냥 찔러 보는 곳이
//   남아 있습니다(북마크·검색·구형 브라우저). SVG 가 주력이고
//   이것은 대비책입니다. ICO 안에는 PNG 를 그대로 넣습니다.
// =========================================================

import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const APP = new URL('../src/app/', import.meta.url);

/* 아이폰용 — 모서리 안 깎고(rx 0) 그림을 0.78 로 줄여 여백을 둡니다 */
const APPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="8" y1="72" x2="94" y2="28">
      <stop offset="0%" stop-color="#16D6D1"/>
      <stop offset="55%" stop-color="#2D7BF4"/>
      <stop offset="100%" stop-color="#7159F7"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#g)"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round"
     transform="translate(50 50) scale(0.78) translate(-60 -50)">
    <path d="M33 28 C50 33, 65 43, 76 50"/>
    <path d="M28 50 H76"/>
    <path d="M33 72 C50 67, 65 57, 76 50"/>
    <path d="M76 50 H92"/>
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

console.log(`favicon.ico  ${sizes.join('·')} 세 장`);
console.log('apple-icon.png  180x180');
