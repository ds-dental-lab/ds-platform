// =========================================================
// 놓을 위치: src/server/repositories/production-option.ts
//
// 제작옵션 마스터. (기능명세서 §4.2.8 — 훅 · 폰틱타입)
// 조회는 전 섹터에 열려 있습니다. 주문을 넣으려면 목록이 필요합니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface ProductionOptionValue {
  id: string;
  value: string;
  isDefault: boolean;
}

export interface ProductionOptionGroup {
  id: string;
  code: string;
  name: string;
  values: ProductionOptionValue[];
}

interface RawValue {
  id: string;
  value: string;
  is_default: boolean;
  sort_order: number;
}

interface RawGroup {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  production_option_values: RawValue[] | null;
}

export async function getProductionOptions(): Promise<ProductionOptionGroup[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('production_option_groups')
    .select('id, code, name, sort_order, production_option_values(id, value, is_default, sort_order)')
    .order('sort_order');

  if (error || !data) return [];

  return (data as unknown as RawGroup[]).map((group) => ({
    id: group.id,
    code: group.code,
    name: group.name,
    values: (group.production_option_values ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, value: v.value, isDefault: v.is_default })),
  }));
}
