// =========================================================
// 놓을 위치: src/server/actions/member.ts
//
// 사용자 추가 · 비밀번호 새로 만들기 · 자리 바꾸기 · 끄기.
// (사용자 결정 2026-08-12 — 관리자가 계정을 바로 만듭니다)
//
// ★ 계정을 만들려면 service_role 열쇠가 필요합니다.
//   anon 열쇠로도 signUp 은 되지만, 이 프로젝트는 메일 확인이 켜져 있어
//   확인 메일을 기다려야 합니다 — 그 메일은 Supabase 기본 발송함을
//   쓰는데 시간당 몇 통으로 막혀 있습니다 (실제로 재 봤습니다:
//   "email rate limit exceeded"). 그래서 열쇠가 없으면 여기서 멈추고
//   무엇을 어디에 넣어야 하는지 말해 줍니다.
//
// ★ 열쇠는 브라우저로 절대 안 나갑니다.
//   NEXT_PUBLIC_ 이 안 붙은 이름이라 서버에만 있습니다. 이 파일은
//   'use server' 이고, 돌려주는 것은 임시 비밀번호 한 줄뿐입니다.
//
// ★ 마지막 관리자는 못 내리고 못 끕니다 (domain/member).
//   화면이 먼저 막고 여기서 다시 봅니다 — 목록이 오래된 채로 눌릴 수
//   있고, 그 사이 다른 사람이 관리자를 내렸을 수 있습니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getSession } from '@/server/policies/session';
import {
  checkNewMember,
  canChangeRole,
  canDeactivate,
  canManageMembers,
  makeTempPassword,
  type MemberRole,
  type MemberSeat,
} from '@/server/domain/member';

export type MemberResult = { ok: true } | { ok: false; error: string };
export type SecretResult = { ok: true; password: string } | { ok: false; error: string };

const NO_KEY =
  '계정을 만들려면 서버에 열쇠가 하나 필요합니다.\n' +
  'Supabase 대시보드 → Settings → API → service_role 값을 복사해서\n' +
  '.env.local 에 SUPABASE_SERVICE_ROLE_KEY=... 로 넣고 서버를 다시 띄워 주세요.';

/**
 * 계정을 만들고 지우는 데만 쓰는 손잡이.
 *
 * ★ 이 열쇠는 RLS 를 통째로 지나갑니다.
 *   그래서 여기서만, 이 함수들에서만 씁니다. 조회는 전부 평소 손잡이로
 *   합니다 — 실수로 남의 조직 것을 읽어 오지 않게.
 */
function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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

/** 지금 이 조직 사람들의 자리 — 마지막 관리자를 지키는 데 씁니다 */
async function loadSeats(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
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

// ---------- 사용자 추가 ----------

export interface NewMemberInput {
  name: string;
  email: string;
  role: MemberRole;
}

export async function submitCreateMember(input: NewMemberInput): Promise<SecretResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '관리자만 사용자를 추가할 수 있습니다' };

  const verdict = checkNewMember(input.name, input.email, input.role);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const admin = adminClient();
  if (!admin) return { ok: false, error: NO_KEY };

  const email = input.email.trim().toLowerCase();
  const password = makeTempPassword();

  /*
    ★ email_confirm 을 켜서 만듭니다.
      메일을 기다리지 않고 바로 로그인합니다 — 관리자가 임시 비밀번호를
      알려 주는 것이 곧 초대입니다.
  */
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: input.name.trim() },
  });

  if (error || !data.user) {
    return {
      ok: false,
      error: (error?.message ?? '').includes('already')
        ? '이미 그 이메일로 만들어진 계정이 있습니다'
        : `만들지 못했습니다: ${error?.message ?? '알 수 없는 오류'}`,
    };
  }

  /*
    ★ 자리에 앉히는 것은 열쇠로 합니다.
      가입 트리거(handle_new_user)는 초대장을 보는데, 이제 초대장을
      안 씁니다. 여기서 곧바로 넣는 편이 한 눈에 보입니다.
  */
  const { error: seatError } = await admin.from('memberships').insert({
    org_id: session.orgId,
    user_id: data.user.id,
    role: input.role,
    is_active: true,
  });

  if (seatError) {
    // 자리에 못 앉으면 계정만 떠돌게 됩니다 — 되돌립니다
    await admin.auth.admin.deleteUser(data.user.id);

    return { ok: false, error: `자리에 앉히지 못했습니다: ${seatError.message}` };
  }

  refresh();

  return { ok: true, password };
}

/**
 * 새 임시 비밀번호.
 *
 * ★ 잃어버린 비밀번호를 알려 줄 방법은 없습니다 (저장이 안 되니까요).
 *   새로 만들어 주는 것이 유일한 길입니다.
 */
export async function submitResetPassword(userId: string): Promise<SecretResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '관리자만 바꿀 수 있습니다' };

  const supabase = await createServerClient();
  const seats = await loadSeats(supabase, session.orgId!);

  // ★ 우리 조직 사람인지 먼저 봅니다 — 열쇠는 남의 조직도 열 수 있습니다
  if (!seats.some((s) => s.userId === userId)) {
    return { ok: false, error: '이 조직 사람이 아닙니다' };
  }

  const admin = adminClient();
  if (!admin) return { ok: false, error: NO_KEY };

  const password = makeTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });

  if (error) return { ok: false, error: `바꾸지 못했습니다: ${error.message}` };

  return { ok: true, password };
}

// ---------- 자리 ----------

export async function submitChangeRole(userId: string, role: MemberRole): Promise<MemberResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '관리자만 자리를 고칠 수 있습니다' };

  const supabase = await createServerClient();
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
 */
export async function submitToggleMember(userId: string, active: boolean): Promise<MemberResult> {
  const session = await requireManager();
  if (!session) return { ok: false, error: '관리자만 고칠 수 있습니다' };

  // ★ 자기 자신을 끄면 그 자리에서 화면이 사라집니다
  if (userId === session.user.id && !active) {
    return { ok: false, error: '자기 자신은 끌 수 없습니다' };
  }

  const supabase = await createServerClient();

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
