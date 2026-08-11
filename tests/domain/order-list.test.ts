// =========================================================
// 놓을 위치: tests/domain/order-list.test.ts
// 기준: 기능명세서 §4.3 주문목록
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  statusesForSector,
  computeDDay,
  formatToothList,
  sectorOfStatus,
  colorOfStatus,
  rangeStart,
  isSortable,
  SECTOR_COLOR,
  LIST_STATUSES,
} from '@/server/domain/order-list';

describe('D-Day', () => {
  it('남았으면 D-n', () => {
    expect(computeDDay('2026-08-15', '2026-08-10', 'received').label).toBe('D-5');
  });

  it('오늘이면 D-Day', () => {
    expect(computeDDay('2026-08-10', '2026-08-10', 'received').label).toBe('D-Day');
  });

  it('지났으면 D+n', () => {
    expect(computeDDay('2026-08-07', '2026-08-10', 'received').label).toBe('D+3');
  });

  it('★ 3일 이하로 남으면 급한 건이다', () => {
    expect(computeDDay('2026-08-13', '2026-08-10', 'received').urgent).toBe(true);
    expect(computeDDay('2026-08-14', '2026-08-10', 'received').urgent).toBe(false);
  });

  it('★ 이미 지난 건도 급한 건이다', () => {
    expect(computeDDay('2026-08-01', '2026-08-10', 'received').urgent).toBe(true);
  });

  it('★ 끝난 주문은 날짜를 세지 않는다', () => {
    // 완료된 건이 D+30 으로 빨갛게 뜨면 목록이 온통 경고가 됩니다
    const done = computeDDay('2026-07-01', '2026-08-10', 'completed');

    expect(done.label).toBe('완료');
    expect(done.urgent).toBe(false);
  });

  it('취소도 마찬가지다', () => {
    expect(computeDDay('2026-07-01', '2026-08-10', 'cancelled').urgent).toBe(false);
  });

  it('달을 넘어가도 맞다', () => {
    expect(computeDDay('2026-09-02', '2026-08-31', 'received').label).toBe('D-2');
  });
});

describe('치식 표기', () => {
  it('치식도 순서대로 늘어놓는다', () => {
    // 상악은 오른쪽 지치(18)부터 왼쪽 지치(28)까지
    const text = formatToothList([
      { tooth: 26, isPontic: false },
      { tooth: 16, isPontic: false },
      { tooth: 11, isPontic: false },
    ]);

    expect(text).toBe('16, 11, 26');
  });

  it('★ 폰틱은 번호 대신 X', () => {
    const text = formatToothList([
      { tooth: 15, isPontic: false },
      { tooth: 16, isPontic: true },
      { tooth: 17, isPontic: false },
    ]);

    expect(text).toBe('17, X, 15');
  });

  it('★ 한 치아에 둘이 등록돼도 번호는 한 번만 적는다', () => {
    const text = formatToothList([
      { tooth: 16, isPontic: false },
      { tooth: 16, isPontic: false },
    ]);

    expect(text).toBe('16');
  });

  it('★ 중복 중 하나만 폰틱이면 번호로 적는다', () => {
    // 폰틱이 아닌 보철이 하나라도 있으면 그 치아는 실재합니다
    const text = formatToothList([
      { tooth: 16, isPontic: true },
      { tooth: 16, isPontic: false },
    ]);

    expect(text).toBe('16');
  });

  it('비어 있으면 빈 문자열', () => {
    expect(formatToothList([])).toBe('');
  });
});

// ★ 상태마다 색을 주지 않습니다. 담당 섹터가 같으면 같은 색입니다.
//   목록을 훑을 때 "지금 누구 손에 있는가"가 먼저 보여야 합니다.
describe('상태 색은 섹터 기준', () => {
  it('재스캔과 접수는 둘 다 치과 색이다', () => {
    expect(colorOfStatus('rescan')).toBe(colorOfStatus('received'));
    expect(colorOfStatus('received')).toBe(SECTOR_COLOR.clinic.color);
  });

  it('제작대기 · 제작 · 배송은 모두 기공소 색이다', () => {
    const lab = SECTOR_COLOR.lab.color;

    expect(colorOfStatus('production_wait')).toBe(lab);
    expect(colorOfStatus('production')).toBe(lab);
    expect(colorOfStatus('shipping')).toBe(lab);
  });

  it('디자인은 디자인센터 색이다', () => {
    expect(sectorOfStatus('designing')).toBe('design');
  });

  it('완료는 회색이다', () => {
    expect(colorOfStatus('completed')).toBe(SECTOR_COLOR.done.color);
  });

  it('★ 목록 필터에 취소는 없다', () => {
    expect(LIST_STATUSES.map((s) => s.status)).not.toContain('cancelled');
    expect(LIST_STATUSES).toHaveLength(7);
  });
});

describe('기간 필터', () => {
  it('3개월 전', () => {
    expect(rangeStart('3개월', '2026-08-10')).toBe('2026-05-10');
  });

  it('1년 전', () => {
    expect(rangeStart('1년', '2026-08-10')).toBe('2025-08-10');
  });

  it('★ 전체는 시작이 없다', () => {
    expect(rangeStart('전체', '2026-08-10')).toBeNull();
  });

  it('해를 넘어간다', () => {
    expect(rangeStart('6개월', '2026-02-10')).toBe('2025-08-10');
  });
});

// ★ 명세서 §4.3 — 치식과 이슈는 정렬하지 않습니다.
//   여러 값이 한 칸에 들어 있어 무엇을 기준으로 세울지 정할 수 없습니다.
describe('정렬 가능 열', () => {
  it('일반 열은 정렬된다', () => {
    expect(isSortable('due_date')).toBe(true);
    expect(isSortable('remake_count')).toBe(true);
  });

  it('★ 치식과 이슈는 정렬하지 않는다', () => {
    expect(isSortable('teeth')).toBe(false);
    expect(isSortable('issue')).toBe(false);
  });

  it('없는 열 이름은 거른다', () => {
    expect(isSortable('drop table')).toBe(false);
  });
});

// =========================================================
// 섹터별 상태 목록
//
// ★ 기공소는 배정받은 파일을 실물로 만들어 치과로 보내는 일만 합니다.
//   접수·재스캔·디자인은 배정 전 단계라 목록에 뜨지도 않습니다 —
//   늘 0 인 아이콘을 세워 두면 자리만 차지합니다.
// =========================================================

describe('섹터별 상태 목록', () => {
  it('★ 기공소는 접수·재스캔·디자인을 세우지 않는다', () => {
    const shown = statusesForSector('lab').map((s) => s.status);

    expect(shown).not.toContain('received');
    expect(shown).not.toContain('rescan');
    expect(shown).not.toContain('designing');
  });

  it('★ 기공소는 제작대기·제작·배송·완료만 본다', () => {
    const shown = statusesForSector('lab').map((s) => s.status);

    expect(shown).toEqual(['production_wait', 'production', 'shipping', 'completed']);
  });

  it('치과와 디자인센터는 전 구간을 본다', () => {
    const all = LIST_STATUSES.map((s) => s.status);

    expect(statusesForSector('clinic').map((s) => s.status)).toEqual(all);
    expect(statusesForSector('design_center').map((s) => s.status)).toEqual(all);
  });
});
