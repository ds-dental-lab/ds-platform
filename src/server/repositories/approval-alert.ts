// =========================================================
// 놓을 위치: src/server/repositories/approval-alert.ts
//
// 센터에 알릴 때 필요한 것들 — 어느 조직인지, 관리자 메일이 무엇인지,
// 지금 기다리는 일이 몇 건인지.
//
// ★ 앞의 둘은 **관리 키**로 읽습니다. 가입 신청은 아직 소속이 없는
//   사람이, 홈페이지 문의는 로그인 안 한 사람이 만듭니다 — 그 권한으로는
//   센터 관리자의 메일이 안 보입니다. RLS 가 맞게 막는 것입니다.
//   이 파일은 서버 전용이고, 화면에서 import 하면 안 됩니다.
//
// ★ 기다리는 수는 **로그인한 사람의 권한**으로 셉니다 — HOME 띠는
//   센터 관리자가 보는 것이고, 그 사람 눈에 보이는 만큼만 세면 됩니다.
// =========================================================

import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { countPendingSignups } from '@/server/repositories/signup';
import { countNewContacts } from '@/server/repositories/contact';

export interface DesignCenterTargets {
  orgId: string;
  /** 관리자(owner·admin)의 메일. 비어 있을 수 있습니다 */
  emails: string[];
}

export async function getDesignCenterTargets(): Promise<DesignCenterTargets | null> {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('org_type', 'design_center')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (!org?.id) return null;

  const { data: members } = await admin
    .from('memberships')
    .select('user_id, role')
    .eq('org_id', org.id)
    .eq('is_active', true)
    .in('role', ['owner', 'admin']);

  const ids = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  if (ids.length === 0) return { orgId: org.id, emails: [] };

  const { data: profiles } = await admin.from('user_profiles').select('email').in('id', ids);

  const emails = ((profiles ?? []) as { email: string | null }[])
    .map((p) => (p.email ?? '').trim())
    .filter((e) => e.includes('@'));

  return { orgId: org.id, emails: [...new Set(emails)] };
}

export interface ApprovalQueue {
  signups: number;
  contacts: number;
}

/** HOME 띠에 세울 수. 못 세면 0 — 띠 하나 때문에 HOME 이 무너지면 안 됩니다 */
export async function countApprovalQueue(): Promise<ApprovalQueue> {
  const [signups, contacts] = await Promise.all([
    countPendingSignups().catch(() => 0),
    countNewContacts().catch(() => 0),
  ]);

  return { signups, contacts };
}
