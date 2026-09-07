// =========================================================
// 놓을 위치: tests/domain/price-sheet.test.ts
// 기준: 사용자 요청 2026-09-07 — 수가표 보내기 (기본값·조정·메일 글)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRICE_SHEET,
  checkPriceSheet,
  parsePriceSheet,
  groupRows,
  formatWon,
} from '@/server/domain/price-sheet';
import { priceSheetHtml, priceSheetSubject } from '@/server/mail/price-sheet-mail';

describe('기본값 — 사용자가 준 표 (2026-09-07)', () => {
  it('여섯 줄, Crown Zirconia 45,000 · Custom Abutment 45,000', () => {
    expect(DEFAULT_PRICE_SHEET).toHaveLength(6);
    expect(DEFAULT_PRICE_SHEET.find((r) => r.group === 'Crown' && r.item === 'Zirconia')?.price).toBe(45_000);
    expect(DEFAULT_PRICE_SHEET.find((r) => r.item === 'Custom Abutment')?.price).toBe(45_000);
    expect(DEFAULT_PRICE_SHEET.find((r) => r.item === 'Custom Abutment + Zirconia')?.price).toBe(90_000);
  });
  it('기본값은 검사를 통과합니다', () => {
    expect(checkPriceSheet(DEFAULT_PRICE_SHEET).ok).toBe(true);
  });
});

describe('검사', () => {
  it('★ 0원·소수·빈 이름은 막습니다', () => {
    expect(checkPriceSheet([{ group: 'Crown', item: 'PMMA', price: 0 }]).ok).toBe(false);
    expect(checkPriceSheet([{ group: 'Crown', item: 'PMMA', price: 10.5 }]).ok).toBe(false);
    expect(checkPriceSheet([{ group: 'Crown', item: ' ', price: 10 }]).ok).toBe(false);
    expect(checkPriceSheet([]).ok).toBe(false);
  });
  it('DB 값이 어긋나면 null — 기본값으로 돌아갑니다', () => {
    expect(parsePriceSheet(null)).toBeNull();
    expect(parsePriceSheet([{ group: 'Crown', item: 'PMMA' }])).toBeNull();
    expect(parsePriceSheet(DEFAULT_PRICE_SHEET)).toEqual(DEFAULT_PRICE_SHEET);
  });
});

describe('묶음·표기', () => {
  it('Crown · Inlay · Implant 순, 빈 묶음은 뺍니다', () => {
    const g = groupRows([{ group: 'Implant', item: 'A', price: 1 }, { group: 'Crown', item: 'B', price: 2 }]);
    expect(g.map((x) => x.group)).toEqual(['Crown', 'Implant']);
  });
  it('45000 → 45,000', () => {
    expect(formatWon(45000)).toBe('45,000');
  });
});

describe('메일 글', () => {
  const input = {
    clinicName: '미사치과',
    rows: DEFAULT_PRICE_SHEET,
    senderName: '덴플로우 치과기공소',
    senderTel: '010-3365-3145',
    senderEmail: 'hep789@naver.com',
    year: '2026',
  };

  it('제목에 보내는 곳과 치과', () => {
    expect(priceSheetSubject(input)).toBe('[덴플로우 치과기공소] 미사치과 수가표');
  });

  it('본문에 여섯 줄·가격·보증·연락처가 다 있습니다', () => {
    const html = priceSheetHtml(input);
    for (const r of DEFAULT_PRICE_SHEET) expect(html).toContain(r.item);
    expect(html).toContain('45,000');
    expect(html).toContain('리메이크 1년 무상 보증');
    expect(html).toContain('010-3365-3145');
    expect(html).toContain('미사치과');
    expect(html).toContain('denflow.kr');
  });

  it('★ 치과 이름의 태그는 글자로 바뀝니다', () => {
    expect(priceSheetHtml({ ...input, clinicName: '<b>x</b>' })).not.toContain('<b>x</b>');
  });
});
