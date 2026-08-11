// =========================================================
// 놓을 위치: src/server/repositories/option-preset.ts
//
// 제작옵션 즐겨찾기. (기능명세서 §4.2.8)
// 한 치과 안에서 원장마다 늘 쓰는 값이 달라 이름을 붙여 나눠 둡니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface OptionPreset {
  id: string;
  name: string;
  /** { 옵션그룹id: 옵션값id } */
  selections: Record<string, string>;
}

interface RawPreset {
  id: string;
  name: string;
  selections: Record<string, string> | null;
}

/**
 * 제작옵션 즐겨찾기.
 *
 * ★ 대리등록이면 그 치과의 것을 줍니다 (clinicOrgId).
 *   디자인센터는 거래처 치과 전부의 즐겨찾기를 읽을 수 있어,
 *   안 좁히면 여러 치과의 'A원장' 이 뒤섞여 나옵니다.
 */
export async function listOptionPresets(clinicOrgId?: string): Promise<OptionPreset[]> {
  const supabase = await createClient();

  let q = supabase
    .from('clinic_option_presets')
    .select('id, name, selections');

  if (clinicOrgId) q = q.eq('clinic_org_id', clinicOrgId);

  const { data, error } = await q.order('sort_order').order('created_at');

  if (error || !data) return [];

  return (data as unknown as RawPreset[]).map((row) => ({
    id: row.id,
    name: row.name,
    selections: row.selections ?? {},
  }));
}
