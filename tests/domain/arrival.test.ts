// =========================================================
// 놓을 위치: tests/domain/arrival.test.ts
//
// 오늘 도착할 보철물. (사용자 요청 2026-08-24)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  arrivalStateOf,
  arrivalRank,
  arrivalSummary,
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

describe('머리말 한 줄', () => {
  /*
    ★ 숫자만 세지 않습니다. '3건' 만으로는 그중 둘이 아직 안 왔다는
      것을 모릅니다 — 세어 보려면 목록을 끝까지 읽어야 합니다.
  */
  it('★ 남은 것을 짚어 줍니다', () => {
    expect(arrivalSummary(['arrived', 'making', 'onTheWay'])).toBe('3건 중 2건이 아직입니다');
  });

  it('다 왔으면 다 왔다고', () => {
    expect(arrivalSummary(['arrived', 'arrived'])).toBe('2건 모두 도착했습니다');
  });

  // ★ 없는 날이 대부분입니다. 빈 화면에도 말을 겁니다
  it('없으면 없다고', () => {
    expect(arrivalSummary([])).toBe('오늘 도착 예정이 없습니다');
  });
});
