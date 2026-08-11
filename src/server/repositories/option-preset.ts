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

export async function listOptionPresets(): Promise<OptionPreset[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clinic_option_presets')
    .select('id, name, selections')
    .order('sort_order')
    .order('created_at');

  if (error || !data) return [];

  return (data as unknown as RawPreset[]).map((row) => ({
    id: row.id,
    name: row.name,
    selections: row.selections ?? {},
  }));
}
