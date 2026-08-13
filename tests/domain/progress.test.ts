// =========================================================
// 놓을 위치: tests/domain/progress.test.ts
//
// 주문이 어디까지 왔는가. (사용자 요청 2026-08-13 —
//   "치과입장에서도 과정을 알아야하잖아?")
// =========================================================

import { describe, it, expect } from 'vitest';
import { orderProgress, pickupPhase } from '@/server/domain/progress';

/** 읽기 쉽게 '지금' 칸의 이름만 뽑습니다 */
function now(steps: ReturnType<typeof orderProgress>): string | undefined {
  return steps.find((s) => s.state === 'current')?.label;
}

function labels(steps: ReturnType<typeof orderProgress>): string[] {
  return steps.map((s) => s.label);
}

const OPEN = [{ status: 'open' }];
const MOVING = [{ status: 'assigned' }];
const GOT = [{ status: 'done' }];

describe('수거가 있는 리페어 — 사용자가 그린 그대로', () => {
  const base = { isRepair: true as const };

  it('칸이 수거대기·수거중·수거완료·작업중·배송중·완료 다', () => {
    const steps = orderProgress({ ...base, status: 'production_wait', pickups: OPEN });

    expect(labels(steps)).toEqual([
      '수거대기',
      '수거중',
      '수거완료',
      '작업중',
      '배송중',
      '완료',
    ]);
  });

  it('★ 리페어에는 접수·디자인 칸이 없다 — 지나지 않는 단계입니다', () => {
    const steps = orderProgress({ ...base, status: 'production_wait', pickups: OPEN });

    expect(labels(steps)).not.toContain('디자인');
  });

  it('아직 안 가져갔으면 수거대기', () => {
    expect(now(orderProgress({ ...base, status: 'production_wait', pickups: OPEN }))).toBe(
      '수거대기',
    );
  });

  it('택배사에 접수했으면 수거중', () => {
    expect(now(orderProgress({ ...base, status: 'production_wait', pickups: MOVING }))).toBe(
      '수거중',
    );
  });

  it('받았는데 아직 시작 전이면 수거완료', () => {
    expect(now(orderProgress({ ...base, status: 'production_wait', pickups: GOT }))).toBe(
      '수거완료',
    );
  });

  it('제작이 시작되면 작업중', () => {
    expect(now(orderProgress({ ...base, status: 'production', pickups: GOT }))).toBe('작업중');
  });

  it('출고하면 배송중, 끝나면 완료', () => {
    expect(now(orderProgress({ ...base, status: 'shipping', pickups: GOT }))).toBe('배송중');
    expect(now(orderProgress({ ...base, status: 'completed', pickups: GOT }))).toBe('완료');
  });

  it('완료면 앞 칸이 전부 끝난 것으로 보인다', () => {
    const steps = orderProgress({ ...base, status: 'completed', pickups: GOT });

    expect(steps.filter((s) => s.state === 'todo')).toHaveLength(0);
  });

  it('★ 지금 칸은 언제나 하나뿐이다', () => {
    for (const status of ['production_wait', 'production', 'shipping', 'completed'] as const) {
      for (const pickups of [OPEN, MOVING, GOT]) {
        const steps = orderProgress({ ...base, status, pickups });
        expect(steps.filter((s) => s.state === 'current')).toHaveLength(1);
      }
    }
  });
});

describe('보통 주문 — 수거가 없으면 제작대기 한 칸', () => {
  const base = { isRepair: false as const, pickups: [] };

  it('접수·디자인·제작대기·작업중·배송중·완료', () => {
    expect(labels(orderProgress({ ...base, status: 'received' }))).toEqual([
      '접수',
      '디자인',
      '제작대기',
      '작업중',
      '배송중',
      '완료',
    ]);
  });

  it('접수 상태면 접수 칸이 지금이다', () => {
    expect(now(orderProgress({ ...base, status: 'received' }))).toBe('접수');
  });

  it('★ 재스캔은 뒤로 간 것이 아니라 접수에 머무는 것이다', () => {
    expect(now(orderProgress({ ...base, status: 'rescan' }))).toBe('접수');
  });

  it('디자인 중이면 디자인', () => {
    expect(now(orderProgress({ ...base, status: 'designing' }))).toBe('디자인');
  });
});

describe('아날로그 — 접수·디자인에 수거가 함께 붙는다', () => {
  it('두 갈래가 다 나온다', () => {
    const steps = orderProgress({ status: 'received', isRepair: false, pickups: OPEN });

    expect(labels(steps)).toEqual([
      '접수',
      '디자인',
      '수거대기',
      '수거중',
      '수거완료',
      '작업중',
      '배송중',
      '완료',
    ]);
  });
});

describe('취소는 과정이 없다', () => {
  it('한 칸만 남는다', () => {
    const steps = orderProgress({ status: 'cancelled', isRepair: false, pickups: [] });

    expect(labels(steps)).toEqual(['취소']);
  });
});

describe('수거가 여러 건이면 제일 덜 온 것을 따른다', () => {
  it('★ 하나라도 안 왔으면 안 온 것이다', () => {
    expect(pickupPhase([{ status: 'done' }, { status: 'open' }])).toBe('open');
    expect(pickupPhase([{ status: 'done' }, { status: 'assigned' }])).toBe('assigned');
  });

  it('다 왔으면 왔다', () => {
    expect(pickupPhase([{ status: 'done' }, { status: 'done' }])).toBe('done');
  });

  it('취소된 수거는 안 센다', () => {
    expect(pickupPhase([{ status: 'done' }, { status: 'cancelled' }])).toBe('done');
    expect(pickupPhase([{ status: 'cancelled' }])).toBeNull();
  });

  it('수거가 없으면 없다', () => {
    expect(pickupPhase([])).toBeNull();
  });
});
