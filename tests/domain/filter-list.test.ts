// =========================================================
// 주문목록 아이콘 필터 — 여러 개 고르기 (사용자 요청 2026-08-13)
//
// 주소는 사용자가 직접 고칠 수 있어서, 여기서 거르는 규칙이
// 곧 방어선입니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  parseFilterList,
  toggleFilter,
  filterListToParam,
  ISSUE_ORDER,
} from '@/server/domain/order-list';
import { STATUS_ORDER, type OrderStatus } from '@/server/domain/order-status';

const S = STATUS_ORDER as readonly OrderStatus[];

describe('parseFilterList', () => {
  it('값 하나짜리 옛 주소가 그대로 동작합니다', () => {
    // HOME 카드가 아직 `?status=received` 로 보냅니다
    expect(parseFilterList('received', S)).toEqual(['received']);
  });

  it('쉼표로 여러 개를 읽습니다', () => {
    expect(parseFilterList('production_wait,production', S)).toEqual([
      'production_wait',
      'production',
    ]);
  });

  it('빈 값은 빈 목록입니다 — 아무것도 안 거릅니다', () => {
    expect(parseFilterList('', S)).toEqual([]);
    expect(parseFilterList(',,', S)).toEqual([]);
  });

  it('모르는 값은 조용히 버립니다', () => {
    expect(parseFilterList('received,__해킹__,shipping', S)).toEqual(['received', 'shipping']);
    expect(parseFilterList('전부', S)).toEqual([]);
  });

  it('공백이 섞여도 읽습니다', () => {
    expect(parseFilterList(' received , shipping ', S)).toEqual(['received', 'shipping']);
  });

  it('중복은 한 번만 남습니다', () => {
    // 두 번 세면 배지 숫자와 목록 개수가 어긋납니다
    expect(parseFilterList('received,received', S)).toEqual(['received']);
  });

  it('차례는 누른 순서가 아니라 허용 목록의 차례입니다', () => {
    // 같은 조합이면 주소도 같아야 뒤로가기·즐겨찾기가 하나로 모입니다
    expect(parseFilterList('shipping,received', S)).toEqual(
      parseFilterList('received,shipping', S),
    );
  });

  it('이슈에도 같은 규칙이 붙습니다', () => {
    expect(parseFilterList('repair,rescan', ISSUE_ORDER)).toEqual(['rescan', 'repair']);
  });
});

describe('toggleFilter', () => {
  it('꺼져 있으면 켭니다', () => {
    expect(toggleFilter([], 'received', S)).toEqual(['received']);
  });

  it('켜져 있으면 끕니다', () => {
    expect(toggleFilter(['received'], 'received', S)).toEqual([]);
  });

  it('나머지는 그대로 둡니다 — 이게 "중복 필터" 의 핵심입니다', () => {
    expect(toggleFilter(['received'], 'shipping', S)).toEqual(['received', 'shipping']);
  });

  it('여럿 중 하나만 뺍니다', () => {
    expect(toggleFilter(['received', 'designing', 'shipping'], 'designing', S)).toEqual([
      'received',
      'shipping',
    ]);
  });

  it('넣은 차례와 상관없이 늘 같은 결과입니다', () => {
    const a = toggleFilter(toggleFilter([], 'shipping', S), 'received', S);
    const b = toggleFilter(toggleFilter([], 'received', S), 'shipping', S);
    expect(a).toEqual(b);
  });
});

describe('filterListToParam', () => {
  it('빈 목록은 빈 문자열 — 주소에서 파라미터를 아예 뺍니다', () => {
    expect(filterListToParam([])).toBe('');
  });

  it('읽고 쓴 것이 제자리로 돌아옵니다', () => {
    const list = parseFilterList('received,shipping', S);
    expect(parseFilterList(filterListToParam(list), S)).toEqual(list);
  });
});
