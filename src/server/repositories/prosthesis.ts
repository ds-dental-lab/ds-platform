// =========================================================
// 놓을 위치: src/server/repositories/prosthesis.ts
//
// 보철 제품 목록. 디자인센터가 제품탭에서 관리합니다.
//
// ★ 치과에는 켜 둔 것만 내려보냅니다.
//   제품탭에서 끄면 주문등록 목록에서 사라집니다. 반대로 새 제품을
//   등록하면 배포 없이 다음 새로고침에 나타납니다.
//
// ★ 디자인센터에는 꺼진 것도 함께 줍니다.
//   제품탭에서 켜고 끄려면 꺼진 것이 보여야 합니다.
//
// ★ 지난 주문이 가리키는 조합은 꺼져도 이름을 잃지 않아야 합니다.
//   그래서 상세·목록처럼 '읽기만 하는' 화면에는 전체를 줍니다.
//   (buildAbbr 는 못 찾으면 코드를 그대로 찍어 화면이 죽지는 않습니다)
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { FALLBACK_TYPES, type ProsthesisCatalog } from '@/server/domain/prosthesis';

interface RawMaterial {
  code: string;
  name: string;
  abbr: string;
  is_active: boolean;
  sort_order: number;
  has_shade: boolean;
  has_pontic: boolean;
  has_pink: boolean;
  price: number | null;
  pontic_price: number | null;
  pink_price: number | null;
}

interface RawType {
  code: string;
  name: string;
  abbr: string;
  is_active: boolean;
  sort_order: number;
  needs_implant_model: boolean;
  abbr_material_only: boolean;
  color: string;
  color_soft: string;
  prosthesis_materials: RawMaterial[] | null;
}

export interface CatalogOptions {
  /** 꺼진 것도 포함할지. 제품탭과 읽기 화면에서 씁니다 */
  includeInactive?: boolean;
}

export async function getProsthesisCatalog(
  options: CatalogOptions = {},
): Promise<ProsthesisCatalog> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prosthesis_types')
    .select(
      'code, name, abbr, is_active, sort_order, ' +
        'needs_implant_model, abbr_material_only, color, color_soft, ' +
        'prosthesis_materials(code, name, abbr, is_active, sort_order, ' +
        'has_shade, has_pontic, has_pink, price, pontic_price, pink_price)',
    )
    .order('sort_order');

  // ★ 표를 못 읽어도 주문등록이 통째로 비면 안 됩니다.
  //   씨앗과 같은 최소 목록으로 버팁니다.
  if (error || !data || data.length === 0) return FALLBACK_TYPES;

  const rows = data as unknown as RawType[];

  return rows
    .filter((t) => options.includeInactive || t.is_active)
    .map((type) => ({
      code: type.code as ProsthesisCatalog[number]['code'],
      name: type.name,
      abbr: type.abbr,
      needsImplantModel: type.needs_implant_model,
      abbrMaterialOnly: type.abbr_material_only,
      color: type.color,
      colorSoft: type.color_soft,
      materials: (type.prosthesis_materials ?? [])
        .filter((m) => options.includeInactive || m.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({
          code: m.code,
          name: m.name,
          abbr: m.abbr,
          hasShade: m.has_shade,
          hasPontic: m.has_pontic,
          hasPink: m.has_pink,
          price: m.price,
          ponticPrice: m.pontic_price,
          pinkPrice: m.pink_price,
        })),
    }))
    // 재료가 하나도 없는 종류는 고를 수 없어 세우지 않습니다
    .filter((type) => options.includeInactive || type.materials.length > 0);
}

// ---------- 제품탭 ----------

/**
 * 제품탭이 그리는 한 줄. 종류와 재료를 펼쳐 놓습니다.
 *
 * ★ 화면은 (종류 × 재료) 짝을 한 줄로 봅니다.
 *   표는 둘로 나뉘어 있지만 원장이 보는 '제품' 은 그 짝입니다.
 */
export interface ProductRow {
  materialId: string;
  typeId: string;

  typeCode: string;
  typeName: string;
  typeSortOrder: number;

  materialCode: string;
  materialName: string;
  materialAbbr: string;
  sortOrder: number;

  hasShade: boolean;
  hasPontic: boolean;
  hasPink: boolean;

  price: number | null;
  ponticPrice: number | null;
  pinkPrice: number | null;

  isActive: boolean;
}

/** 제품탭에서 종류를 고를 때 쓰는 목록 */
export interface TypeOption {
  id: string;
  code: string;
  name: string;
  abbr: string;
  isActive: boolean;
}

interface RawEditType {
  id: string;
  code: string;
  name: string;
  abbr: string;
  is_active: boolean;
  sort_order: number;
  prosthesis_materials:
    | {
        id: string;
        code: string;
        name: string;
        abbr: string;
        is_active: boolean;
        sort_order: number;
        has_shade: boolean;
        has_pontic: boolean;
        has_pink: boolean;
        price: number | null;
        pontic_price: number | null;
        pink_price: number | null;
      }[]
    | null;
}

/**
 * 제품탭용 전체 목록. 꺼진 것도 함께 옵니다.
 *
 * ★ 정렬은 종류 순서 → 재료 순서입니다.
 *   재료 순서가 곧 주문등록 칩의 순서라, 여기서 보이는 대로 저기서 나옵니다.
 */
export async function listProducts(): Promise<{
  rows: ProductRow[];
  types: TypeOption[];
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prosthesis_types')
    .select(
      'id, code, name, abbr, is_active, sort_order, ' +
        'prosthesis_materials(id, code, name, abbr, is_active, sort_order, ' +
        'has_shade, has_pontic, has_pink, price, pontic_price, pink_price)',
    )
    .order('sort_order');

  if (error || !data) return { rows: [], types: [] };

  const types = data as unknown as RawEditType[];

  const rows: ProductRow[] = types.flatMap((type) =>
    (type.prosthesis_materials ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        materialId: m.id,
        typeId: type.id,
        typeCode: type.code,
        typeName: type.name,
        typeSortOrder: type.sort_order,
        materialCode: m.code,
        materialName: m.name,
        materialAbbr: m.abbr,
        sortOrder: m.sort_order,
        hasShade: m.has_shade,
        hasPontic: m.has_pontic,
        hasPink: m.has_pink,
        price: m.price,
        ponticPrice: m.pontic_price,
        pinkPrice: m.pink_price,
        isActive: m.is_active,
      })),
  );

  return {
    rows,
    types: types.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      abbr: t.abbr,
      isActive: t.is_active,
    })),
  };
}
