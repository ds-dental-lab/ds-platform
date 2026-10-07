// =========================================================
// 놓을 위치: src/server/repositories/clinic-price-seed.ts
//
// 새로 가입한 치과에 **수가표 기본값**을 깔아 줍니다 (사용자 지적 2026-10-07 —
// "수가표 탭에서 기본값으로 저장된 금액이 신규가입 치과 수가표에 적용이
//  안되어있네").
//
// ★★ 왜 어긋났는가 — 수가표는 **상담용 종이**였고, 실제 단가는 **제품표**에서
//   왔습니다. 센터가 종이에 48,000 을 적어 보내도, 그 치과가 가입하면
//   제품표의 50,000 으로 주문이 들어갔습니다. 종이와 청구서가 다른 셈입니다.
//
// ★ 제품표를 고치지 않습니다. 제품표를 바꾸면 **이미 거래 중인 치과**까지
//   값이 움직입니다. 새 치과의 단가 줄만 깔아 둡니다.
//
// ★ 이미 단가를 정해 둔 치과는 **건드리지 않습니다.** 승인은 한 번뿐이지만,
//   혹시 두 번 불려도 사람이 손으로 맞춘 값을 덮으면 안 됩니다.
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parsePriceSheet,
  sheetToClinicPrices,
  DEFAULT_PRICE_SHEET,
  type MaterialRef,
} from '@/server/domain/price-sheet';

export interface SeedResult {
  ok: boolean;
  /** 깔아 준 줄 수 */
  count: number;
  reason?: string;
}

/**
 * 센터가 저장해 둔 수가표를 그 치과의 단가로 깔아 둡니다.
 *
 * ★ 곁다리입니다 — 실패해도 가입 승인은 그대로입니다. 단가는 거래처
 *   화면에서 언제든 고칠 수 있습니다.
 */
export async function seedClinicPrices(
  clinicOrgId: string,
  centerOrgId: string,
): Promise<SeedResult> {
  const admin = createAdminClient();

  // 이미 정해 둔 값이 있으면 그대로 둡니다
  const { count } = await admin
    .from('clinic_product_prices')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_org_id', clinicOrgId);
  if (count && count > 0) return { ok: true, count: 0, reason: '이미 단가가 있습니다' };

  const { data: center } = await admin
    .from('organizations')
    .select('price_sheet')
    .eq('id', centerOrgId)
    .maybeSingle();

  const sheet =
    parsePriceSheet((center as { price_sheet: unknown } | null)?.price_sheet) ??
    DEFAULT_PRICE_SHEET;

  const { data: types } = await admin
    .from('prosthesis_types')
    .select('code, prosthesis_materials(id, code)');

  const materials: MaterialRef[] = ((types ?? []) as unknown as {
    code: string;
    prosthesis_materials: { id: string; code: string }[] | null;
  }[]).flatMap((t) =>
    (t.prosthesis_materials ?? []).map((m) => ({
      id: m.id,
      typeCode: t.code,
      materialCode: m.code,
    })),
  );

  const rows = sheetToClinicPrices(sheet, materials);
  if (rows.length === 0) return { ok: true, count: 0, reason: '옮길 줄이 없습니다' };

  const { error } = await admin.from('clinic_product_prices').insert(
    rows.map((r) => ({
      owner_org_id: centerOrgId,
      clinic_org_id: clinicOrgId,
      material_id: r.materialId,
      price: r.price,
    })),
  );

  if (error) return { ok: false, count: 0, reason: error.message };
  return { ok: true, count: rows.length };
}
