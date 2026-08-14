// =========================================================
// 놓을 위치: tests/domain/upload.test.ts
//
// 올리는 파일의 규칙. (사용자 요청 2026-08-14 — 저장소 아끼기)
//
// ★ 여기서 제일 무서운 것은 **스캔 파일을 건드리는 것**입니다.
//   사진을 줄이려다 `.stl` 을 줄이면 치수가 바뀝니다. 그 한 줄을
//   지키려고 이 시험이 있습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  MAX_UPLOAD_BYTES,
  MIN_COMPRESS_BYTES,
  MAX_IMAGE_EDGE,
  shouldCompress,
  webpName,
  fitEdge,
  worthReplacing,
  tooBig,
  formatBytes,
} from '@/server/domain/upload';

const MB = 1024 * 1024;

describe('무엇을 줄일까', () => {
  it('★ 스캔·설계 파일은 절대 안 건드립니다 — 그건 치수입니다', () => {
    for (const name of [
      'scan.stl',
      'a.obj',
      'b.ply',
      '김지영2026-08-11.dxd',
      'c.constructioninfo',
      'ORD-260811-013_디자인1.html', // exocad webview
      'd.zip',
    ]) {
      expect(shouldCompress(name, 50 * MB)).toBe(false);
    }
  });

  it('사진은 줄입니다', () => {
    expect(shouldCompress('shade.png', 2 * MB)).toBe(true);
    expect(shouldCompress('a.JPG', 2 * MB)).toBe(true);
    expect(shouldCompress('b.jpeg', 2 * MB)).toBe(true);
  });

  it('★ 작은 사진은 그냥 둡니다 — 줄여 봐야 얼마 안 되고 손만 갑니다', () => {
    expect(shouldCompress('tiny.png', MIN_COMPRESS_BYTES - 1)).toBe(false);
    expect(shouldCompress('ok.png', MIN_COMPRESS_BYTES)).toBe(true);
  });

  it('확장자가 없으면 안 건드립니다', () => {
    expect(shouldCompress('noext', 5 * MB)).toBe(false);
  });
});

describe('이름 바꾸기', () => {
  it('확장자만 갈아 끼웁니다', () => {
    expect(webpName('shade.png')).toBe('shade.webp');
    expect(webpName('환자 사진.JPG')).toBe('환자 사진.webp');
  });

  it('★ 이름 안의 점에 안 속습니다', () => {
    expect(webpName('2026-08-11.앞니.png')).toBe('2026-08-11.앞니.webp');
  });
});

describe('크기 맞추기', () => {
  it('긴 변을 기준에 맞춥니다', () => {
    expect(fitEdge(4000, 3000)).toEqual({ width: MAX_IMAGE_EDGE, height: 1200 });
    expect(fitEdge(3000, 4000)).toEqual({ width: 1200, height: MAX_IMAGE_EDGE });
  });

  it('★ 작은 것을 키우지 않습니다 — 용량만 늘고 화질은 그대로입니다', () => {
    expect(fitEdge(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('0 이 들어와도 안 터집니다', () => {
    expect(fitEdge(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe('줄인 것을 쓸까', () => {
  it('★ 줄였는데 더 커지면 원본을 씁니다 — 아끼려다 늘리면 안 됩니다', () => {
    expect(worthReplacing(1000, 1200)).toBe(false);
    expect(worthReplacing(1000, 1000)).toBe(false);
  });

  it('★ 조금 줄어든 정도로는 안 바꿉니다 — 이름이 바뀌는 값을 치릅니다', () => {
    expect(worthReplacing(1000, 950)).toBe(false); // 5%
    expect(worthReplacing(1000, 890)).toBe(true); // 11%
  });

  it('빈 결과는 안 씁니다', () => {
    expect(worthReplacing(1000, 0)).toBe(false);
  });
});

describe('상한', () => {
  it('100MB 까지입니다', () => {
    expect(MAX_UPLOAD_BYTES).toBe(100 * MB);
    expect(tooBig(MAX_UPLOAD_BYTES)).toBe(false);
    expect(tooBig(MAX_UPLOAD_BYTES + 1)).toBe(true);
  });

  it('사람이 읽을 크기로', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(5 * MB)).toBe('5.0MB');
  });
});
