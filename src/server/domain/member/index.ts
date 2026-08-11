// =========================================================
// 놓을 위치: src/server/domain/member/index.ts
//
// 조직 안의 사람. (사용자 요청 2026-08-12)
//
// ★ 자리 이름이 섹터마다 다릅니다.
//   디자인센터에는 '디자이너', 기공소에는 '기공사' 가 있고 치과에는
//   둘 다 없습니다. 없는 자리를 고르게 두면 통계가 뜻 없는 칸으로
//   갈라집니다 — 치과에 디자이너가 한 명 있는 표는 아무 말도 안 합니다.
//
// ★ 마지막 대표는 못 내리고 못 끕니다.
//   대표가 없어지면 그 조직은 사람을 늘릴 수도, 권한을 고칠 수도
//   없습니다. 되돌릴 방법이 화면에 없는 상태를 만들면 안 됩니다.
// =========================================================

import type { Sector } from '../order-status';

export type MemberRole = 'owner' | 'admin' | 'designer' | 'technician' | 'staff';

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: '대표',
  admin: '관리자',
  designer: '디자이너',
  technician: '기공사',
  staff: '직원',
};

/** 그 자리가 무엇을 할 수 있는지 한 줄로 */
export const ROLE_HINT: Record<MemberRole, string> = {
  owner: '모든 것. 조직에 하나는 있어야 합니다',
  admin: '사람과 조직 정보를 고칩니다',
  designer: '주문과 디자인 작업',
  technician: '배정받은 제작 작업',
  staff: '주문과 조회',
};

/** 섹터마다 고를 수 있는 자리 */
export const ROLE_OPTIONS: Record<Sector, MemberRole[]> = {
  clinic: ['owner', 'admin', 'staff'],
  design_center: ['owner', 'admin', 'designer', 'staff'],
  lab: ['owner', 'admin', 'technician', 'staff'],
};

/** 사람을 늘리고 권한을 고칠 수 있는 자리 */
export function canManageMembers(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export type MemberVerdict = { ok: true } | { ok: false; reason: string };

/**
 * 이메일 모양만 봅니다.
 *
 * ★ 촘촘한 규칙을 쓰지 않습니다.
 *   실제로 쓰이는 주소 중에 규칙에 안 맞는 것이 늘 있고, 막으면
 *   그 사람은 영영 못 들어옵니다. 진짜 확인은 가입할 때 메일이 합니다.
 */
export function checkInvite(email: string, role: MemberRole, sector: Sector): MemberVerdict {
  const trimmed = email.trim();

  if (!trimmed) return { ok: false, reason: '이메일을 넣어 주세요' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, reason: '이메일 모양이 아닙니다' };
  }
  if (!ROLE_OPTIONS[sector].includes(role)) {
    return { ok: false, reason: '이 조직에 없는 자리입니다' };
  }

  return { ok: true };
}

// ---------- 마지막 대표 ----------

export interface MemberSeat {
  userId: string;
  role: MemberRole;
  isActive: boolean;
}

/** 지금 살아 있는 대표 수 */
export function activeOwners(members: MemberSeat[]): number {
  return members.filter((m) => m.isActive && m.role === 'owner').length;
}

/**
 * 이 사람의 자리를 바꿔도 되는가.
 *
 * ★ 대표가 하나뿐일 때 그 사람을 내리면 조직에 주인이 없어집니다.
 *   그러면 아무도 사람을 늘리지 못하고, 되돌릴 방법이 화면에 없습니다.
 */
export function canChangeRole(
  members: MemberSeat[],
  userId: string,
  next: MemberRole,
): MemberVerdict {
  const me = members.find((m) => m.userId === userId);
  if (!me) return { ok: false, reason: '이 조직 사람이 아닙니다' };

  if (me.role === 'owner' && next !== 'owner' && activeOwners(members) <= 1) {
    return { ok: false, reason: '대표가 한 명뿐입니다. 다른 사람을 먼저 대표로 올려 주세요' };
  }

  return { ok: true };
}

/** 이 사람을 꺼도 되는가 */
export function canDeactivate(members: MemberSeat[], userId: string): MemberVerdict {
  const me = members.find((m) => m.userId === userId);
  if (!me) return { ok: false, reason: '이 조직 사람이 아닙니다' };
  if (!me.isActive) return { ok: false, reason: '이미 꺼져 있습니다' };

  if (me.role === 'owner' && activeOwners(members) <= 1) {
    return { ok: false, reason: '대표가 한 명뿐입니다. 다른 사람을 먼저 대표로 올려 주세요' };
  }

  return { ok: true };
}

// ---------- 초대장 ----------

export type InviteState = 'pending' | 'accepted' | 'expired' | 'revoked';

export const INVITE_LABEL: Record<InviteState, string> = {
  pending: '기다리는 중',
  accepted: '들어옴',
  expired: '기한 지남',
  revoked: '물림',
};

export interface InviteTimes {
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
}

/**
 * 초대장이 지금 어떤 상태인가.
 *
 * ★ 차례가 중요합니다. 들어온 초대장은 기한이 지나도 '들어옴' 입니다 —
 *   이미 자리에 앉은 사람이 목록에서 '기한 지남' 으로 보이면
 *   그 사람을 지워야 하나 싶어집니다.
 */
export function inviteState(times: InviteTimes, now: string): InviteState {
  if (times.acceptedAt) return 'accepted';
  if (times.revokedAt) return 'revoked';

  return times.expiresAt <= now ? 'expired' : 'pending';
}
