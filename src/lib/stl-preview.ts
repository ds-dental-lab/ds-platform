// =========================================================
// 놓을 위치: src/lib/stl-preview.ts
//
// STL 을 **브라우저에서** 여섯 방향으로 그려 한 장의 그림(PNG)으로 만듭니다.
// (사용자 요청 2026-09-28 — 신터링 뒤 크라운이 누구 것인지 눈으로 찾기)
//
// ★ 서버에서 안 그립니다. 디자인 STL 은 수 MB 라 서버로 다시 내려받아 그리면
//   느리고 비쌉니다. 올리는 그 브라우저가 이미 파일을 들고 있습니다.
// ★ 3D 라이브러리(three.js 등)를 안 씁니다 — 삼각형을 면적만큼 점으로 흩뿌리고
//   z 버퍼로 앞의 것만 남깁니다. 런처의 stl_render.py 와 같은 방식이고,
//   붙일 덩치(수백 KB)가 없습니다.
// ★ 두 배로 그린 뒤 줄입니다 — 점이 성긴 자리(구멍)가 메워지고 가장자리가 부드럽습니다.
// =========================================================

/** 위·아래·앞·뒤·왼쪽·오른쪽 (고개를 들고 도는 각도) */
const VIEWS: [number, number][] = [
  [0, 0],
  [180, 0],
  [90, 0],
  [-90, 180],
  [90, 90],
  [90, -90],
];

const CELL = 240;        // 한 방향의 크기
const SUPER = 2;         // 두 배로 그린 뒤 줄입니다

export function isStl(name: string): boolean {
  return name.toLowerCase().endsWith('.stl');
}

/** 이진·아스키 STL → 꼭짓점 (면 수 * 9) */
export function parseStl(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer);
  if (buffer.byteLength > 84) {
    const count = view.getUint32(80, true);
    if (84 + count * 50 === buffer.byteLength) {
      const out = new Float32Array(count * 9);
      for (let i = 0; i < count; i++) {
        const base = 84 + i * 50 + 12;
        for (let k = 0; k < 9; k++) out[i * 9 + k] = view.getFloat32(base + k * 4, true);
      }
      return out;
    }
  }

  const text = new TextDecoder().decode(buffer);
  const nums: number[] = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (s.startsWith('vertex')) {
      const p = s.split(/\s+/);
      nums.push(Number(p[1]), Number(p[2]), Number(p[3]));
    }
  }
  return new Float32Array(nums.slice(0, Math.floor(nums.length / 9) * 9));
}

function rotate(v: Float32Array, elev: number, azim: number): Float32Array {
  const e = (elev * Math.PI) / 180;
  const a = (azim * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
  const out = new Float32Array(v.length);

  for (let i = 0; i < v.length; i += 3) {
    const x = v[i], y = v[i + 1], z = v[i + 2];
    const x1 = ca * x - sa * y;
    const y1 = sa * x + ca * y;
    out[i] = x1;
    out[i + 1] = ce * y1 - se * z;
    out[i + 2] = se * y1 + ce * z;
  }
  return out;
}

/** 한 방향 그림을 rgba 배열에 그립니다 */
function drawView(tris: Float32Array, elev: number, azim: number, size: number, span: number): Uint8ClampedArray {
  const v = rotate(tris, elev, azim);
  const gray = new Uint8ClampedArray(size * size).fill(255);
  const depth = new Float32Array(size * size).fill(-Infinity);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < v.length; i += 3) {
    if (v[i] < minX) minX = v[i];
    if (v[i] > maxX) maxX = v[i];
    if (v[i + 1] < minY) minY = v[i + 1];
    if (v[i + 1] > maxY) maxY = v[i + 1];
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = (size * 0.86) / (span || 1);

  for (let t = 0; t < v.length; t += 9) {
    const ax = (v[t] - cx) * scale + size / 2, ay = (v[t + 1] - cy) * scale + size / 2, az = v[t + 2];
    const bx = (v[t + 3] - cx) * scale + size / 2, by = (v[t + 4] - cy) * scale + size / 2, bz = v[t + 5];
    const cx2 = (v[t + 6] - cx) * scale + size / 2, cy2 = (v[t + 7] - cy) * scale + size / 2, cz = v[t + 8];

    // 면 법선으로 밝기 (앞에서 살짝 위로 비추는 빛)
    const ux = v[t + 3] - v[t], uy = v[t + 4] - v[t + 1], uz = v[t + 5] - v[t + 2];
    const wx = v[t + 6] - v[t], wy = v[t + 7] - v[t + 1], wz = v[t + 8] - v[t + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const lit = Math.min(1, Math.abs(nx * 0.35 + ny * 0.35 + nz * 0.87)) * 0.72 + 0.2;
    const shade = Math.max(0, Math.min(255, Math.round(lit * 255)));

    const area = Math.abs((bx - ax) * (cy2 - ay) - (cx2 - ax) * (by - ay)) / 2;
    const n = Math.max(1, Math.min(900, Math.ceil(area * 3)));

    for (let s = 0; s < n; s++) {
      // 삼각형 안의 아무 점 (바리센트릭)
      const r1 = Math.sqrt(Math.random());
      const r2 = Math.random();
      const w0 = 1 - r1, w1 = r1 * (1 - r2), w2 = r1 * r2;
      const px = ax * w0 + bx * w1 + cx2 * w2;
      const py = ay * w0 + by * w1 + cy2 * w2;
      const pz = az * w0 + bz * w1 + cz * w2;

      const xi = px | 0;
      const yi = (size - py) | 0;
      if (xi < 0 || yi < 0 || xi >= size || yi >= size) continue;

      const at = yi * size + xi;
      if (pz >= depth[at]) {
        depth[at] = pz;
        gray[at] = shade;
      }
    }
  }
  return gray;
}

/**
 * 여섯 방향을 한 줄로 이어 붙인 PNG.
 * ★ 크기를 서로 맞춥니다 — 방향마다 제멋대로 커지면 비교가 안 됩니다.
 */
export async function stlPreviewBlob(buffer: ArrayBuffer): Promise<Blob | null> {
  const tris = parseStl(buffer);
  if (tris.length < 9) return null;

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (tris[i + k] < min[k]) min[k] = tris[i + k];
      if (tris[i + k] > max[k]) max[k] = tris[i + k];
    }
  }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;

  const big = CELL * SUPER;
  const canvas = document.createElement('canvas');
  canvas.width = CELL * VIEWS.length;
  canvas.height = CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const one = document.createElement('canvas');
  one.width = big;
  one.height = big;
  const octx = one.getContext('2d');
  if (!octx) return null;

  for (let i = 0; i < VIEWS.length; i++) {
    const gray = drawView(tris, VIEWS[i][0], VIEWS[i][1], big, span);
    const img = octx.createImageData(big, big);
    for (let p = 0; p < gray.length; p++) {
      img.data[p * 4] = gray[p];
      img.data[p * 4 + 1] = gray[p];
      img.data[p * 4 + 2] = gray[p];
      img.data[p * 4 + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.drawImage(one, 0, 0, big, big, CELL * i, 0, CELL, CELL);
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.9));
}
