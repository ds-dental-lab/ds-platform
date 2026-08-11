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
import { getSession } from '@/server/policies/session';

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
  const session = await getSession();

  /*
    ★ 기공소에는 값이 빠진 목록을 줍니다 (설계서 §8.5).
      기공소는 디자인센터가 치과에 얼마에 파는지 알 이유가 없습니다.
      자기가 받는 기공원가만 알면 됩니다.

      원본 표는 정책으로 닫아 두었고, 여기서는 이름만 담은 보기를 읽습니다.
      값 칸은 null 로 옵니다 — 기공소 화면은 값을 쓰지 않습니다.
  */
  if (session?.orgType === 'lab') return getPublicCatalog(options);

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

// ---------- 값이 빠진 목록 (기공소) ----------

interface RawPublicRow {
  type_code: string;
  type_name: string;
  type_abbr: string;
  color: string;
  color_soft: string;
  needs_implant_model: boolean;
  abbr_material_only: boolean;
  type_sort_order: number;
  type_is_active: boolean;

  code: string;
  name: string;
  abbr: string;
  has_shade: boolean;
  has_pontic: boolean;
  has_pink: boolean;
  sort_order: number;
  is_active: boolean;
}

/**
 * 기공소가 읽는 제품 목록. 값 칸이 전부 null 입니다.
 *
 * ★ 이름은 알아야 합니다.
 *   주문서에 'Zir-Cr' 이 찍혀야 무엇을 만드는지 압니다.
 *   값만 빼고 나머지는 같습니다.
 */
async function getPublicCatalog(options: CatalogOptions = {}): Promise<ProsthesisCatalog> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prosthesis_products_public')
    .select('*')
    .order('type_sort_order')
    .order('sort_order');

  if (error || !data || data.length === 0) return FALLBACK_TYPES;

  const rows = data as unknown as RawPublicRow[];
  const byType = new Map<string, ProsthesisCatalog[number]>();

  for (const row of rows) {
    if (!options.includeInactive && (!row.type_is_active || !row.is_active)) continue;

    let type = byType.get(row.type_code);

    if (!type) {
      type = {
        code: row.type_code,
        name: row.type_name,
        abbr: row.type_abbr,
        needsImplantModel: row.needs_implant_model,
        abbrMaterialOnly: row.abbr_material_only,
        color: row.color,
        colorSoft: row.color_soft,
        materials: [],
      };
      byType.set(row.type_code, type);
    }

    type.materials.push({
      code: row.code,
      name: row.name,
      abbr: row.abbr,
      hasShade: row.has_shade,
      hasPontic: row.has_pontic,
      hasPink: row.has_pink,
      // ★ 값은 기공소에 주지 않습니다
      price: null,
      ponticPrice: null,
      pinkPrice: null,
    });
  }

  return [...byType.values()];
}
