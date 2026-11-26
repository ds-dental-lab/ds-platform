import { describe, expect, it } from 'vitest';
import { troubleSummary, type AutoTrouble } from '@/server/domain/auto-print';

const t = (kind: AutoTrouble['kind'], reason: string, when: string): AutoTrouble => ({ kind, at: 'printing', reason, when });

describe('troubleSummary — 지난 멈춤 한 줄', () => {
  it('멈춘 적이 없으면 아무것도 안 보인다', () => {
    expect(troubleSummary([])).toBeNull();
  });

  it('멈춤과 일시 정지를 따로 센다', () => {
    const line = troubleSummary([
      t('paused', '필라멘트가 끊겼을 수 있습니다', '2026-11-25T11:57:00Z'),
      t('failed', '프린터가 출력을 멈췄습니다', '2026-11-25T11:57:47Z'),
    ]);
    expect(line).toBe('지난 멈춤 1번 · 일시 정지 1번 — 마지막: 프린터가 출력을 멈췄습니다');
  });

  it('마지막은 시각으로 고른다 — 들어온 순서가 아니다', () => {
    const line = troubleSummary([
      t('failed', '나중 것', '2026-11-25T12:00:00Z'),
      t('failed', '먼저 것', '2026-11-25T11:00:00Z'),
    ]);
    expect(line).toBe('지난 멈춤 2번 — 마지막: 나중 것');
  });

  it('까닭이 비어 있어도 줄은 나온다', () => {
    expect(troubleSummary([t('failed', '  ', '2026-11-25T11:00:00Z')])).toBe('지난 멈춤 1번 — 마지막: 까닭 없음');
  });
});
