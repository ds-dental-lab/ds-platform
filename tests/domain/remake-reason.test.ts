// =========================================================
// 놓을 위치: tests/domain/remake-reason.test.ts
//
// 리메이크 사유. (사용자 요청 2026-08-14)
//
// ★ 여기서 지키려는 것은 **통계가 거짓말을 안 하는 것**입니다.
//   모르는 코드가 섞이거나, 한 건이 두 번 세지거나, 내용 없는 '기타' 가
//   쌓이면 표는 멀쩡해 보이는데 숫자가 틀립니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  REMAKE_REASON_GROUPS,
  OTHER_CODE,
  NOTE_MAX,
  findReason,
  groupOf,
  reasonLabel,
  normalizeSelection,
  tallyReasons,
} from '@/server/domain/remake-reason';

describe('사유 목록', () => {
  it('여섯 갈래입니다', () => {
    expect(REMAKE_REASON_GROUPS.map((g) => g.key)).toEqual(['CS', 'CP', 'CA', 'QD', 'LT', 'ET']);
  });

  it('★ 코드가 겹치지 않습니다 — 겹치면 통계가 한 칸으로 뭉갭니다', () => {
    const codes = REMAKE_REASON_GROUPS.flatMap((g) => g.reasons.map((r) => r.code));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('★ 코드 앞자리가 제 갈래와 같습니다 — 어긋나면 묶을 때 헷갈립니다', () => {
    for (const group of REMAKE_REASON_GROUPS) {
      for (const reason of group.reasons) {
        expect(reason.code.startsWith(group.key + '-')).toBe(true);
        expect(groupOf(reason.code)?.key).toBe(group.key);
      }
    }
  });

  it('빈 갈래가 없습니다', () => {
    REMAKE_REASON_GROUPS.forEach((g) => expect(g.reasons.length).toBeGreaterThan(0));
  });

  it('모르는 코드는 못 찾습니다', () => {
    expect(findReason('CS-01')).not.toBeNull();
    expect(findReason('ZZ-99')).toBeNull();
    // 목록에서 빠진 옛 코드라도 화면에는 뭔가 보여 줍니다
    expect(reasonLabel('ZZ-99')).toBe('ZZ-99');
  });
});

describe('고른 것을 다듬는다', () => {
  it('★ 모르는 코드는 버립니다 — 통계에 정체불명이 남으면 영영 못 지웁니다', () => {
    expect(normalizeSelection(['CS-01', 'ZZ-99', 'LT-02'], null).codes).toEqual(['CS-01', 'LT-02']);
  });

  it('같은 것을 두 번 골라도 하나입니다', () => {
    expect(normalizeSelection(['CP-03', 'CP-03'], null).codes).toEqual(['CP-03']);
  });

  it('★ 차례를 목록 순서로 맞춥니다 — 고른 순서대로 두면 같은 조합이 달리 저장됩니다', () => {
    const a = normalizeSelection(['LT-02', 'CS-01', 'QD-01'], null).codes;
    const b = normalizeSelection(['QD-01', 'LT-02', 'CS-01'], null).codes;

    expect(a).toEqual(b);
    expect(a).toEqual(['CS-01', 'QD-01', 'LT-02']);
  });

  it('★ 기타를 골랐는데 글이 비면 기타를 뺍니다 — 아무것도 안 알려 주는 줄입니다', () => {
    expect(normalizeSelection([OTHER_CODE], '').codes).toEqual([]);
    expect(normalizeSelection([OTHER_CODE], '   ').codes).toEqual([]);
    expect(normalizeSelection([OTHER_CODE], null).codes).toEqual([]);
  });

  it('기타에 글이 있으면 같이 담습니다', () => {
    const out = normalizeSelection(['CS-01', OTHER_CODE], '  장비 점검 중 파손  ');

    expect(out.codes).toEqual(['CS-01', OTHER_CODE]);
    expect(out.note).toBe('장비 점검 중 파손');
  });

  it('★ 기타를 안 골랐으면 글을 안 담습니다 — 안 보이는 곳에 글이 남습니다', () => {
    expect(normalizeSelection(['CS-01'], '적어만 둔 글').note).toBeNull();
  });

  it('아주 긴 글은 자릅니다', () => {
    const out = normalizeSelection([OTHER_CODE], 'ㄱ'.repeat(NOTE_MAX + 50));
    expect(out.note?.length).toBe(NOTE_MAX);
  });

  it('아무것도 안 고르면 빈 것으로 — 지우는 뜻입니다', () => {
    expect(normalizeSelection([], null)).toEqual({ codes: [], note: null });
  });
});

describe('세기', () => {
  const rows = [
    { orderId: 'o1', code: 'CS-01' },
    { orderId: 'o1', code: 'CP-05' },
    { orderId: 'o2', code: 'CS-01' },
    { orderId: 'o3', code: 'LT-02' },
  ];

  it('★ 주문 수와 사유 수가 다릅니다 — 한 건에 여럿을 고를 수 있습니다', () => {
    const t = tallyReasons(rows);

    expect(t.orders).toBe(3); // o1 o2 o3
    expect(t.picks).toBe(4); // 고른 것은 넷
  });

  it('★ 많은 차례로 세웁니다 — 코드 순이면 늘 CS 가 맨 위입니다', () => {
    const t = tallyReasons(rows);

    expect(t.reasons[0]).toMatchObject({ code: 'CS-01', count: 2 });
    expect(t.groups[0]).toMatchObject({ key: 'CS', count: 2 });
  });

  it('갈래 몫은 사유 수 기준입니다', () => {
    const t = tallyReasons(rows);
    const cs = t.groups.find((g) => g.key === 'CS');

    expect(cs?.share).toBe(50); // 4 중 2
    expect(t.groups.reduce((s, g) => s + g.count, 0)).toBe(t.picks);
  });

  it('0건인 갈래는 안 보입니다', () => {
    const t = tallyReasons([{ orderId: 'o1', code: 'CS-01' }]);
    expect(t.groups.map((g) => g.key)).toEqual(['CS']);
  });

  it('모르는 코드는 안 셉니다', () => {
    const t = tallyReasons([
      { orderId: 'o1', code: 'ZZ-99' },
      { orderId: 'o2', code: 'CS-01' },
    ]);

    expect(t.orders).toBe(1);
    expect(t.picks).toBe(1);
  });

  it('아무것도 없으면 몫이 null 입니다 — 0% 로 적으면 없는 것과 구별이 안 됩니다', () => {
    const t = tallyReasons([]);

    expect(t.orders).toBe(0);
    expect(t.picks).toBe(0);
    expect(t.groups).toEqual([]);
    expect(t.reasons).toEqual([]);
  });
});
