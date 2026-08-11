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
