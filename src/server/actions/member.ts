// =========================================================
// 놓을 위치: src/server/actions/member.ts
//
// 직원 초대 · 자리 바꾸기 · 끄기.
//
// ★ 계정을 대신 만들지 않습니다. 초대장을 놓아 둡니다.
//   계정을 서버에서 만들려면 service_role 열쇠가 필요한데 지금 없고,
//   있더라도 남의 비밀번호를 관리자가 정하는 모양은 좋지 않습니다.
//   초대장을 놓아 두면 본인이 가입하는 순간 자리에 앉습니다
//   (DB 트리거 handle_new_user 가 짝을 맞춥니다).
//
// ★ 마지막 대표는 못 내리고 못 끕니다 (domain/member).
//   화면이 먼저 막고 여기서 다시 봅니다 — 목록이 오래된 채로 눌릴 수
//   있고, 그 사이 다른 사람이 대표를 내렸을 수 있습니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import {
  checkInvite,
  canChangeRole,
  canDeactivate,
  canManageMembers,
  type MemberRole,
  type MemberSeat,
} from '@/server/domain/member';

export type MemberResult = { ok: true } | { ok: false; error: string };

async function requireManager() {
  const session = await getSession();
  if (!session?.orgId || !session.orgType) return null;
  if (!canManageMembers(session.role as MemberRole | null)) return null;

  return session;
}

function refresh() {
  for (const path of ['/clinic', '/design', '/lab']) {
    revalidatePath(`${path}/account`);
    revalidatePath(`${path}/users`);
    revalidatePath(`${path}/account/members`);
  }
}

/** 지금 이 조직 사람들의 자리 — 마지막 대표를 지키는 데 씁니다 */
async function loadSeats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<MemberSeat[]> {
  const { data } = await supabase
    .from('memberships')
    .select('user_id, role, is_active')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  return ((data ?? []) as { user_id: string; role: MemberRole; is_active: boolean }[]).map((m) => ({
    userId: m.user_id,
    role: m.role,
    isActive: m.is_active,
  }));
}

// ---------- 초대 ----------

export interface InviteInput {
  email: string;
  name: string;
  role: MemberRole;
}

export async function submitInvite(input: InviteInput): Promise<MemberResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '대표·관리자만 사람을 부를 수 있습니다' };

  const verdict = checkInvite(input.email, input.role, session.orgType!);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const email = input.email.trim().toLowerCase();
  const supabase = await createClient();

  /*
    ★ 이미 우리 조직 사람이면 초대장을 안 만듭니다.
      만들어 두면 목록에 '기다리는 중' 으로 남아 있는데, 그 사람은
      이미 들어와 있어서 영영 안 없어집니다.
  */
  const { data: already } = await supabase
    .from('user_profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (already) {
    const seats = await loadSeats(supabase, session.orgId!);
    if (seats.some((s) => s.userId === (already as { id: string }).id)) {
      return { ok: false, error: '이미 우리 조직 사람입니다' };
    }
  }

  const { error } = await supabase.from('org_invites').insert({
    org_id: session.orgId,
    email,
    name: input.name.trim() || null,
    role: input.role,
    invited_by: session.user.id,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '그 이메일로 보낸 초대장이 이미 기다리고 있습니다'
          : `부르지 못했습니다: ${error.message}`,
    };
  }

  refresh();

  return { ok: true };
}

/** 초대장을 물립니다 */
export async function submitRevokeInvite(inviteId: string): Promise<MemberResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '대표·관리자만 물릴 수 있습니다' };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('org_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id');

  if (error) return { ok: false, error: `물리지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '물릴 수 있는 초대장이 아닙니다' };

  refresh();

  return { ok: true };
}

// ---------- 자리 ----------

export async function submitChangeRole(
  userId: string,
  role: MemberRole,
): Promise<MemberResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '대표·관리자만 자리를 고칠 수 있습니다' };

  const supabase = await createClient();
  const seats = await loadSeats(supabase, session.orgId!);

  const verdict = canChangeRole(seats, userId, role);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const { data, error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('org_id', session.orgId)
    .eq('user_id', userId)
    .select('id');

  if (error) return { ok: false, error: `고치지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '이 조직 사람이 아닙니다' };

  refresh();

  return { ok: true };
}

/**
 * 사람을 끄고 켭니다.
 *
 * ★ 지우지 않습니다.
 *   그 사람이 넣은 주문·조정·열람 기록이 전부 그 id 에 붙어 있습니다.
 *   지우면 지난 기록의 '누가' 가 통째로 사라집니다.
 *   끄면 로그인해도 아무 데도 못 들어갑니다 (is_active 를 세션이 봅니다).
 */
export async function submitToggleMember(
  userId: string,
  active: boolean,
): Promise<MemberResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '대표·관리자만 고칠 수 있습니다' };

  // ★ 자기 자신을 끄면 그 자리에서 화면이 사라집니다
  if (userId === session.user.id && !active) {
    return { ok: false, error: '자기 자신은 끌 수 없습니다' };
  }

  const supabase = await createClient();

  if (!active) {
    const seats = await loadSeats(supabase, session.orgId!);
    const verdict = canDeactivate(seats, userId);
    if (!verdict.ok) return { ok: false, error: verdict.reason };
  }

  const { data, error } = await supabase
    .from('memberships')
    .update({ is_active: active })
    .eq('org_id', session.orgId)
    .eq('user_id', userId)
    .select('id');

  if (error) return { ok: false, error: `고치지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '이 조직 사람이 아닙니다' };

  refresh();

  return { ok: true };
}
