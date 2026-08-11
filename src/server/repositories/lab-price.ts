// =========================================================
// 놓을 위치: src/server/repositories/lab-price.ts
//
// 기공소가 보는 자기 기공원가.
//
// ★ 기공소는 **자기 것만** 봅니다 (RLS lab_cost_select).
//   다른 기공소의 단가도, 치과 판매가도 안 보입니다.
//   제품 이름은 값이 빠진 보기에서 읽습니다 —
//   원본 표(prosthesis_materials)에는 치과 판매가가 들어 있어
//   기공소에는 닫혀 있습니다 (설계서 §8.5).
//
// ★ 고치는 길은 없습니다.
//   단가는 디자인센터가 사용자탭에서 정합니다. 받는 쪽이 스스로
//   올리면 그건 단가가 아니라 청구입니다.
//   여기서는 '무엇을 얼마에 받기로 되어 있나' 를 확인만 합니다.
//
// ★ 안 정한 칸은 0원이 아니라 **'미정'** 입니다.
//   0원으로 보이면 "공짜로 만들라는 거냐" 가 되고, 실제로는 아직
//   안 정한 것뿐입니다. 정산에서도 같은 규칙입니다 (domain/pricing).
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export interface LabPriceRow {
  materialId: string;
  typeCode: string;
  typeName: string;
  abbr: string;
  materialCode: string;
  materialName: string;

  hasPontic: boolean;
  hasPink: boolean;

  /** null 이면 아직 안 정했습니다 */
  labCost: number | null;
  ponticCost: number | null;
  pinkCost: number | null;
}

export interface LabPriceBoard {
  rows: LabPriceRow[];
  /** 쓸 수 있는데 단가가 비어 있는 칸 수 */
  unsetCount: number;
}

interface RawProduct {
  id: string;
  code: string;
  name: string;
  abbr: string | null;
  has_pontic: boolean;
  has_pink: boolean;
  type_code: string;
  type_name: string;
  type_abbr: string | null;
  type_is_active: boolean;
  is_active: boolean;
  type_sort_order: number | null;
  sort_order: number | null;
}

export async function getLabPrices(): Promise<LabPriceBoard | null> {
  const session = await getSession();
  if (!session?.orgId || session.orgType !== 'lab') return null;

  const supabase = await createClient();

  const [productRes, costRes] = await Promise.all([
    supabase
      .from('prosthesis_products_public')
      .select(
        'id, code, name, abbr, has_pontic, has_pink, is_active, sort_order, ' +
          'type_code, type_name, type_abbr, type_is_active, type_sort_order',
      ),

    // RLS 가 자기 것만 줍니다 — 여기서 lab_org_id 를 또 걸지 않아도 됩니다
    supabase
      .from('lab_product_costs')
      .select('material_id, lab_cost, pontic_cost, pink_cost'),
  ]);

  const costs = new Map<
    string,
    { lab_cost: number | null; pontic_cost: number | null; pink_cost: number | null }
  >();

  for (const c of (costRes.data ?? []) as {
    material_id: string;
    lab_cost: number | null;
    pontic_cost: number | null;
    pink_cost: number | null;
  }[]) {
    costs.set(c.material_id, c);
  }

  const products = ((productRes.data ?? []) as unknown as RawProduct[])
    .filter((p) => p.is_active && p.type_is_active)
    .sort(
      (a, b) =>
        (a.type_sort_order ?? 0) - (b.type_sort_order ?? 0) ||
        a.type_code.localeCompare(b.type_code) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.code.localeCompare(b.code),
    );

  let unsetCount = 0;

  const rows = products.map((p) => {
    const c = costs.get(p.id);

    const labCost = c?.lab_cost ?? null;
    const ponticCost = c?.pontic_cost ?? null;
    const pinkCost = c?.pink_cost ?? null;

    // ★ 쓸 수 있는 칸만 셉니다 — 폰틱이 안 되는 제품의 폰틱 단가는
    //   비어 있는 게 맞습니다. 그걸 '미정' 으로 세면 숫자가 늘 커집니다
    if (labCost === null) unsetCount += 1;
    if (p.has_pontic && ponticCost === null) unsetCount += 1;
    if (p.has_pink && pinkCost === null) unsetCount += 1;

    return {
      materialId: p.id,
      typeCode: p.type_code,
      typeName: p.type_name,
      abbr: p.type_abbr ?? p.abbr ?? p.code,
      materialCode: p.code,
      materialName: p.name,
      hasPontic: p.has_pontic,
      hasPink: p.has_pink,
      labCost,
      ponticCost,
      pinkCost,
    };
  });

  return { rows, unsetCount };
}
