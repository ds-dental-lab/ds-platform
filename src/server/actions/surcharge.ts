// =========================================================
// 놓을 위치: src/server/actions/surcharge.ts
//
// 추가 과금 항목의 금액 수정. 디자인센터만 할 수 있습니다.
// 실제 차단은 RLS 가 합니다 (surcharge_write 정책).
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export type SurchargeResult = { ok: true } | { ok: false; error: string };

export async function submitSurchargeAmount(
  id: string,
  amount: number,
): Promise<SurchargeResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center') {
    return { ok: false, error: '디자인센터만 금액을 정할 수 있습니다' };
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: '0 이상의 금액을 넣어 주세요' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('surcharge_prices')
    .update({ amount })
    .eq('id', id)
    .select('id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '고칠 수 있는 항목이 아닙니다' };
  }

  revalidatePath('/design/products');
  revalidatePath('/clinic/orders/new');

  return { ok: true };
}

/** 치과 전용 금액을 새로 만듭니다. 기본값과 다르게 받고 싶을 때 씁니다 */
export async function submitClinicSurcharge(
  code: string,
  name: string,
  clinicOrgId: string,
  amount: number,
): Promise<SurchargeResult> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) {
    return { ok: false, error: '디자인센터만 금액을 정할 수 있습니다' };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('surcharge_prices').insert({
    owner_org_id: session.orgId,
    target_clinic_org_id: clinicOrgId,
    code,
    name,
    amount,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '이 치과의 금액이 이미 있습니다'
          : `저장하지 못했습니다: ${error.message}`,
    };
  }

  revalidatePath('/design/products');
  return { ok: true };
}
