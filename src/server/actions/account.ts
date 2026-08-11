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
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

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
