// =========================================================
// 놓을 위치: tests/domain/member.test.ts
// 기준: 사용자 요청 2026-08-12 — 직원 계정
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  ROLE_OPTIONS,
  ROLE_LABEL,
  canManageMembers,
  checkInvite,
  activeOwners,
  canChangeRole,
  canDeactivate,
  inviteState,
  type MemberSeat,
} from '@/server/domain/member';

const seat = (over: Partial<MemberSeat>): MemberSeat => ({
  userId: 'u',
  role: 'staff',
  isActive: true,
  ...over,
});

describe('자리', () => {
  it('다섯 자리 모두 이름이 있습니다', () => {
    for (const role of ['owner', 'admin', 'designer', 'technician', 'staff'] as const) {
      expect(ROLE_LABEL[role]).toBeTruthy();
    }
  });

  // ★ 치과에 디자이너가 한 명 있는 표는 아무 말도 안 합니다
  it('★ 섹터에 없는 자리는 못 고릅니다', () => {
    expect(ROLE_OPTIONS.clinic).not.toContain('designer');
    expect(ROLE_OPTIONS.clinic).not.toContain('technician');
    expect(ROLE_OPTIONS.design_center).toContain('designer');
    expect(ROLE_OPTIONS.lab).toContain('technician');
  });

  it('대표와 관리자만 사람을 늘립니다', () => {
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('designer')).toBe(false);
    expect(canManageMembers('staff')).toBe(false);
    expect(canManageMembers(null)).toBe(false);
  });
});

describe('초대장 검사', () => {
  it('이메일 모양을 봅니다', () => {
    expect(checkInvite('kim@example.com', 'staff', 'clinic')).toEqual({ ok: true });
    expect(checkInvite('kim', 'staff', 'clinic').ok).toBe(false);
    expect(checkInvite('  ', 'staff', 'clinic').ok).toBe(false);
  });

  it('그 조직에 없는 자리는 막습니다', () => {
    expect(checkInvite('kim@example.com', 'designer', 'clinic').ok).toBe(false);
    expect(checkInvite('kim@example.com', 'designer', 'design_center').ok).toBe(true);
  });
});

describe('마지막 대표', () => {
  const one = [seat({ userId: 'a', role: 'owner' }), seat({ userId: 'b', role: 'staff' })];
  const two = [seat({ userId: 'a', role: 'owner' }), seat({ userId: 'b', role: 'owner' })];

  it('살아 있는 대표만 셉니다', () => {
    expect(activeOwners(two)).toBe(2);
    expect(activeOwners([seat({ role: 'owner', isActive: false })])).toBe(0);
  });

  // ★ 대표가 없어지면 아무도 사람을 못 늘립니다. 되돌릴 길이 화면에 없습니다
  it('★ 하나뿐인 대표는 못 내립니다', () => {
    expect(canChangeRole(one, 'a', 'staff').ok).toBe(false);
    expect(canDeactivate(one, 'a').ok).toBe(false);
  });

  it('대표가 둘이면 하나는 내릴 수 있습니다', () => {
    expect(canChangeRole(two, 'a', 'staff')).toEqual({ ok: true });
    expect(canDeactivate(two, 'a')).toEqual({ ok: true });
  });

  it('대표를 대표로 두는 것은 언제나 됩니다', () => {
    expect(canChangeRole(one, 'a', 'owner')).toEqual({ ok: true });
  });

  it('대표가 아닌 사람은 자유롭습니다', () => {
    expect(canChangeRole(one, 'b', 'admin')).toEqual({ ok: true });
    expect(canDeactivate(one, 'b')).toEqual({ ok: true });
  });

  it('이미 꺼진 사람은 또 못 끕니다', () => {
    expect(canDeactivate([seat({ userId: 'a', isActive: false })], 'a').ok).toBe(false);
  });

  it('없는 사람은 못 건드립니다', () => {
    expect(canChangeRole(one, 'zzz', 'admin').ok).toBe(false);
  });
});

describe('초대장 상태', () => {
  const NOW = '2026-08-12T00:00:00Z';

  it('기한 안이면 기다리는 중', () => {
    expect(
      inviteState({ acceptedAt: null, revokedAt: null, expiresAt: '2026-08-26T00:00:00Z' }, NOW),
    ).toBe('pending');
  });

  it('기한이 지나면 기한 지남', () => {
    expect(
      inviteState({ acceptedAt: null, revokedAt: null, expiresAt: '2026-08-01T00:00:00Z' }, NOW),
    ).toBe('expired');
  });

  it('물린 것은 물림', () => {
    expect(
      inviteState(
        { acceptedAt: null, revokedAt: '2026-08-05T00:00:00Z', expiresAt: '2026-08-26T00:00:00Z' },
        NOW,
      ),
    ).toBe('revoked');
  });

  // ★ 이미 앉은 사람이 '기한 지남' 으로 보이면 지워야 하나 싶어집니다
  it('★ 들어온 초대장은 기한이 지나도 들어옴입니다', () => {
    expect(
      inviteState(
        { acceptedAt: '2026-07-20T00:00:00Z', revokedAt: null, expiresAt: '2026-08-01T00:00:00Z' },
        NOW,
      ),
    ).toBe('accepted');
  });
});
