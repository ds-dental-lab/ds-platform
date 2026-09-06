// =========================================================
// 놓을 위치: tests/domain/approval-alert.test.ts
// 기준: 사용자 지적 2026-09-05 — "실제로 해보니까 알림이 오는 게 없어"
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  signupPush,
  contactPush,
  approvalSummary,
  hasApprovalWork,
  signupMail,
  contactMail,
} from '@/server/domain/approval-alert';

describe('가입 신청 알림', () => {
  it('누구인지와 어디로 갈지', () => {
    const p = signupPush({ orgName: '행복치과', orgType: 'clinic' });
    expect(p.title).toContain('가입 신청');
    expect(p.body).toBe('행복치과 · 치과');
    expect(p.link).toBe('/design/signups');
  });

  // ★ 같은 딱지 — 신청이 셋 오면 폰에 셋이 쌓이지 않고 갈아끼웁니다
  it('★ 딱지가 하나로 고정', () => {
    expect(signupPush({ orgName: 'A', orgType: 'lab' }).tag).toBe(
      signupPush({ orgName: 'B', orgType: 'clinic' }).tag,
    );
  });

  it('기공소도 갈라 말합니다', () => {
    expect(signupPush({ orgName: 'DS', orgType: 'lab' }).body).toContain('기공소');
  });
});

describe('문의 알림', () => {
  it('치과 이름과 문의 화면', () => {
    const p = contactPush({ clinicName: '미사치과' });
    expect(p.body).toBe('미사치과');
    expect(p.link).toBe('/design/contacts');
  });
});

/*
  ★ 둘을 **갈라서** 셉니다. '할 일 3건' 은 무엇을 해야 하는지 모릅니다 —
    승인과 전화는 다른 일이고 다른 화면입니다.
*/
describe('HOME 띠 한 줄', () => {
  it('★ 갈라서 셉니다', () => {
    expect(approvalSummary({ signups: 2, contacts: 1 })).toBe('가입 신청 2건 · 수가표 문의 1건');
  });

  it('없는 쪽은 안 적습니다', () => {
    expect(approvalSummary({ signups: 0, contacts: 3 })).toBe('수가표 문의 3건');
    expect(approvalSummary({ signups: 1, contacts: 0 })).toBe('가입 신청 1건');
  });

  it('둘 다 없으면 띠도 없습니다', () => {
    expect(hasApprovalWork({ signups: 0, contacts: 0 })).toBe(false);
    expect(approvalSummary({ signups: 0, contacts: 0 })).toBe('');
  });
});

describe('메일', () => {
  it('제목에 누구인지, 본문에 갈 곳', () => {
    const m = signupMail({ orgName: '행복치과', orgType: 'clinic' }, 'https://denflow.kr');
    expect(m.subject).toContain('행복치과');
    expect(m.html).toContain('https://denflow.kr/design/signups');
    expect(m.html).toContain('승인');
  });

  // ★ 치과 이름에 태그가 섞여 와도 메일이 깨지거나 스크립트가 되지 않습니다
  it('★ 이름의 꺾쇠는 글자로', () => {
    const m = contactMail({ clinicName: '<b>x</b>치과' }, 'https://denflow.kr');
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).toContain('&lt;b&gt;');
  });
});
