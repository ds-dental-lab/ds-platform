// =========================================================
// 놓을 위치: src/server/actions/product.ts
//
// 제품 등록·수정. 디자인센터만 할 수 있습니다.
// 실제 차단은 RLS 가 합니다 (prosthesis_type_write / _material_write).
//
// ★ 지우는 길은 두지 않습니다.
//   지난 주문이 이 제품을 가리키고 있습니다. 행을 없애면 그 주문의
//   보철 이름이 사라집니다. 안 팔 제품은 '판매중지' 로 내립니다.
//
// ★ 코드(code)는 만들 때 자동으로 짓고, 그 뒤로는 못 바꿉니다.
//   order_items.type_code / material_code 가 이 값을 가리킵니다.
//   사람이 직접 적게 하면 오타와 중복이 나고, 고치면 지난 주문이 끊깁니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export type ProductResult = { ok: true } | { ok: false; error: string };

/** 화면이 보내는 제품 한 줄 */
export interface ProductInput {
  typeId: string;
  name: string;
  abbr: string;
  hasShade: boolean;
  hasPontic: boolean;
  hasPink: boolean;
  price: number | null;
  ponticPrice: number | null;
  pinkPrice: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface TypeInput {
  name: string;
  abbr: string;
  color: string;
  needsImplantModel: boolean;
  abbrMaterialOnly: boolean;
  sortOrder: number;
}

/**
 * 이름에서 코드를 짓습니다.
 *
 * ★ 한글은 코드로 못 씁니다. 영문·숫자만 남기고, 남는 게 없으면
 *   시각으로 채웁니다 — 사람이 볼 값이 아니라 겹치지만 않으면 됩니다.
 */
function toCode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || `p${Date.now().toString(36)}`;
}

function refresh() {
  revalidatePath('/design/products');
  // 주문등록 목록이 여기서 나옵니다
  revalidatePath('/clinic/orders/new');
  revalidatePath('/clinic/orders', 'layout');
}

async function requireDesign() {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return null;
  return session;
}

// ---------- 종류 ----------

export async function submitCreateType(input: TypeInput): Promise<ProductResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 제품을 만들 수 있습니다' };

  if (!input.name.trim()) return { ok: false, error: '종류 이름을 넣어 주세요' };
  if (!input.abbr.trim()) return { ok: false, error: '약칭을 넣어 주세요' };

  const supabase = await createClient();

  const { error } = await supabase.from('prosthesis_types').insert({
    owner_org_id: session.orgId,
    code: toCode(input.name),
    name: input.name.trim(),
    abbr: input.abbr.trim(),
    color: input.color,
    needs_implant_model: input.needsImplantModel,
    abbr_material_only: input.abbrMaterialOnly,
    sort_order: input.sortOrder,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '같은 이름의 종류가 이미 있습니다'
          : `만들지 못했습니다: ${error.message}`,
    };
  }

  refresh();
  return { ok: true };
}

/** 종류 수정 — 코드는 빼고 나머지만 */
export async function submitUpdateType(
  typeId: string,
  input: Omit<TypeInput, 'sortOrder'> & { sortOrder?: number; isActive?: boolean },
): Promise<ProductResult> {
  if (!input.name.trim()) return { ok: false, error: '종류 이름을 넣어 주세요' };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prosthesis_types')
    .update({
      name: input.name.trim(),
      abbr: input.abbr.trim(),
      color: input.color,
      needs_implant_model: input.needsImplantModel,
      abbr_material_only: input.abbrMaterialOnly,
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq('id', typeId)
    .select('id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '고칠 수 있는 종류가 아닙니다' };

  refresh();
  return { ok: true };
}

// ---------- 제품 (종류 × 재료) ----------

export async function submitCreateProduct(input: ProductInput): Promise<ProductResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 제품을 만들 수 있습니다' };

  const problem = checkProduct(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  const { error } = await supabase.from('prosthesis_materials').insert({
    type_id: input.typeId,
    code: toCode(input.name),
    name: input.name.trim(),
    abbr: input.abbr.trim(),
    has_shade: input.hasShade,
    has_pontic: input.hasPontic,
    has_pink: input.hasPink,
    price: input.price,
    pontic_price: input.hasPontic ? input.ponticPrice : null,
    pink_price: input.hasPink ? input.pinkPrice : null,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '이 종류에 같은 이름의 재료가 이미 있습니다'
          : `만들지 못했습니다: ${error.message}`,
    };
  }

  refresh();
  return { ok: true };
}

export async function submitUpdateProduct(
  materialId: string,
  input: ProductInput,
): Promise<ProductResult> {
  const problem = checkProduct(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  // ★ code 와 type_id 는 건드리지 않습니다.
  //   지난 주문이 그 짝을 가리키고 있어, 옮기면 이름을 잃습니다.
  const { data, error } = await supabase
    .from('prosthesis_materials')
    .update({
      name: input.name.trim(),
      abbr: input.abbr.trim(),
      has_shade: input.hasShade,
      has_pontic: input.hasPontic,
      has_pink: input.hasPink,
      price: input.price,
      // 못 쓰는 항목의 값은 지웁니다 — '-' 와 '0' 은 다릅니다
      pontic_price: input.hasPontic ? input.ponticPrice : null,
      pink_price: input.hasPink ? input.pinkPrice : null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .eq('id', materialId)
    .select('id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '고칠 수 있는 제품이 아닙니다' };

  refresh();
  return { ok: true };
}

/** 판매중 ↔ 판매중지. 표에서 바로 누릅니다 */
export async function submitToggleProduct(
  materialId: string,
  isActive: boolean,
): Promise<ProductResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prosthesis_materials')
    .update({ is_active: isActive })
    .eq('id', materialId)
    .select('id');

  if (error) return { ok: false, error: `바꾸지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '고칠 수 있는 제품이 아닙니다' };

  refresh();
  return { ok: true };
}

function checkProduct(input: ProductInput): string | null {
  if (!input.typeId) return '보철물 종류를 골라 주세요';
  if (!input.name.trim()) return '재료 이름을 넣어 주세요';
  if (!input.abbr.trim()) return '약칭을 넣어 주세요';

  for (const [label, value] of [
    ['판매 가격', input.price],
    ['가격(Pontic)', input.ponticPrice],
    ['가격(핑크 포셀린)', input.pinkPrice],
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return `${label} 은 0 이상이어야 합니다`;
    }
  }

  return null;
}
