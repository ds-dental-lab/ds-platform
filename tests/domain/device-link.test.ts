// =========================================================
// 놓을 위치: tests/domain/device-link.test.ts
//
// 어느 자리가 PC 를 묶을 수 있는가 (2026-10-14).
//
// ★ 전에는 치과만이었습니다. 디자인센터 PC 가 exocad 를 여는 일을
//   맡으면서 그쪽도 기기가 돼야 했습니다 — 브라우저를 고리에서 빼려고요.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  canLinkDevice,
  DEVICE_SECTORS,
  DEVICE_LABEL,
  makeLinkCode,
  isLinkCode,
} from '@/server/domain/device-link';

describe('PC 를 묶을 수 있는 자리', () => {
  it('치과와 디자인센터는 묶습니다', () => {
    expect(canLinkDevice('clinic')).toBe(true);
    expect(canLinkDevice('design_center')).toBe(true);
  });

  // ★ 기공소는 올릴 스캔도 열 exocad 도 없습니다
  it('기공소는 안 묶습니다', () => {
    expect(canLinkDevice('lab')).toBe(false);
  });

  // ★★ 모를 때 열어 주는 쪽으로 기울지 않습니다
  it('모르면 안 묶습니다', () => {
    expect(canLinkDevice(null)).toBe(false);
    expect(canLinkDevice(undefined)).toBe(false);
  });

  it('자리마다 PC 가 하는 일이 다릅니다', () => {
    expect(DEVICE_SECTORS).toHaveLength(2);
    expect(DEVICE_LABEL.clinic.what).toContain('스캔');
    expect(DEVICE_LABEL.design_center.what).toContain('exocad');
  });
});

describe('연결 코드', () => {
  it('여섯 자리이고 0·1 을 안 씁니다 — O·I 와 섞입니다', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = makeLinkCode();
      expect(code).toHaveLength(6);
      expect(isLinkCode(code)).toBe(true);
      expect(code).not.toMatch(/[01]/);
    }
  });
});
