// =========================================================
// 놓을 위치: tests/domain/fit-value.test.ts
// 기준: 사용자 요청 2026-08-17 — 치과별 내면값 (시안 스크린샷 둘)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  FIT_NUMBER_FIELDS,
  EMPTY_FIT_VALUES,
  isRegistered,
  readFit,
  checkFitValues,
  formatFit,
  diffFitValues,
  isRecentChange,
  FIT_LIMIT,
  NOTE_MAX,
  type FitValues,
} from '@/server/domain/fit-value';

function values(patch: Partial<FitValues> = {}): FitValues {
  return { ...EMPTY_FIT_VALUES, ...patch };
}

describe('필드 목록', () => {
  // 시안 순서 그대로 — 표·창·카드가 이 순서로 그립니다
  it('시안의 일곱 수치가 순서대로 있습니다', () => {
    expect(FIT_NUMBER_FIELDS.map((f) => f.label)).toEqual([
      '자연치',
      'CNC',
      'Inlay',
      'PLA',
      'PMMA',
      '맞결',
      '단일',
    ]);
  });

  it('재료와 컨택으로 묶입니다', () => {
    expect(FIT_NUMBER_FIELDS.filter((f) => f.group === 'material')).toHaveLength(5);
    expect(FIT_NUMBER_FIELDS.filter((f) => f.group === 'contact')).toHaveLength(2);
  });
});

describe('등록 여부', () => {
  it('줄이 없으면 미등록', () => {
    expect(isRegistered(null)).toBe(false);
  });

  // ★ 줄 유무로 가르면 '한 번 열어 본 치과' 가 전부 등록으로 보입니다
  it('★ 줄이 있어도 값이 다 비면 미등록', () => {
    expect(isRegistered(values())).toBe(false);
  });

  it('수치 하나만 있어도 등록', () => {
    expect(isRegistered(values({ naturalTooth: 0.04 }))).toBe(true);
  });

  it('Hook 만 켜도 등록', () => {
    expect(isRegistered(values({ hook: true }))).toBe(true);
  });

  it('공백뿐인 비고는 등록이 아닙니다', () => {
    expect(isRegistered(values({ note: '   ' }))).toBe(false);
  });
});

describe('입력 읽기', () => {
  it('빈 칸은 null — 안 정한 것입니다', () => {
    expect(readFit('')).toBeNull();
    expect(readFit('  ')).toBeNull();
  });

  it('수는 수로', () => {
    expect(readFit('0.04')).toBe(0.04);
    expect(readFit('-0.05')).toBe(-0.05);
  });

  // ★ 잘못 친 글자를 0 으로 눙치면 아무도 모르게 0 이 저장됩니다
  it('★ 잘못 친 글자는 NaN 으로 남아 검사에 걸립니다', () => {
    const v = values({ cnc: readFit('0.0.4') });

    expect(checkFitValues(v)).toContain('CNC');
  });
});

describe('저장 검사', () => {
  it('빈 값은 통과합니다 — 넣는 것은 선택입니다', () => {
    expect(checkFitValues(values())).toBeNull();
  });

  it('보통 값은 통과합니다', () => {
    expect(checkFitValues(values({ naturalTooth: 0.04, contactAdj: -0.05 }))).toBeNull();
  });

  it('한계를 넘으면 어느 칸인지 이름을 붙입니다', () => {
    const msg = checkFitValues(values({ pla: FIT_LIMIT + 1 }));

    expect(msg).toContain('PLA');
  });

  it('소수 셋째 자리까지는 되고 넷째는 안 됩니다', () => {
    expect(checkFitValues(values({ inlay: 0.015 }))).toBeNull();
    expect(checkFitValues(values({ inlay: 0.0155 }))).toContain('Inlay');
  });

  it('비고가 너무 길면 막습니다', () => {
    expect(checkFitValues(values({ note: 'a'.repeat(NOTE_MAX + 1) }))).toContain('비고');
  });
});

describe('수치 찍기', () => {
  it('시안처럼 두 자리입니다', () => {
    expect(formatFit(0.04)).toBe('0.04');
    expect(formatFit(-0.05)).toBe('-0.05');
    expect(formatFit(0.1)).toBe('0.10');
  });

  it('셋째 자리는 있을 때만 보입니다', () => {
    expect(formatFit(0.015)).toBe('0.015');
  });

  it('없으면 -', () => {
    expect(formatFit(null)).toBe('-');
  });
});

describe('무엇이 바뀌었나', () => {
  it('안 바뀌면 빈 목록 — 이력을 안 남깁니다', () => {
    const v = values({ cnc: 0.01 });

    expect(diffFitValues(v, { ...v })).toEqual([]);
  });

  // ★ 알림의 단위는 숫자가 아니라 '자연치 0.02 → 0.04' 라는 문장입니다
  it('★ 수치 변경은 전후를 문장 재료로 남깁니다', () => {
    const before = values({ naturalTooth: 0.02 });
    const after = values({ naturalTooth: 0.04 });

    expect(diffFitValues(before, after)).toEqual([
      { label: '자연치', from: '0.02', to: '0.04' },
    ]);
  });

  it('처음 넣는 값은 - 에서 옵니다', () => {
    expect(diffFitValues(null, values({ cnc: 0.01 }))).toEqual([
      { label: 'CNC', from: '-', to: '0.01' },
    ]);
  });

  it('Hook 은 있음·미사용으로 말합니다', () => {
    expect(diffFitValues(values(), values({ hook: true }))).toEqual([
      { label: 'Hook', from: '미사용', to: '있음' },
    ]);
  });

  it('긴 비고는 잘라서 남깁니다', () => {
    const [change] = diffFitValues(null, values({ note: 'a'.repeat(100) }));

    expect(change.label).toBe('비고');
    expect(change.to.length).toBeLessThanOrEqual(25);
    expect(change.to.endsWith('…')).toBe(true);
  });

  it('여러 개가 바뀌면 다 남습니다', () => {
    const before = values({ naturalTooth: 0.02, contactAdj: -0.05 });
    const after = values({ naturalTooth: 0.04, contactAdj: -0.07, hook: true });

    expect(diffFitValues(before, after)).toHaveLength(3);
  });
});

describe('최근 변경 판정', () => {
  it('이력이 없으면 최근이 아닙니다', () => {
    expect(isRecentChange(null, '2026-08-17')).toBe(false);
  });

  it('오늘 바뀐 것은 최근입니다', () => {
    expect(isRecentChange('2026-08-17T09:00:00.000Z', '2026-08-17')).toBe(true);
  });

  it('6일 전까지는 최근, 7일이 지나면 아닙니다', () => {
    expect(isRecentChange('2026-08-11', '2026-08-17')).toBe(true);
    expect(isRecentChange('2026-08-10', '2026-08-17')).toBe(false);
  });
});
