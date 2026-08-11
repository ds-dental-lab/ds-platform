// =========================================================
// 놓을 위치: src/server/actions/patient.ts
//
// 환자 찾기. 주문등록의 이름 칸이 부릅니다.
//
// ★ 브라우저에서 직접 묻던 것을 서버로 옮겼습니다 (2026-08-12).
//   환자 검색은 이 시스템에서 가장 민감한 조회입니다 —
//   이름 몇 글자로 명단을 훑을 수 있습니다.
//   브라우저가 Supabase 에 바로 물으면 그 조회가 **기록에 안 남습니다**.
//   서버를 거쳐야 누가 언제 무엇을 찾았는지 남습니다 (설계서 §3.5).
//
// ★ 검색어 자체는 기록하지 않습니다.
//   검색어가 곧 환자 이름입니다. 로그에 담으면 개인정보를 한 벌 더
//   만드는 셈입니다. 몇 글자로 찾아 몇 명이 나왔는지만 남깁니다.
// =========================================================

'use server';

import { createClient } from '@/lib/supabase/server';
import { recordAccess } from '@/server/audit';

export interface PatientHit {
  id: string;
  chart_no: string;
  name: string;
}

export async function searchPatients(
  keyword: string,
  clinicOrgId?: string,
): Promise<PatientHit[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const supabase = await createClient();

  let query = supabase
    .from('patients')
    .select('id, chart_no, name')
    .is('deleted_at', null)
    .or(`chart_no.ilike.%${trimmed}%,name.ilike.%${trimmed}%`);

  // 디자인센터가 대신 넣을 때는 그 치과 안에서만 찾습니다
  if (clinicOrgId) query = query.eq('clinic_org_id', clinicOrgId);

  const { data } = await query.order('chart_no').limit(8);
  const hits = (data ?? []) as PatientHit[];

  await recordAccess({
    action: 'patient.search',
    subjectCount: hits.length,
    // ★ 검색어가 곧 이름입니다. 길이만 남깁니다
    detail: `${trimmed.length}자 검색`,
  });

  return hits;
}
