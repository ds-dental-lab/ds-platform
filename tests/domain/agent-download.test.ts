// 에이전트 내려받기 번호 (2026-10-19) — 번호가 맞을 때만, 모양이 이상하면 전부 거절
import { describe, it, expect } from 'vitest';
import { pinMatches, AGENT_ZIP_PATH } from '@/server/domain/agent';

describe('내려받기 번호', () => {
  it('같은 여섯 자리만 통과', () => {
    expect(pinMatches('482915', '482915')).toBe(true);
    expect(pinMatches(' 482915 ', '482915')).toBe(true); // 앞뒤 빈칸은 봐줍니다
    expect(pinMatches('482916', '482915')).toBe(false);
    expect(pinMatches('48291', '482915')).toBe(false);
    expect(pinMatches('4829155', '482915')).toBe(false);
  });

  it('★ 번호가 설정돼 있지 않으면 아무것도 통과 못 합니다 — 열린 채로 배포되지 않게', () => {
    expect(pinMatches('000000', undefined)).toBe(false);
    expect(pinMatches('', '')).toBe(false);
    expect(pinMatches('abcdef', 'abcdef')).toBe(false); // 숫자 여섯 자리가 아니면 비밀로도 못 씁니다
  });

  it('글자가 아닌 것은 거절', () => {
    expect(pinMatches(123456, '123456')).toBe(false);
    expect(pinMatches(null, '123456')).toBe(false);
  });

  it('zip 자리는 그대로', () => {
    expect(AGENT_ZIP_PATH).toBe('agent-release/latest.zip');
  });
});
