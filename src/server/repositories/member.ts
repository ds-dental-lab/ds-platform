// =========================================================
// 놓을 위치: src/server/repositories/member.ts
//
// 우리 조직 사람과 초대장.
//
// ★ 제 조직 것만 돌아옵니다 (RLS membership_select_own_org · invite_select).
//   사람을 늘리는 일은 그 조직의 일입니다 — 디자인센터가 남의 치과
//   직원을 만들 일이 아닙니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import type { MemberRole } from '@/server/domain/member';

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  isActive: boolean;
  joinedAt: string;
  /** 지금 보고 있는 사람 자신인가 */
  isMe: boolean;
}

export interface MemberBoard {
  members: MemberRow[];
  /** 지금 보고 있는 사람이 사람을 늘릴 수 있는가 */
  canManage: boolean;
  sector: 'clinic' | 'design_center' | 'lab';
}

/** 담당 셀렉박스에 세울 사람 한 줄 */
export interface SeatOption {
  userId: string;
  name: string;
}

/**
 * 지금 일할 수 있는 우리 조직 사람들. 담당 디자이너 셀렉박스가 씁니다.
 *
 * ★ 꺼진 계정은 빼고, 자리는 안 가립니다.
 *   그만둔 사람에게 새 주문을 붙이면 아무도 그 일을 안 합니다.
 *   반대로 자리로 거르지는 않습니다 — 관리자도 디자인을 잡습니다.
 *   작은 디자인센터에서는 관리자가 제일 많이 만듭니다.
 */
export async function listSeatOptions(): Promise<SeatOption[]> {
  const session = await getSession();
  if (!session?.orgId) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('org_id', session.orgId)
    .eq('is_active', true)
    .is('deleted_at', null);

  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((m) => m.user_id))];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, name')
    .in('id', ids);

  return ((profiles ?? []) as { id: string; name: string | null }[])
    .map((p) => ({ userId: p.id, name: p.name?.trim() || '이름 없음' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export async function getMemberBoard(): Promise<MemberBoard | null> {
  const session = await getSession();
  if (!session?.orgId || !session.orgType) return null;

  const supabase = await createClient();

  const memberRes = await supabase
    .from('memberships')
    .select('user_id, role, is_active, created_at')
    .eq('org_id', session.orgId)
    .is('deleted_at', null)
    .order('created_at');

  interface RawMember {
    user_id: string;
    role: MemberRole;
    is_active: boolean;
    created_at: string;
  }

  const rawMembers = (memberRes.data ?? []) as unknown as RawMember[];

  // 이름·메일은 프로필에서 — memberships 에는 없습니다
  const ids = [...new Set(rawMembers.map((m) => m.user_id))];
  const profiles = new Map<string, { name: string; email: string }>();

  if (ids.length > 0) {
    const { data } = await supabase.from('user_profiles').select('id, name, email').in('id', ids);

    for (const p of (data ?? []) as { id: string; name: string | null; email: string | null }[]) {
      profiles.set(p.id, { name: p.name ?? '', email: p.email ?? '' });
    }
  }

  return {
    sector: session.orgType,
    canManage: session.role === 'owner' || session.role === 'admin',

    members: rawMembers.map((m) => ({
      userId: m.user_id,
      name: profiles.get(m.user_id)?.name ?? '이름 없음',
      email: profiles.get(m.user_id)?.email ?? '',
      role: m.role,
      isActive: m.is_active,
      joinedAt: m.created_at,
      isMe: m.user_id === session.user.id,
    })),
  };
}
