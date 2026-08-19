// =========================================================
// 놓을 위치: src/server/repositories/terms.ts
//
// 이용약관 화면이 쓰는 값.
//
// ★ 로그인 없이 읽습니다.
//   약관은 **가입하기 전에** 읽을 수 있어야 합니다. 표는 RLS 로 잠겨
//   있으므로 공개해도 되는 값만 골라 주는 DB 함수를 부릅니다
//   (public_terms — security definer).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { TermsFacts } from '@/server/domain/terms';

const EMPTY: TermsFacts = {
  orgName: null,
  bizNo: null,
  address: null,
  tel: null,
  email: null,
  effectiveOn: null,
};

export async function getTermsFacts(): Promise<TermsFacts> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('public_terms');

  // ★ 못 읽어도 화면은 뜹니다 — 빈 칸으로 보이고 '초안' 이 됩니다.
  //   약관 본문은 코드에 있으니 DB 가 없어도 읽을 수 있어야 합니다.
  if (error || !data) return EMPTY;

  return { ...EMPTY, ...(data as TermsFacts) };
}
