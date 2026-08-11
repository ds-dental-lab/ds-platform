// =========================================================
// 놓을 위치: tests/lib/file-name.test.ts
// 기준: 파일 이름은 가운데를 접습니다 (사용자 요청 2026-08-12)
// =========================================================

import { describe, it, expect } from 'vitest';
import { middleEllipsis } from '@/lib/format/order';

describe('파일 이름 줄이기', () => {
  it('짧으면 그대로 둔다', () => {
    expect(middleEllipsis('상악스캔.stl')).toBe('상악스캔.stl');
  });

  it('길면 가운데를 접는다', () => {
    const out = middleEllipsis('김지영2026-08-11_15-47-06_최종본_수정.dxd', 24);

    expect(out).toContain('…');
    expect(out.length).toBe(24);
    expect(out.startsWith('김지영2026')).toBe(true);
  });

  // ★ 이것이 핵심입니다. 끝을 자르면 두 파일이 똑같아 보입니다
  it('★ 시각이 뒤에 붙은 두 파일이 서로 달라 보인다', () => {
    const a = middleEllipsis('김지영2026-08-11_15-47-06.dxd', 20);
    const b = middleEllipsis('김지영2026-08-11_15-26-14.dxd', 20);

    expect(a).not.toBe(b);
  });

  it('확장자가 남는다', () => {
    expect(middleEllipsis('환자사진-매우긴이름을가진파일입니다-2026-08-12.png', 20).endsWith('.png')).toBe(true);
  });

  it('딱 맞는 길이는 안 건드린다', () => {
    const name = 'a'.repeat(28);
    expect(middleEllipsis(name)).toBe(name);
    expect(middleEllipsis('a'.repeat(29))).toContain('…');
  });
});
