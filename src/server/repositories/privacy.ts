// =========================================================
// 놓을 위치: src/server/repositories/privacy.ts
//
// 처리방침 화면이 쓰는 값.
//
// ★ 로그인 없이 읽습니다.
//   처리방침은 누구나 볼 수 있어야 합니다. 표는 RLS 로 잠겨 있으므로
//   공개해도 되는 값만 골라 주는 DB 함수를 부릅니다
//   (public_privacy_policy — security definer).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PolicyFacts } from '@/server/domain/privacy';

const EMPTY: PolicyFacts = {
  orgName: null,
  bizNo: null,
  address: null,
  tel: null,
  officerName: null,
  officerDept: null,
  officerTel: null,
  officerEmail: null,
  effectiveOn: null,
  keepDays: null,
  labs: null,
};

export async function getPolicyFacts(): Promise<PolicyFacts> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('public_privacy_policy');

  // ★ 못 읽어도 화면은 뜹니다 — 빈 칸으로 보이고 '초안' 이 됩니다
  if (error || !data) return EMPTY;

  return { ...EMPTY, ...(data as PolicyFacts) };
}
