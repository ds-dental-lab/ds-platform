// =========================================================
// 놓을 위치: src/server/repositories/price-sheet.ts
//
// 수가표 기본값 — 센터가 저장한 것이 있으면 그것, 없으면 코드의 기본값.
// (사용자 요청 2026-09-07)
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { DEFAULT_PRICE_SHEET, parsePriceSheet, type PriceRow } from '@/server/domain/price-sheet';

export async function getPriceSheetDefaults(): Promise<PriceRow[]> {
  const session = await getSession();
  if (!session?.orgId) return DEFAULT_PRICE_SHEET;

  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('price_sheet')
    .eq('id', session.orgId)
    .maybeSingle();

  // ★ DB 값을 믿지 않고 다시 봅니다 — 모양이 어긋나면 기본값으로
  return parsePriceSheet((data as { price_sheet: unknown } | null)?.price_sheet) ?? DEFAULT_PRICE_SHEET;
}
