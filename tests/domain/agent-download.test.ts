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

import { manifestFor, parseManifest, AGENT_BETA_DEVICE_IDS } from '@/server/domain/agent';

describe('스스로 업데이트 안내 파일 (2026-10-24)', () => {
  const sha = 'a'.repeat(64);
  it('시험 PC 는 베타, 나머지는 안정판', () => {
    expect(manifestFor(AGENT_BETA_DEVICE_IDS[0])).toBe('beta.json');
    expect(manifestFor('00000000-0000-0000-0000-000000000000')).toBe('stable.json');
  });
  it('모양이 맞을 때만 믿습니다', () => {
    expect(parseManifest({ version: '1.3.18', sha256: sha, file: '1.3.18.zip' })).toEqual({ version: '1.3.18', sha256: sha, file: '1.3.18.zip' });
    expect(parseManifest({ version: '1.3.18', sha256: 'xyz', file: '1.3.18.zip' })).toBeNull();
    expect(parseManifest({ version: '1.3.18', sha256: sha, file: '../secret.zip' })).toBeNull();
    expect(parseManifest({ version: '1.3.18', sha256: sha, file: 'latest.zip' })).toBeNull();
    expect(parseManifest(null)).toBeNull();
  });
});
