// =========================================================
// 놓을 위치: src/server/repositories/implant.ts
//
// 임플란트 마스터를 읽어옵니다. (설계서 §7.4 GET /implants/catalog)
// 조회는 전 섹터에 열려 있습니다 — 치과도 주문을 넣으려면 목록이 필요합니다.
// =========================================================

import 'server-only';
import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { getSession } from '@/server/policies/session';
import type { ImplantCatalog } from '@/server/domain/implant';

/** 모든 마스터 행이 공유하는 모양 */
interface RawRow {
  code: string;
  name: string;
  sort_order: number;
  is_active?: boolean;
  deleted_at?: string | null;
}

interface RawType extends RawRow {
  implant_sizes: RawRow[] | null;
  implant_screws: RawRow[] | null;
}

interface RawMaker extends RawRow {
  implant_types: RawType[] | null;
}

const bySortOrder = (a: RawRow, b: RawRow) => a.sort_order - b.sort_order;

/** 살아 있는 행만. 지워졌거나 비활성인 것은 목록에서 뺍니다 */
function live<T extends RawRow>(rows: T[] | null): T[] {
  return (rows ?? []).filter((r) => r.is_active !== false && !r.deleted_at);
}

/**
 * 제조사 → 타입 → 사이즈·스크류를 한 번에 중첩해서 가져옵니다.
 *
 * ★ 비활성(is_active=false)은 목록에서 뺍니다.
 *   이미 주문에 쓰인 값은 삭제 대신 비활성으로 두기 때문입니다 (설계서 §4.4).
 */
/** 캐시를 비울 때 쓰는 이름. 임플란트를 고치는 액션이 이걸 부릅니다 */
export const IMPLANT_CATALOG_TAG = 'implant-catalog';

/**
 * 임플란트 목록.
 *
 * ★ **모든 화면이 같은 것을 봅니다.**
 *   implant_makers 의 RLS 는 `using (true)` 입니다 — 조직마다 다르지도,
 *   가격이 섞이지도 않습니다. 그래서 한 번 읽어 두고 함께 씁니다.
 *   열 곳 넘는 화면이 매번 다시 물어보던 것이 사라집니다.
 *
 * ★ 그래서 쿠키를 안 보는 연결을 씁니다 (createPublicClient).
 *   캐시 안에서는 쿠키를 못 읽습니다 — 여러 요청이 함께 쓰는 것이라
 *   한 사람의 쿠키를 보면 그 사람 것이 남에게 가기 때문입니다.
 *
 * ★ 임플란트를 고치면 그 자리에서 캐시를 비웁니다
 *   (actions/implant 의 revalidateTag). 그 연결이 끊기면
 *   "고쳤는데 안 바뀌네" 가 됩니다.
 */
export const getImplantCatalog = unstable_cache(
  loadImplantCatalog,
  ['implant-catalog'],
  { tags: [IMPLANT_CATALOG_TAG] },
);

async function loadImplantCatalog(): Promise<ImplantCatalog> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('implant_makers')
    .select(
      'code, name, sort_order, ' +
        'implant_types(code, name, sort_order, is_active, deleted_at, ' +
        'implant_sizes(code, name, sort_order, is_active, deleted_at), ' +
        'implant_screws(code, name, sort_order, is_active, deleted_at))',
    )
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order');

  if (error || !data) return [];

  return (data as unknown as RawMaker[]).sort(bySortOrder).map((maker) => ({
    code: maker.code,
    name: maker.name,
    types: live(maker.implant_types)
      .sort(bySortOrder)
      .map((type) => ({
        code: type.code,
        name: type.name,
        sizes: live(type.implant_sizes)
          .sort(bySortOrder)
          .map(({ code, name }) => ({ code, name })),
        screws: live(type.implant_screws)
          .sort(bySortOrder)
          .map(({ code, name }) => ({ code, name })),
      })),
  }));
}

// ---------- 즐겨찾기 ----------

export interface ImplantFavorite {
  id: string;
  label: string;
  /** 디자인센터가 배포한 것인가. 치과는 이것을 뺄 수 없습니다 */
  pushed: boolean;
  /** 피커에 그대로 집어넣을 수 있게 코드로 돌려줍니다 */
  makerCode: string;
  typeCode: string;
  sizeCode: string | null;
  screwCode: string | null;
}

interface RawFavorite {
  id: string;
  label: string;
  source: 'clinic' | 'design_push';
  maker: { code: string } | null;
  type: { code: string } | null;
  size: { code: string } | null;
  screw: { code: string } | null;
}

/**
 * 즐겨찾기 목록.
 *
 * @param clinicOrgId 비우면 내 조직 것. 디자인센터가 거래 치과 것을 볼 때만 넘깁니다.
 *
 * RLS 가 "본인 치과 + 파트너 디자인센터"로 막아 주므로,
 * 남의 치과 id 를 넣어도 빈 배열이 돌아옵니다.
 */
export async function listImplantFavorites(clinicOrgId?: string): Promise<ImplantFavorite[]> {
  const session = await getSession();
  const targetOrgId = clinicOrgId ?? session?.orgId;
  if (!targetOrgId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clinic_implant_favorites')
    .select(
      'id, label, source, ' +
        'maker:implant_makers(code), type:implant_types(code), ' +
        'size:implant_sizes(code), screw:implant_screws(code)',
    )
    .eq('clinic_org_id', targetOrgId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as unknown as RawFavorite[])
    // 마스터가 지워지면 조합이 성립하지 않으므로 목록에서 뺍니다
    .filter((row) => row.maker && row.type)
    .map((row) => ({
      id: row.id,
      label: row.label,
      pushed: row.source === 'design_push',
      makerCode: row.maker!.code,
      typeCode: row.type!.code,
      sizeCode: row.size?.code ?? null,
      screwCode: row.screw?.code ?? null,
    }));
}
