// =========================================================
// 놓을 위치: tests/domain/center-mobile.test.ts
// 기준: 사용자 요청 2026-09-06 — 센터 관리자 폰 화면 (문의·승인·주문 찾기)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  centerCards,
  matchesOrder,
  teethLine,
  itemLine,
  SEARCH_DAYS,
} from '@/server/domain/center-mobile';
import { FALLBACK_TYPES } from '@/server/domain/prosthesis';

describe('홈 카드', () => {
  it('관리자는 셋 — 문의·승인·주문 찾기 순', () => {
    const cards = centerCards({ contacts: 2, signups: 1 }, true);
    expect(cards.map((c) => c.key)).toEqual(['contacts', 'signups', 'orders']);
    expect(cards[0].count).toBe(2);
    expect(cards[1].count).toBe(1);
    expect(cards[2].count).toBeNull();
  });

  /*
    ★ 디자이너에게는 주문 찾기 하나뿐입니다. 승인·문의는 자기 일이
      아니고, 보이면 눌러 봐야 404 입니다.
  */
  it('★ 디자이너는 주문 찾기 하나', () => {
    const cards = centerCards({ contacts: 5, signups: 5 }, false);
    expect(cards.map((c) => c.key)).toEqual(['orders']);
  });

  it('기다리는 게 있으면 말이 달라집니다', () => {
    expect(centerCards({ contacts: 1, signups: 0 }, true)[0].hint).toContain('전화');
    expect(centerCards({ contacts: 0, signups: 0 }, true)[0].hint).toContain('없습니다');
  });
});

describe('주문 찾기', () => {
  const row = { order_no: 'ORD-260906-003', clinic_name: '미사치과', patient_label: '김민서' };

  it('치과·환자·주문번호 어디든 걸립니다', () => {
    expect(matchesOrder(row, '미사')).toBe(true);
    expect(matchesOrder(row, '민서')).toBe(true);
    expect(matchesOrder(row, '003')).toBe(true);
    expect(matchesOrder(row, '강남')).toBe(false);
  });

  // ★ 전화 받으면서 한 손으로 치는 자리 — 초성이 되어야 합니다
  it('★ 초성으로도', () => {
    expect(matchesOrder(row, 'ㅁㅅ')).toBe(true);
    expect(matchesOrder(row, 'ㄱㅁㅅ')).toBe(true);
  });

  it('기간은 석 달', () => {
    expect(SEARCH_DAYS).toBe(90);
  });
});

describe('치식·항목 줄', () => {
  // ★ 치식도 순서(18→11, 21→28)라 12 가 11 앞에 섭니다 — 목록 규칙 그대로입니다
  it('치식은 목록 규칙 그대로, 폰틱은 X', () => {
    expect(teethLine([{ tooth: 11, isPontic: false }, { tooth: 12, isPontic: true }])).toBe('X, 11');
    expect(teethLine([])).toBe('치식 없음');
  });

  /*
    ★ 전화로 "어떤 종류예요" 에 답하는 줄입니다. 코드가 아니라 약어로 —
      'CR/ZIR' 은 아무도 못 읽습니다.
  */
  it('★ 항목은 약어로', () => {
    const type = FALLBACK_TYPES[0];
    const material = type.materials[0];
    const line = itemLine(FALLBACK_TYPES, {
      tooth_number: 26,
      type_code: type.code,
      material_code: material.code,
      is_pontic: false,
    });
    expect(line.startsWith('#26 · ')).toBe(true);
    expect(line).not.toContain(`${type.code}/${material.code}`);
  });

  it('카탈로그에 없으면 코드 그대로 — 화면이 죽지 않게', () => {
    const line = itemLine(FALLBACK_TYPES, {
      tooth_number: 1,
      type_code: 'ZZ',
      material_code: 'QQ',
      is_pontic: true,
    });
    expect(line).toBe('#1 · ZZ/QQ (폰틱)');
  });
});
