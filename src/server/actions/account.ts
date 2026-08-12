// =========================================================
// 놓을 위치: src/server/actions/account.ts
//
// 우리 조직 정보. 청구서에 그대로 실립니다.
//
// ★ 자기 조직만 고칩니다.
//   RLS(org_update)가 `id = my_org_id() and my_role() in ('owner','admin')`
//   로 잡아 두었습니다. 여기서는 이유를 말해 주기 위해 한 번 더 봅니다 —
//   정책에 걸리면 0행으로 돌아와 "왜 안 되지" 만 남습니다.
//
// ★ 조직 종류와 코드는 못 바꿉니다.
//   DB 트리거(freeze_org_identity)가 막습니다. 한 칸이 조직 전체의
//   권한을 옮기기 때문입니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { canManageMembers, type MemberRole } from '@/server/domain/member';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { INVOICE_METHODS, type InvoiceMethod } from '@/server/domain/invoice-method';

export type AccountResult = { ok: true } | { ok: false; error: string };

export interface AccountInput {
  name: string;
  ceoName: string;
  bizNo: string;
  tel: string;
  fax: string;
  address: string;
  invoiceEmail: string;
  taxEmail: string;
  /** 정산서를 어디로 받을지 (사용자 요청 2026-08-12) */
  invoiceMethod: InvoiceMethod;
}

/** 빈 칸은 null 로 넣습니다. '' 를 두면 '값이 있다' 로 보입니다 */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function submitAccount(input: AccountInput): Promise<AccountResult> {
  const session = await getSession();
  if (!session?.orgId) return { ok: false, error: '로그인이 필요합니다' };

  if (!input.name.trim()) return { ok: false, error: '상호를 넣어 주세요' };

  /*
    ★ 받을 곳을 고르고 그 칸을 비워 두면, 정산서가 갈 데가 없습니다.
      마감을 눌러 놓고 며칠 뒤에야 '안 왔다' 는 전화를 받습니다.
      고른 곳은 값이 있어야 저장됩니다.
  */
  if (!INVOICE_METHODS.includes(input.invoiceMethod)) {
    return { ok: false, error: '정산서 받을 곳을 골라 주세요' };
  }
  if (input.invoiceMethod !== 'fax' && !input.invoiceEmail.trim()) {
    return { ok: false, error: '이메일로 받으려면 청구서 수신 이메일을 넣어 주세요' };
  }
  if (input.invoiceMethod !== 'email' && !input.fax.trim()) {
    return { ok: false, error: '팩스로 받으려면 팩스 번호를 넣어 주세요' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: input.name.trim(),
      ceo_name: orNull(input.ceoName),
      biz_no: orNull(input.bizNo),
      tel: orNull(input.tel),
      fax: orNull(input.fax),
      address: orNull(input.address),
      invoice_email: orNull(input.invoiceEmail),
      tax_email: orNull(input.taxEmail),
      invoice_method: input.invoiceMethod,
    })
    .eq('id', session.orgId)
    .select('id');

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '같은 사업자등록번호가 이미 있습니다'
          : `저장하지 못했습니다: ${error.message}`,
    };
  }

  // RLS 는 오류가 아니라 0행으로 막습니다 — 권한이 없으면 여기로 옵니다
  if (!data || data.length === 0) {
    return { ok: false, error: '조직 정보를 고칠 권한이 없습니다 (관리자만)' };
  }

  revalidatePath('/clinic/account');
  revalidatePath('/design/account');
  revalidatePath('/lab/account');
  // 청구서 머리에 이 값이 실립니다
  revalidatePath('/design/billing', 'layout');

  return { ok: true };
}

// ---------- 개인정보 처리방침 ----------

export interface PrivacyInput {
  officerDept: string;
  officerTel: string;
  officerEmail: string;
  /** 비우면 초안으로 되돌아갑니다 */
  effectiveOn: string | null;
}

/**
 * 처리방침에 실릴 값을 정합니다.
 *
 * ★ 책임자의 **이름은 여기서 안 받습니다.**
 *   organizations.privacy_officer_user_id 가 가리키는 계정에서 따라옵니다.
 *   이름을 글자로 박아 두면 사람이 바뀌었을 때 문서만 옛 이름을 답니다.
 *
 * ★ 시행일을 넣는 것이 곧 "검토를 마쳤다" 는 뜻입니다.
 *   비어 있는 동안 공개 화면은 '초안' 이라고 밝힙니다.
 */
export async function submitPrivacySettings(input: PrivacyInput): Promise<AccountResult> {
  const session = await getSession();

  if (!session?.orgId || !canManageMembers(session.role as MemberRole | null)) {
    return { ok: false, error: '관리자만 정할 수 있습니다' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .update({
      privacy_officer_dept: input.officerDept.trim() || null,
      privacy_officer_tel: input.officerTel.trim() || null,
      privacy_officer_email: input.officerEmail.trim() || null,
      privacy_policy_effective_on: input.effectiveOn || null,
    })
    .eq('id', session.orgId)
    .select('id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '바꿀 수 있는 조직이 아닙니다' };

  revalidatePath('/design/account/privacy');
  revalidatePath('/privacy');

  return { ok: true };
}

/** 보호책임자를 우리 조직의 다른 사람으로 넘깁니다 */
export async function submitPrivacyOfficer(userId: string): Promise<AccountResult> {
  const session = await getSession();

  if (!session?.orgId || !canManageMembers(session.role as MemberRole | null)) {
    return { ok: false, error: '관리자만 정할 수 있습니다' };
  }

  const supabase = await createClient();

  // 화면이 보낸 id 를 믿지 않습니다 — 우리 조직 사람인지 봅니다
  const { data: seat } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('user_id', userId)
    .eq('org_id', session.orgId)
    .eq('is_active', true)
    .maybeSingle();

  if (!seat) return { ok: false, error: '우리 조직 사람이 아닙니다' };

  const { error } = await supabase
    .from('organizations')
    .update({ privacy_officer_user_id: userId })
    .eq('id', session.orgId);

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };

  revalidatePath('/design/account/privacy');
  revalidatePath('/privacy');

  return { ok: true };
}
