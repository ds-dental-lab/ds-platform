// =========================================================
// 놓을 위치: src/server/domain/member/index.ts
//
// 조직 안의 사람. (사용자 결정 2026-08-12 — 자리를 둘로 줄였습니다)
//
// ★ 세 섹터 모두 **관리자 · 사용자** 둘뿐입니다.
//   전에는 디자이너·기공사·직원까지 다섯이었는데, 자리를 늘려 봐야
//   화면이 갈리는 곳은 한 군데뿐이었습니다 — **금액**.
//   쓰이지 않는 구분은 고를 때마다 망설이게만 하고, 나중에 "이 사람은
//   디자이너인가 직원인가" 를 아무도 답하지 못합니다.
//
// ★ 사용자와 관리자의 차이는 **금액이 보이느냐** 하나입니다.
//   *"금액나오는 곳만 안보이면 된다"*.
//   주문을 넣고 받고 파일을 올리는 일은 둘 다 똑같이 합니다.
//
// ★ 디자인센터 사용자는 작업 리스트에서 **자기가 잡은 것만** 봅니다.
//   남의 일까지 보이면 무엇이 내 몫인지가 흐려집니다.
//   관리자는 전부 봅니다 — 누가 얼마나 잡고 있는지가 관리의 일입니다.
// =========================================================

/**
 * 자리.
 *
 * ★ DB 의 member_role 에는 admin·designer·technician 도 남아 있습니다.
 *   지난 계정이 그 값을 들고 있을 수 있어 타입에서 지우지 않았습니다.
 *   화면은 셋을 전부 '사용자' 로 읽고, 새로 고를 때는 둘만 줍니다.
 */
export type MemberRole = 'owner' | 'admin' | 'designer' | 'technician' | 'staff';

/** 새로 고를 수 있는 자리 — 세 섹터 모두 같습니다 */
export const ROLE_OPTIONS: MemberRole[] = ['owner', 'staff'];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: '관리자',
  // 지난 값들 — 전부 사용자로 읽습니다
  admin: '관리자',
  designer: '사용자',
  technician: '사용자',
  staff: '사용자',
};

export const ROLE_HINT: Record<'owner' | 'staff', string> = {
  owner: '금액과 정산까지 모두 봅니다. 사람도 늘립니다',
  staff: '주문·배송·파일. 금액은 안 보입니다',
};

/** 사람을 늘리고 자리를 고칠 수 있는가 */
export function canManageMembers(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * 금액을 볼 수 있는가.
 *
 * ★ 이 한 줄이 사용자와 관리자를 가릅니다.
 *   HOME 금액·금액추이, 정산, 제품 단가, 거래처 단가가 전부 여기에 겁니다.
 *   화면마다 role 을 다시 따지면 언젠가 한 곳을 빠뜨립니다.
 */
export function canSeeMoney(role: MemberRole | null): boolean {
  return canManageMembers(role);
}

export type MemberVerdict = { ok: true } | { ok: false; reason: string };

/**
 * 새 사용자를 만들 수 있는 값인가.
 *
 * ★ 이메일 규칙을 촘촘하게 쓰지 않습니다.
 *   실제로 쓰이는 주소 중에 규칙에 안 맞는 것이 늘 있고, 막으면 그
 *   사람은 영영 못 들어옵니다.
 */
export function checkNewMember(name: string, email: string, role: MemberRole): MemberVerdict {
  if (!name.trim()) return { ok: false, reason: '이름을 넣어 주세요' };

  const trimmed = email.trim();
  if (!trimmed) return { ok: false, reason: '이메일을 넣어 주세요' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, reason: '이메일 모양이 아닙니다' };
  }
  if (!ROLE_OPTIONS.includes(role)) return { ok: false, reason: '없는 자리입니다' };

  return { ok: true };
}

// ---------- 마지막 관리자 ----------

export interface MemberSeat {
  userId: string;
  role: MemberRole;
  isActive: boolean;
}

/** 지금 살아 있는 관리자 수 */
export function activeOwners(members: MemberSeat[]): number {
  return members.filter((m) => m.isActive && canManageMembers(m.role)).length;
}

/**
 * 이 사람의 자리를 바꿔도 되는가.
 *
 * ★ 관리자가 하나뿐일 때 그 사람을 내리면 조직에 주인이 없어집니다.
 *   그러면 아무도 사람을 늘리지 못하고, 되돌릴 방법이 화면에 없습니다.
 */
export function canChangeRole(
  members: MemberSeat[],
  userId: string,
  next: MemberRole,
): MemberVerdict {
  const me = members.find((m) => m.userId === userId);
  if (!me) return { ok: false, reason: '이 조직 사람이 아닙니다' };

  if (canManageMembers(me.role) && !canManageMembers(next) && activeOwners(members) <= 1) {
    return { ok: false, reason: '관리자가 한 명뿐입니다. 다른 사람을 먼저 관리자로 올려 주세요' };
  }

  return { ok: true };
}

/** 이 사람을 꺼도 되는가 */
export function canDeactivate(members: MemberSeat[], userId: string): MemberVerdict {
  const me = members.find((m) => m.userId === userId);
  if (!me) return { ok: false, reason: '이 조직 사람이 아닙니다' };
  if (!me.isActive) return { ok: false, reason: '이미 꺼져 있습니다' };

  if (canManageMembers(me.role) && activeOwners(members) <= 1) {
    return { ok: false, reason: '관리자가 한 명뿐입니다. 다른 사람을 먼저 관리자로 올려 주세요' };
  }

  return { ok: true };
}

// ---------- 임시 비밀번호 ----------

/**
 * 관리자가 계정을 만들 때 함께 나오는 임시 비밀번호.
 *
 * ★ 관리자가 직접 짓게 하지 않습니다.
 *   직접 짓게 두면 전 직원이 같은 비밀번호를 받습니다 — 늘 그렇습니다.
 *
 * ★ 헷갈리는 글자를 뺍니다 (0·O·1·l·I).
 *   전화로 불러 주는 값이라, 한 글자가 안 읽히면 되돌아옵니다.
 */
const SAFE = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function makeTempPassword(random: () => number = Math.random, length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SAFE[Math.floor(random() * SAFE.length)];
  }

  // 규칙(길이 8 이상)을 늘 넘기도록 뒤에 붙입니다
  return `${out}!7`;
}

/** 자리를 화면에 쓰는 두 가지 중 하나로 좁힙니다 */
export function normalizeRole(role: MemberRole): 'owner' | 'staff' {
  return canManageMembers(role) ? 'owner' : 'staff';
}
