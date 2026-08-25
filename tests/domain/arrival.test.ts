// =========================================================
// 놓을 위치: tests/domain/arrival.test.ts
//
// 오늘 받을 것. (사용자 요청 2026-08-24, 좁힘 2026-08-24)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  arrivalStateOf,
  arrivalRank,
  pendingSummary,
  isPending,
  ARRIVAL_LABEL,
  type ArrivalState,
} from '@/server/domain/arrival';
import { STATUS_ORDER } from '@/server/domain/order-status';

describe('진료실 말로 옮기기', () => {
  it('완료는 도착, 배송은 오는 중', () => {
    expect(arrivalStateOf('completed')).toBe('arrived');
    expect(arrivalStateOf('shipping')).toBe('onTheWay');
  });

  /*
    ★★ 진료실은 우리 공정을 몰라도 됩니다. '접수·디자인·제작대기' 를
      그대로 보여 주면, 그것이 오늘 올 수 있다는 뜻인지 아닌지를
      진료실이 판단해야 합니다 — 우리가 할 일을 넘기는 것입니다.
  */
  it('★ 그 앞은 전부 만드는 중입니다', () => {
    for (const s of ['received', 'rescan', 'designing', 'production_wait', 'production'] as const) {
      expect(arrivalStateOf(s)).toBe('making');
    }
  });

  // ★ 취소는 뺍니다. 오늘 안 오는 것이 맞습니다
  it('★ 취소는 목록에서 뺍니다', () => {
    expect(arrivalStateOf('cancelled')).toBeNull();
  });

  it('모든 상태에 답이 있습니다', () => {
    for (const s of STATUS_ORDER) {
      const state = arrivalStateOf(s);
      expect(state === null || state in ARRIVAL_LABEL).toBe(true);
    }
  });
});

/*
  ★★ 도착한 것은 이미 손에 있어서 화면을 볼 이유가 없습니다.
    오늘 오기로 했는데 아직 만들고 있는 것이 제일 위여야 합니다 —
    그것이 전화를 걸어야 하는 건입니다.
*/
describe('목록 자리', () => {
  it('★ 안 온 것이 위, 도착이 아래', () => {
    const order: ArrivalState[] = ['arrived', 'making', 'onTheWay'];
    expect([...order].sort((a, b) => arrivalRank(a) - arrivalRank(b))).toEqual([
      'making',
      'onTheWay',
      'arrived',
    ]);
  });
});

/*
  ★★ **받은 것은 안 세웁니다** (2026-08-24 좁힘). 「수령 완료」는 치과가
    자기 손으로 누르는 것이라, 되돌려 보여 줘도 새 정보가 아닙니다.
    사장님 지적 — "배송추적은 달 수가 없어서 의미가 있나 싶다".
    맞습니다. 이 화면은 추적이 아니고, 답하는 질문은 하나입니다 —
    *오늘 것 중에 아직 안 온 게 있나.*
*/
describe('세울 것 고르기', () => {
  it('★ 받은 것은 안 세웁니다', () => {
    expect(isPending('arrived')).toBe(false);
    expect(isPending('making')).toBe(true);
    expect(isPending('onTheWay')).toBe(true);
  });
});

describe('머리말 한 줄', () => {
  /*
    ★★ **남은 것만** 셉니다. 전에는 '3건 중 2건이 아직' 이었는데,
      앞의 3은 답이 아니라 계산거리였습니다 — 알고 싶은 것은
      '아직 안 온 게 있나' 이고 그 답은 2입니다.
  */
  it('★ 남은 것만 셉니다', () => {
    expect(pendingSummary(['arrived', 'making', 'onTheWay'])).toBe('2건이 아직입니다');
  });

  /*
    ★ 다 받은 날은 다 받았다고 말합니다. 빈 화면과 같은 말이면
      오늘 것이 아예 없었던 것인지 다 받은 것인지 구분이 안 됩니다.
  */
  it('★ 다 받은 날과 없는 날은 다릅니다', () => {
    expect(pendingSummary(['arrived', 'arrived'])).toBe('2건 모두 받았습니다');
    expect(pendingSummary([])).toBe('오늘 받기로 한 것이 없습니다');
  });
});
