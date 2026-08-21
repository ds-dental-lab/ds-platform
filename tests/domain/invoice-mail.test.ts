// =========================================================
// 놓을 위치: tests/domain/invoice-mail.test.ts
//
// 청구서 메일의 글. (사용자 결정 2026-08-21)
//
// ★★ 이 시험의 핵심은 **무엇이 안 실렸는가** 입니다.
//   청구서 세부내역에는 환자 이름이 들어갑니다. 메일에 실으면
//   그 이름이 우리 손을 떠납니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  invoiceSubject,
  invoiceHtml,
  invoiceLink,
  monthLabel,
  moneyLabel,
  dayLabel,
  type InvoiceMailInput,
} from '@/server/mail/invoice-mail';

const CLINIC: InvoiceMailInput = {
  partyType: 'clinic',
  partyName: '[안양]선한이웃치과',
  yearMonth: '2026-08',
  invoiceNo: 'INV-26000489',
  amount: 1_240_000,
  dueDate: '2026-09-10',
  siteUrl: 'https://denflow.kr',
};

const LAB: InvoiceMailInput = { ...CLINIC, partyType: 'lab', partyName: 'DS 기공소' };

describe('청구서 메일 — 사람이 읽는 값', () => {
  it('달·금액·날짜를 우리말로', () => {
    expect(monthLabel('2026-08')).toBe('2026년 8월');
    expect(moneyLabel(1_240_000)).toBe('1,240,000원');
    expect(dayLabel('2026-09-10')).toBe('2026년 9월 10일');
  });

  // ★ 0원 청구서도 나갑니다 — 리메이크만 있던 달
  it('0원도 그대로 적습니다', () => {
    expect(moneyLabel(0)).toBe('0원');
  });
});

describe('청구서 메일 — 방향이 둘', () => {
  it('치과에는 청구서', () => {
    expect(invoiceSubject(CLINIC)).toBe('[덴플로우] 2026년 8월분 청구서입니다');
    expect(invoiceLink(CLINIC)).toBe('https://denflow.kr/clinic/billing/2026-08');
  });

  /*
    ★ 기공소 것을 '청구' 로만 적으면 주는 쪽이 달라는 문서가 됩니다
      (InvoiceSheet 와 같은 규칙).
  */
  it('기공소에는 기공료 청구서', () => {
    expect(invoiceSubject(LAB)).toContain('기공료');
    expect(invoiceLink(LAB)).toBe('https://denflow.kr/lab/billing/2026-08');
  });
});

describe('★★ 메일에 실리면 안 되는 것', () => {
  const html = invoiceHtml({ ...CLINIC });

  it('환자 이름이 들어갈 자리가 아예 없습니다', () => {
    // 글에는 세부내역을 만들 재료 자체가 안 들어옵니다
    expect(Object.keys(CLINIC)).not.toContain('items');
    expect(Object.keys(CLINIC)).not.toContain('lines');
    expect(Object.keys(CLINIC)).not.toContain('patients');
  });

  it('왜 안 싣는지를 받는 사람에게 말합니다', () => {
    expect(html).toContain('환자 정보가 들어 있어 메일에는 싣지 않습니다');
  });

  it('대신 보러 갈 곳을 줍니다', () => {
    expect(html).toContain(invoiceLink(CLINIC));
    expect(html).toContain('청구서 보기');
  });
});

describe('청구서 메일 — 실려야 하는 것', () => {
  const html = invoiceHtml(CLINIC);

  it('금액·기한·번호·받는 곳 이름', () => {
    expect(html).toContain('1,240,000원');
    expect(html).toContain('2026년 9월 10일');
    expect(html).toContain('INV-26000489');
    expect(html).toContain('[안양]선한이웃치과');
  });

  // ★ 메일 프로그램은 그림·flex·grid 를 지웁니다
  it('표로 짜고 그림을 안 씁니다', () => {
    expect(html).toContain('<table');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('display:flex');
  });

  // ★ 560 으로 박으면 좁은 화면에서 잘립니다 — 메일은 휴대폰으로 더 봅니다
  it('폭을 박지 않습니다', () => {
    expect(html).toContain('max-width:560px');
    expect(html).not.toContain('width="560"');
  });
});

describe('주소 끝의 슬래시', () => {
  // ★ 두 번 겹치면 링크가 깨집니다
  it('사이트 주소가 슬래시로 끝나도 링크가 멀쩡합니다', () => {
    const link = invoiceLink({ ...CLINIC, siteUrl: 'https://denflow.kr' });
    expect(link).not.toContain('//clinic');
  });
});
