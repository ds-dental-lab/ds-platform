// =========================================================
// 놓을 위치: src/server/actions/device-link.ts
//
// 치과 관리자가 스캐너 PC 를 연결·해제합니다 (2026-10-02).
//
// ★ 치과 **관리자만**. 기기 하나가 그 치과의 스캔 올리기 권한을 갖습니다.
// ★ 코드는 10분·한 번입니다 (domain/device-link).
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/server/policies/session';
import { canManageMembers, type MemberRole } from '@/server/domain/member';
import { canLinkDevice, linkCodeExpiry, makeLinkCode } from '@/server/domain/device-link';
import type { Sector } from '@/server/domain/order-status';

export type LinkCodeResult = { ok: true; code: string; minutes: number } | { ok: false; error: string };

/**
 * PC 를 묶고 푸는 사람.
 *
 * ★★ **디자인센터도 묶습니다** (2026-10-14). 누가 묶을 수 있는지는
 *   domain/device-link 의 canLinkDevice 가 정합니다 — 여기서 자리 이름을
 *   직접 따지면 시험이 못 닿습니다.
 * ★ 관리자만인 것은 그대로입니다. 기기 하나가 그 조직의 권한을 쥡니다.
 */
async function requireDeviceManager() {
  const session = await getSession();
  if (
    !canLinkDevice(session?.orgType as Sector | null) ||
    !canManageMembers(session?.role as MemberRole | null)
  ) {
    return null;
  }
  return session;
}

/** 묶은 뒤 다시 그려야 하는 화면 — 자리마다 다릅니다 */
function accountPath(sector: string | null | undefined): string {
  return sector === 'design_center' ? '/design/account' : '/clinic/account';
}

export async function submitDeviceCode(): Promise<LinkCodeResult> {
  const session = await requireDeviceManager();
  if (!session?.orgId) return { ok: false, error: '관리자만 연결할 수 있습니다' };

  const admin = createAdminClient();

  // 아주 드물게 같은 코드가 겹칠 수 있어 몇 번 다시 뽑습니다
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeLinkCode();
    const { error } = await admin.from('device_link_codes').insert({
      code,
      clinic_org_id: session.orgId,
      created_by: session.user.id,
      expires_at: linkCodeExpiry(),
    });

    if (!error) {
      revalidatePath(accountPath(session.orgType));
      return { ok: true, code, minutes: 10 };
    }
  }

  return { ok: false, error: '코드를 만들지 못했습니다. 다시 눌러 주세요' };
}

export async function submitRevokeDevice(deviceId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireDeviceManager();
  if (!session?.orgId) return { ok: false, error: '관리자만 해제할 수 있습니다' };

  const supabase = await createClient();
  // ★ 자기 치과의 기기만 — RLS 가 한 번 더 봅니다
  const { data } = await supabase.from('clinic_devices').select('id').eq('id', deviceId).maybeSingle();
  if (!data) return { ok: false, error: '없는 기기입니다' };

  const { error } = await createAdminClient()
    .from('clinic_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', deviceId)
    .eq('clinic_org_id', session.orgId);

  if (error) return { ok: false, error: `해제하지 못했습니다: ${error.message}` };

  revalidatePath(accountPath(session.orgType));
  return { ok: true };
}
