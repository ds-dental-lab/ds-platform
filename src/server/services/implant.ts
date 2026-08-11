// =========================================================
// 놓을 위치: src/server/services/implant.ts
//
// 임플란트 마스터 편집. (설계서 §7.4, §8.3 — 디자인센터만)
//
// ★ 삭제는 하지 않습니다.
//   이미 주문에 쓰인 값을 지우면 그 주문의 표기가 무너집니다.
//   대신 is_active=false 로 내려 목록에서만 빼고, 기록은 남깁니다. (§4.4)
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export type ImplantNode = 'maker' | 'type' | 'size' | 'screw';

export type ImplantResult = { ok: true } | { ok: false; error: string };

const TABLE: Record<ImplantNode, string> = {
  maker: 'implant_makers',
  type: 'implant_types',
  size: 'implant_sizes',
  screw: 'implant_screws',
};

/** 자식이 부모를 가리키는 컬럼. 제조사는 부모가 없습니다 */
const PARENT_COLUMN: Record<ImplantNode, string | null> = {
  maker: null,
  type: 'maker_id',
  size: 'type_id',
  screw: 'type_id',
};

/** 부모가 어느 표에 있는지 */
const PARENT_NODE: Record<ImplantNode, ImplantNode | null> = {
  maker: null,
  type: 'maker',
  size: 'type',
  screw: 'type',
};

const NODE_LABEL: Record<ImplantNode, string> = {
  maker: '제조사',
  type: '타입',
  size: '사이즈',
  screw: '스크류',
};

async function requireDesignCenter(): Promise<string | null> {
  const session = await getSession();
  if (session?.orgType !== 'design_center') {
    return '디자인센터만 임플란트 마스터를 편집할 수 있습니다';
  }
  return null;
}

/**
 * 이름에서 코드를 만듭니다.
 *   Super Line 2 → SUPER_LINE_2
 * 부모가 있으면 부모 코드를 앞에 붙여 계보가 코드에 드러나게 합니다.
 */
function slugify(name: string): string {
  return (
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'ITEM'
  );
}

