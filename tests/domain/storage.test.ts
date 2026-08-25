// =========================================================
// 놓을 위치: tests/domain/storage.test.ts
//
// 저장소가 얼마나 찼나. (사용자 요청 2026-08-25)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  storageLevel,
  storageNotice,
  percentFull,
  humanSize,
  PLAN_LIMIT_BYTES,
  WARN_AT,
  URGENT_AT,
} from '@/server/domain/storage';

const GB = 1024 ** 3;

describe('얼마나 찼나', () => {
  it('여유 있으면 조용합니다', () => {
    expect(storageLevel(10 * GB)).toBe('ok');
    expect(storageLevel(69 * GB)).toBe('ok');
  });

  it('70%부터 알립니다', () => {
    expect(storageLevel(PLAN_LIMIT_BYTES * WARN_AT)).toBe('warn');
    expect(storageLevel(80 * GB)).toBe('warn');
  });

  /*
    ★★ 90%부터는 말을 세게 합니다. Spend Cap 이 켜져 있으면 100% 에서
      요금이 붙는 게 아니라 **업로드가 실패합니다** — 그리고 왜 안
      되는지 화면에 안 나옵니다.
  */
  it('★ 90%부터는 세게', () => {
    expect(storageLevel(PLAN_LIMIT_BYTES * URGENT_AT)).toBe('urgent');
    expect(storageLevel(200 * GB)).toBe('urgent');
  });

  // ★ 요금제를 못 읽었거나 0 이면 조용합니다. 0으로 나누면 안 됩니다
  it('★ 상한이 0이면 조용합니다', () => {
    expect(storageLevel(10 * GB, 0)).toBe('ok');
    expect(percentFull(10 * GB, 0)).toBe(0);
  });

  it('100%를 넘어도 100으로 적습니다', () => {
    expect(percentFull(250 * GB)).toBe(100);
  });
});

describe('사람이 읽는 크기', () => {
  it('단위가 붙습니다', () => {
    expect(humanSize(1536 * 1024 * 1024)).toBe('1.5GB');
    expect(humanSize(5 * 1024 * 1024)).toBe('5MB');
    expect(humanSize(2048)).toBe('2KB');
  });

  // ★ 음수가 와도 화면이 안 깨집니다
  it('★ 음수는 0으로', () => {
    expect(humanSize(-100)).toBe('0KB');
  });
});

describe('띄울 한 줄', () => {
  /*
    ★★ **무엇이 멈추는지**를 적습니다. '저장소 78%' 만으로는 그게
      나쁜 일인지 모릅니다 — 숫자는 그 자체로 경고가 아닙니다.
  */
  it('★ 급하면 멈춘다고 말합니다', () => {
    expect(storageNotice(95 * GB)).toContain('업로드가 멈춥니다');
  });

  it('평소에는 숫자만', () => {
    const line = storageNotice(75 * GB);
    expect(line).toContain('75%');
    expect(line).toContain('100.0GB');
  });
});
