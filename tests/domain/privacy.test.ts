// =========================================================
// 놓을 위치: tests/domain/privacy.test.ts
// 기준: 사용자 결정 2026-08-12 — "개인정보 보호책임자는 나로 하고
//       처리방침 화면 만들어줘"
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  isDraft,
  missingFields,
  keepRows,
  PURPOSES,
  NOT_COLLECTED,
  SAFEGUARDS,
  LEGAL_KEEP,
  type PolicyFacts,
} from '@/server/domain/privacy';

const full: PolicyFacts = {
  orgName: 'DS 덴탈랩',
  bizNo: '123-45-67890',
  address: '서울시 어딘가',
  tel: '02-000-0000',
  officerName: '홍길동',
  officerDept: 'DDC팀',
  officerTel: '02-000-0001',
  officerEmail: 'privacy@dsflow.kr',
  effectiveOn: '2026-09-01',
  keepDays: { soft_deleted: 30, audit_log: 730, order_file: 420 },
  labs: [{ name: 'DS 기공소' }],
};

const empty: PolicyFacts = {
  orgName: null, bizNo: null, address: null, tel: null,
  officerName: null, officerDept: null, officerTel: null, officerEmail: null,
  effectiveOn: null, keepDays: null, labs: null,
};

describe('초안인가', () => {
  // ★ 날짜를 넣는 행위가 곧 "검토를 마쳤다" 는 뜻입니다
  it('★ 시행일이 없으면 초안입니다', () => {
    expect(isDraft(empty)).toBe(true);
    expect(isDraft({ ...full, effectiveOn: null })).toBe(true);
  });

  it('시행일이 있으면 초안이 아닙니다', () => {
    expect(isDraft(full)).toBe(false);
  });
});

describe('빠진 곳', () => {
  it('다 채우면 없습니다', () => {
    expect(missingFields(full)).toEqual([]);
  });

  it('빈 값이면 전부 짚어 줍니다', () => {
    const missing = missingFields(empty);

    expect(missing).toContain('개인정보 보호책임자');
    expect(missing).toContain('사업자등록번호');
    expect(missing).toContain('보관기간');
    expect(missing).toContain('시행일');
  });

  // ★ 전화든 이메일이든 하나만 있으면 연락은 됩니다
  it('★ 연락처는 둘 중 하나만 있어도 됩니다', () => {
    expect(missingFields({ ...full, officerTel: null })).toEqual([]);
    expect(missingFields({ ...full, officerEmail: null })).toEqual([]);
    expect(missingFields({ ...full, officerTel: null, officerEmail: null })).toContain(
      '책임자 연락처',
    );
  });

  it('공백만 있는 것은 빈 것으로 봅니다', () => {
    expect(missingFields({ ...full, officerName: '   ' })).toContain('개인정보 보호책임자');
  });
});

describe('보관기간 표', () => {
  // ★ 숫자를 문서에 박지 않고 설정에서 그대로 받습니다
  it('★ 설정한 값이 그대로 문서에 뜹니다', () => {
    const rows = keepRows(full);

    expect(rows.map((r) => r.period)).toEqual(['30일', '2년', '14개월']);
  });

  it('설정을 바꾸면 문서도 바뀝니다', () => {
    const rows = keepRows({ ...full, keepDays: { audit_log: 365 } });

    expect(rows).toHaveLength(1);
    expect(rows[0].period).toBe('1년');
  });

  // ★ 안 정한 것은 안 지운다는 뜻입니다. 표에 적으면 '영구 보관' 을 공표하는 셈입니다
  it('★ 안 정한 항목은 표에서 빠집니다', () => {
    expect(keepRows(empty)).toEqual([]);
    expect(keepRows({ ...full, keepDays: { soft_deleted: 30 } })).toHaveLength(1);
  });

  it('어느 날부터 세는지도 함께 적습니다', () => {
    const files = keepRows(full).find((r) => r.what.includes('스캔'));

    expect(files?.from).toContain('완료');
  });
});

describe('실제로 하는 것만 적혀 있는가', () => {
  // ★ 유사 업체 문구를 옮기면 안 받는 것까지 받는다고 공표하게 됩니다
  it('★ 처리 목적에 AI 학습이 없습니다', () => {
    const text = JSON.stringify(PURPOSES);

    expect(text).not.toContain('AI');
    expect(text).not.toContain('인공지능');
    expect(text).not.toContain('학습');
  });

  it('★ 계좌·카드·면허번호를 받는다고 적지 않았습니다', () => {
    const text = JSON.stringify(PURPOSES);

    expect(text).not.toContain('계좌');
    expect(text).not.toContain('신용카드');
    expect(text).not.toContain('면허');
  });

  it('안 받는 것을 따로 밝힙니다', () => {
    expect(NOT_COLLECTED.join(' ')).toContain('고유식별정보');
    expect(NOT_COLLECTED.join(' ')).toContain('결제정보');
  });

  // ★ 안 하는 것을 적으면 사고 났을 때 지키지 않은 약속이 됩니다
  it('★ 안전조치에 안 하는 것(정기 감사·출입통제)이 없습니다', () => {
    const text = JSON.stringify(SAFEGUARDS);

    expect(text).not.toContain('감사');
    expect(text).not.toContain('출입');
    expect(text).not.toContain('잠금장치');
  });

  it('실제로 하는 것은 들어 있습니다', () => {
    const text = JSON.stringify(SAFEGUARDS);

    expect(text).toContain('Row Level Security');
    expect(text).toContain('접속기록');
  });
});

describe('법정 보존기간', () => {
  // ★ 우리 보관기간보다 법이 우선입니다
  it('★ 치과기공물제작의뢰서 2년이 들어 있습니다', () => {
    const found = LEGAL_KEEP.find((r) => r.what.includes('치과기공물'));

    expect(found?.period).toBe('2년');
    expect(found?.law).toContain('의료기사');
  });
});