/** 이미 쓰는 코드면 뒤에 번호를 붙입니다 */
async function uniqueCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  node: ImplantNode,
  base: string,
): Promise<string> {
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}_${n + 1}`;
    const { data } = await supabase
      .from(TABLE[node])
      .select('id')
      .eq('code', candidate)
      .maybeSingle();

    if (!data) return candidate;
  }
  return `${base}_${Date.now()}`;
}

export async function addImplantNode(
  node: ImplantNode,
  name: string,
  parentCode?: string,
): Promise<ImplantResult> {
  const denied = await requireDesignCenter();
  if (denied) return { ok: false, error: denied };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: `${NODE_LABEL[node]} 이름을 입력해 주세요` };

  const supabase = await createClient();
  const parentNode = PARENT_NODE[node];
  const parentColumn = PARENT_COLUMN[node];

  const row: Record<string, unknown> = { name: trimmed };

  if (parentNode && parentColumn) {
    if (!parentCode) {
      return { ok: false, error: `${NODE_LABEL[parentNode]} 를 먼저 골라 주세요` };
    }

    const { data: parent } = await supabase
      .from(TABLE[parentNode])
      .select('id, code')
      .eq('code', parentCode)
      .maybeSingle();

    if (!parent) return { ok: false, error: `${NODE_LABEL[parentNode]} 를 찾을 수 없습니다` };

    row[parentColumn] = parent.id;
    row.code = await uniqueCode(supabase, node, `${parent.code}_${slugify(trimmed)}`);
  } else {
    row.code = await uniqueCode(supabase, node, slugify(trimmed));
  }

  const { error } = await supabase.from(TABLE[node]).insert(row);

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `같은 이름의 ${NODE_LABEL[node]} 가 이미 있습니다`
          : `저장하지 못했습니다: ${error.message}`,
    };
  }

  return { ok: true };
}

export async function renameImplantNode(
  node: ImplantNode,
  code: string,
  name: string,
): Promise<ImplantResult> {
  const denied = await requireDesignCenter();
  if (denied) return { ok: false, error: denied };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: '이름을 입력해 주세요' };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE[node])
    .update({ name: trimmed })
    .eq('code', code);

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `같은 이름의 ${NODE_LABEL[node]} 가 이미 있습니다`
          : `수정하지 못했습니다: ${error.message}`,
    };
  }

  return { ok: true };
}

/**
 * 목록에서 내립니다. 행은 남습니다.
 * 제조사·타입을 내리면 그 아래도 함께 내립니다 (설계서 §4.4 상위 삭제 시 하위 처리).
 */
export async function deactivateImplantNode(
  node: ImplantNode,
  code: string,
): Promise<ImplantResult> {
  const denied = await requireDesignCenter();
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();

  const { data: target } = await supabase
    .from(TABLE[node])
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (!target) return { ok: false, error: `${NODE_LABEL[node]} 를 찾을 수 없습니다` };

  if (node === 'maker') {
    const { data: types } = await supabase
      .from('implant_types')
      .select('id')
      .eq('maker_id', target.id);

    for (const type of types ?? []) {
      await deactivateTypeChildren(supabase, type.id);
    }

    await supabase.from('implant_types').update({ is_active: false }).eq('maker_id', target.id);
  }

  if (node === 'type') {
    await deactivateTypeChildren(supabase, target.id);
  }

  const { error } = await supabase
    .from(TABLE[node])
    .update({ is_active: false })
    .eq('id', target.id);

  if (error) return { ok: false, error: `내리지 못했습니다: ${error.message}` };

  return { ok: true };
}

async function deactivateTypeChildren(
  supabase: Awaited<ReturnType<typeof createClient>>,
  typeId: string,
): Promise<void> {
  await supabase.from('implant_sizes').update({ is_active: false }).eq('type_id', typeId);
  await supabase.from('implant_screws').update({ is_active: false }).eq('type_id', typeId);
}

// =========================================================
// 즐겨찾기 (설계서 §4.4 clinic_implant_favorites)
//
// 화면은 코드로 말하고 표는 uuid 로 저장합니다.
// 그 변환과 표시 이름 만들기를 여기서 합니다.
// =========================================================

export interface FavoriteSelection {
  makerCode: string;
  typeCode: string;
  sizeCode?: string | null;
  screwCode?: string | null;
}

/** 코드 하나를 id + 이름으로 바꿉니다. 없으면 null */
async function resolve(
  supabase: Awaited<ReturnType<typeof createClient>>,
  node: ImplantNode,
  code: string | null | undefined,
): Promise<{ id: string; name: string } | null> {
  if (!code) return null;

  const { data } = await supabase
    .from(TABLE[node])
    .select('id, name')
    .eq('code', code)
    .maybeSingle();

  return data ?? null;
}

/**
 * 즐겨찾기에 담습니다.
 *
 * @param clinicOrgId 디자인센터가 배포할 때만 넘깁니다. 비우면 내 치과.
 *
 * ★ 누가 담는지는 화면이 아니라 세션으로 정합니다.
 *   치과는 'clinic', 디자인센터는 'design_push' 로 고정됩니다.
 *   RLS 에도 같은 조건이 걸려 있어 두 겹으로 막힙니다.
 */
export async function addImplantFavorite(
  selection: FavoriteSelection,
  clinicOrgId?: string,
): Promise<ImplantResult> {
  const session = await getSession();
  if (!session?.orgId || !session.orgType) {
    return { ok: false, error: '로그인이 필요합니다' };
  }

  const isDesign = session.orgType === 'design_center';
  if (!isDesign && session.orgType !== 'clinic') {
    return { ok: false, error: '즐겨찾기를 담을 수 없는 계정입니다' };
  }

  const targetClinic = isDesign ? clinicOrgId : session.orgId;
  if (!targetClinic) return { ok: false, error: '배포할 치과를 골라 주세요' };

  const supabase = await createClient();

  const maker = await resolve(supabase, 'maker', selection.makerCode);
  const type = await resolve(supabase, 'type', selection.typeCode);
  if (!maker || !type) {
    return { ok: false, error: '제조사와 타입을 골라 주세요' };
  }

  const size = await resolve(supabase, 'size', selection.sizeCode);
  const screw = await resolve(supabase, 'screw', selection.screwCode);

  const label = [maker.name, type.name, size?.name, screw?.name].filter(Boolean).join(' ');

  const { error } = await supabase.from('clinic_implant_favorites').insert({
    clinic_org_id: targetClinic,
    maker_id: maker.id,
    type_id: type.id,
    size_id: size?.id ?? null,
    screw_id: screw?.id ?? null,
    label,
    source: isDesign ? 'design_push' : 'clinic',
    pushed_by_org_id: isDesign ? session.orgId : null,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '이미 담겨 있는 조합입니다'
          : `담지 못했습니다: ${error.message}`,
    };
  }

  return { ok: true };
}

/**
 * 즐겨찾기에서 뺍니다.
 *
 * 무엇을 뺄 수 있는지는 RLS 가 정합니다 —
 * 치과는 자기가 담은 것만, 디자인센터는 자기가 배포한 것만.
 * 그래서 여기서는 "지워진 행이 없으면 권한이 없는 것"으로 봅니다.
 */
export async function removeImplantFavorite(favoriteId: string): Promise<ImplantResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clinic_implant_favorites')
    .delete()
    .eq('id', favoriteId)
    .select('id');

  if (error) return { ok: false, error: `빼지 못했습니다: ${error.message}` };

  if (!data || data.length === 0) {
    return { ok: false, error: '디자인센터가 배포한 항목은 뺄 수 없습니다' };
  }

  return { ok: true };
}
