// =========================================================
// 놓을 위치: tests/domain/device.test.ts
//
// 폰인가 아닌가. (2026-08-23 — 사장님이 폰에서 데스크톱 화면을 만났습니다)
// =========================================================

import { describe, it, expect } from 'vitest';
import { isPhone } from '@/server/domain/device';

describe('폰인가', () => {
  it('아이폰·안드로이드 폰', () => {
    expect(isPhone('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/605')).toBe(true);
    expect(isPhone('Mozilla/5.0 (Linux; Android 14; SM-S928N) Chrome/126 Mobile Safari/537')).toBe(
      true,
    );
  });

  /*
    ★★ 태블릿은 폰이 아닙니다. 데스크는 아이패드로 의뢰서를 씁니다 —
      거기까지 진료실 화면으로 보내면 주문등록을 못 합니다.
  */
  it('★ 태블릿은 아닙니다', () => {
    expect(isPhone('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Safari/605')).toBe(false);
    // ★ 안드로이드 태블릿에는 Mobile 이 없습니다 — 그것이 유일한 표시입니다
    expect(isPhone('Mozilla/5.0 (Linux; Android 13; SM-X700) Chrome/126 Safari/537')).toBe(false);
  });

  it('데스크톱은 아닙니다', () => {
    expect(isPhone('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537')).toBe(false);
    expect(isPhone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605')).toBe(false);
  });

  // ★ 값이 없을 수도 있습니다. 그때는 데스크톱으로 봅니다 — 있는 화면이 그것입니다
  it('없으면 폰이 아닙니다', () => {
    expect(isPhone(null)).toBe(false);
    expect(isPhone('')).toBe(false);
  });
});
