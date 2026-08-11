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
