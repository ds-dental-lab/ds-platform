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
  MAX_ORDER_TOTAL_BYTES,
  RESUMABLE_MIN_BYTES,
  TUS_CHUNK_BYTES,
  needsResumable,
  checkUploadBatch,
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
  // ★ 한 덩어리 150MB 가 실제로 옵니다 (2026-08-20 확인). 그 세 배로 잡았습니다
  it('★ 500MB 까지입니다 — 150MB 한 덩어리가 들어와야 합니다', () => {
    expect(MAX_UPLOAD_BYTES).toBe(500 * MB);
    expect(tooBig(150 * MB)).toBe(false);
    expect(tooBig(MAX_UPLOAD_BYTES)).toBe(false);
    expect(tooBig(MAX_UPLOAD_BYTES + 1)).toBe(true);
  });

  it('사람이 읽을 크기로', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(5 * MB)).toBe('5.0MB');
  });
});

// =========================================================
// 주문당 총량 · 이어올리기 기준 (작업지시서 2026-08-20)
// =========================================================

const file = (name: string, mb: number) => ({ name, size: mb * MB });

describe('묶음 검사', () => {
  it('보통 주문은 통과합니다', () => {
    // 실제 한 건이 이만큼 옵니다 (2026-08-20 확인)
    expect(checkUploadBatch([file('a.stl', 150)])).toBeNull();
    expect(checkUploadBatch([file('a.stl', 50), file('b.stl', 50), file('c.stl', 50)])).toBeNull();
    expect(checkUploadBatch(Array.from({ length: 10 }, (_, i) => file(`f${i}.stl`, 10)))).toBeNull();
  });

  it('빈 묶음도 통과합니다', () => {
    expect(checkUploadBatch([])).toBeNull();
  });

  it('한 개가 상한을 넘으면 그 이름을 댑니다', () => {
    const msg = checkUploadBatch([file('작은거.stl', 10), file('너무큰거.stl', 600)]);

    expect(msg).toContain('너무큰거.stl');
    expect(msg).not.toContain('작은거.stl');
  });

  // ★ "이 중에 큰 게 있습니다" 로는 어느 것을 빼야 할지 모릅니다
  it('★ 여럿이 넘으면 큰 것부터 댑니다', () => {
    const msg = checkUploadBatch([file('중간.stl', 550), file('제일큰.stl', 900)])!;

    expect(msg.indexOf('제일큰.stl')).toBeLessThan(msg.indexOf('중간.stl'));
  });

  // ★★ 파일 하나만 재면 못 막는 사고 — 폴더째 끌어다 놓기
  it('★ 하나하나는 통과해도 합쳐서 넘으면 막습니다', () => {
    const folder = Array.from({ length: 30 }, (_, i) => file(`case${i}.stl`, 40));

    expect(folder.every((f) => !tooBig(f.size))).toBe(true);
    expect(checkUploadBatch(folder)).toContain('폴더째');
  });

  it('총량은 1GB 까지', () => {
    expect(MAX_ORDER_TOTAL_BYTES).toBe(1024 * MB);
    expect(checkUploadBatch([file('a.stl', 500), file('b.stl', 500)])).toBeNull();
    expect(
      checkUploadBatch([file('a.stl', 500), file('b.stl', 500), file('c.stl', 100)]),
    ).not.toBeNull();
  });
});

describe('이어올리기로 보낼 것', () => {
  it('6MB 를 넘으면 이어올리기', () => {
    expect(RESUMABLE_MIN_BYTES).toBe(6 * MB);
    expect(needsResumable(6 * MB)).toBe(false);
    expect(needsResumable(6 * MB + 1)).toBe(true);
    expect(needsResumable(150 * MB)).toBe(true);
  });

  // ★ 작은 파일까지 이어올리기로 보내면 오히려 느립니다
  it('★ 10MB 열 개짜리 중 작은 것은 그냥 보냅니다', () => {
    expect(needsResumable(1 * MB)).toBe(false);
    expect(needsResumable(5 * MB)).toBe(false);
  });

  /*
    ★ 조각은 **6MB 의 배수**여야 합니다. 6MB 는 S3 조각의 하한이고,
      배수로 키우는 것은 됩니다 — 150MB 를 실제로 올려 재 봤습니다
      (6MB 15.4초 / 24MB 10.2초, 2026-08-21).

    ★ 값을 못 박지 않고 **규칙**을 못 박습니다. 다음에 또 손댈 값이라,
      숫자를 적어 두면 시험이 "바꾸지 말라" 는 말밖에 못 합니다.
  */
  it('★ 조각은 6MB 의 배수여야 합니다', () => {
    expect(TUS_CHUNK_BYTES % (6 * MB)).toBe(0);
    expect(TUS_CHUNK_BYTES).toBeGreaterThanOrEqual(6 * MB);
  });

  /*
    ★ 조각이 이어올리기 문턱보다 작으면 안 됩니다.
      그러면 '이어올리기로 보낼 만큼 큰 파일' 이 조각 하나에도
      안 들어가는 뒤집힌 모양이 됩니다.
  */
  it('★ 조각은 이어올리기 문턱보다 작지 않습니다', () => {
    expect(TUS_CHUNK_BYTES).toBeGreaterThanOrEqual(RESUMABLE_MIN_BYTES);
  });
});
