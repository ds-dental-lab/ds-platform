// =========================================================
// 놓을 위치: tests/domain/member.test.ts
// 기준: 사용자 결정 2026-08-12 — 자리는 관리자·사용자 둘.
//       차이는 금액이 보이느냐 하나.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  ROLE_OPTIONS,
  ROLE_LABEL,
  canManageMembers,
  canSeeMoney,
  checkNewMember,
  activeOwners,
  canChangeRole,
  canDeactivate,
  makeTempPassword,
  normalizeRole,
  type MemberSeat,
} from '@/server/domain/member';

const seat = (over: Partial<MemberSeat>): MemberSeat => ({
  userId: 'u',
  role: 'staff',
  isActive: true,
  ...over,
});

describe('자리', () => {
  // ★ 쓰이지 않는 구분은 고를 때마다 망설이게만 합니다
  it('★ 고를 수 있는 자리는 둘뿐입니다 — 세 섹터 모두 같습니다', () => {
    expect(ROLE_OPTIONS).toEqual(['owner', 'staff']);
    expect(ROLE_LABEL.owner).toBe('관리자');
    expect(ROLE_LABEL.staff).toBe('사용자');
  });

  // 지난 계정이 옛 값을 들고 있을 수 있습니다
  it('옛 자리도 둘 중 하나로 읽습니다', () => {
    expect(normalizeRole('admin')).toBe('owner');
    expect(normalizeRole('designer')).toBe('staff');
    expect(normalizeRole('technician')).toBe('staff');
    expect(ROLE_LABEL.designer).toBe('사용자');
  });

  // ★ 이 한 줄이 사용자와 관리자를 가릅니다
  it('★ 차이는 금액이 보이느냐 하나입니다', () => {
    expect(canSeeMoney('owner')).toBe(true);
    expect(canSeeMoney('admin')).toBe(true);
    expect(canSeeMoney('staff')).toBe(false);
    expect(canSeeMoney('designer')).toBe(false);
    expect(canSeeMoney(null)).toBe(false);
  });

  it('사람을 늘리는 것도 관리자만입니다', () => {
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('staff')).toBe(false);
    expect(canManageMembers(null)).toBe(false);
  });
});

describe('새 사용자 검사', () => {
  it('이름과 이메일이 있으면 통과', () => {
    expect(checkNewMember('김디자', 'kim@example.com', 'staff')).toEqual({ ok: true });
  });

  it('이름을 꼭 받습니다', () => {
    expect(checkNewMember('  ', 'kim@example.com', 'staff').ok).toBe(false);
  });

  it('이메일 모양을 봅니다', () => {
    expect(checkNewMember('김디자', 'kim', 'staff').ok).toBe(false);
    expect(checkNewMember('김디자', '', 'staff').ok).toBe(false);
  });

  it('없는 자리는 막습니다', () => {
    expect(checkNewMember('김디자', 'kim@example.com', 'designer').ok).toBe(false);
  });
});

describe('마지막 관리자', () => {
  const one = [seat({ userId: 'a', role: 'owner' }), seat({ userId: 'b', role: 'staff' })];
  const two = [seat({ userId: 'a', role: 'owner' }), seat({ userId: 'b', role: 'owner' })];

  it('살아 있는 관리자만 셉니다', () => {
    expect(activeOwners(two)).toBe(2);
    expect(activeOwners([seat({ role: 'owner', isActive: false })])).toBe(0);
  });

  it('옛 admin 도 관리자로 셉니다', () => {
    expect(activeOwners([seat({ role: 'admin' })])).toBe(1);
  });

  // ★ 관리자가 없어지면 아무도 사람을 못 늘립니다. 되돌릴 길이 화면에 없습니다
  it('★ 하나뿐인 관리자는 못 내립니다', () => {
    expect(canChangeRole(one, 'a', 'staff').ok).toBe(false);
    expect(canDeactivate(one, 'a').ok).toBe(false);
  });

  it('관리자가 둘이면 하나는 내릴 수 있습니다', () => {
    expect(canChangeRole(two, 'a', 'staff')).toEqual({ ok: true });
    expect(canDeactivate(two, 'a')).toEqual({ ok: true });
  });

  it('관리자를 관리자로 두는 것은 언제나 됩니다', () => {
    expect(canChangeRole(one, 'a', 'owner')).toEqual({ ok: true });
  });

  it('사용자는 자유롭습니다', () => {
    expect(canChangeRole(one, 'b', 'owner')).toEqual({ ok: true });
    expect(canDeactivate(one, 'b')).toEqual({ ok: true });
  });

  it('이미 꺼진 사람은 또 못 끕니다', () => {
    expect(canDeactivate([seat({ userId: 'a', isActive: false })], 'a').ok).toBe(false);
  });

  it('없는 사람은 못 건드립니다', () => {
    expect(canChangeRole(one, 'zzz', 'owner').ok).toBe(false);
  });
});

describe('임시 비밀번호', () => {
  it('규칙을 넘길 만큼 깁니다', () => {
    expect(makeTempPassword().length).toBeGreaterThanOrEqual(8);
  });

  // ★ 전화로 불러 주는 값입니다. 한 글자가 안 읽히면 되돌아옵니다
  it('★ 헷갈리는 글자를 안 씁니다 (0 O 1 l I)', () => {
    for (let i = 0; i < 200; i++) {
      expect(makeTempPassword().slice(0, -2)).not.toMatch(/[0O1lI]/);
    }
  });

  it('매번 다릅니다', () => {
    const made = new Set(Array.from({ length: 50 }, () => makeTempPassword()));
    expect(made.size).toBe(50);
  });
});
