// =========================================================
// 놓을 위치: src/server/repositories/surcharge.ts
//
// 추가 과금 항목의 금액. (치은포셀린 등)
//
// 금액은 디자인센터가 정하고 치과별로 다를 수 있습니다.
// 치과 전용 금액이 있으면 그것을, 없으면 기본값을 씁니다 —
// 설계서 §4.7 의 단가 조회 우선순위와 같은 규칙입니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export interface SurchargeRow {
  id: string;
  code: string;
  name: string;
  amount: number;
  /** 이 금액이 걸린 치과. 비어 있으면 모든 거래 치과 공통 기본값 */
  targetClinicOrgId: string | null;
  targetClinicName: string | null;
}

interface RawRow {
  id: string;
  code: string;
  name: string;
  amount: number | string;
  target_clinic_org_id: string | null;
  clinic: { name: string } | null;
}

/** 디자인센터가 관리하는 추가 항목 전부 (기본값 + 치과별) */
export async function listSurcharges(): Promise<SurchargeRow[]> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('surcharge_prices')
    .select(
      'id, code, name, amount, target_clinic_org_id, ' +
        'clinic:organizations!surcharge_prices_target_clinic_org_id_fkey(name)',
    )
    .eq('owner_org_id', session.orgId)
    .order('code');

  if (error || !data) return [];

  return (data as unknown as RawRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    amount: Number(row.amount),
    targetClinicOrgId: row.target_clinic_org_id,
    targetClinicName: row.clinic?.name ?? null,
  }));
}

/**
 * 이 치과에 적용되는 금액. 주문등록에서 "얼마 더 붙는지" 알려 줄 때 씁니다.
 * 치과 전용 값이 있으면 그것을, 없으면 기본값을 돌려줍니다.
 */
export async function getSurchargeAmount(code: string): Promise<number> {
  const session = await getSession();
  if (!session?.orgId) return 0;

  const supabase = await createClient();

  const { data } = await supabase
    .from('surcharge_prices')
    .select('amount, target_clinic_org_id')
    .eq('code', code);

  if (!data || data.length === 0) return 0;

  const rows = data as unknown as { amount: number | string; target_clinic_org_id: string | null }[];

  const mine = rows.find((r) => r.target_clinic_org_id === session.orgId);
  const fallback = rows.find((r) => r.target_clinic_org_id === null);

  return Number((mine ?? fallback)?.amount ?? 0);
}
