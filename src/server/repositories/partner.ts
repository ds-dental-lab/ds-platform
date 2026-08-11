// =========================================================
// 놓을 위치: src/server/repositories/partner.ts
//
// 거래처(치과 · 기공소) 목록과 거래처별 단가. 디자인센터 사용자탭이 씁니다.
//
// ★ 거래가 끊긴 곳도 목록에 남깁니다.
//   한 번 '거래중지' 로 내린 치과를 다시 열 길이 있어야 합니다.
//   RLS 의 is_my_partner_any_status() 가 그 범위를 잡습니다.
//
// ★ 기공원가는 치과에 보이지 않습니다 (설계서 §8.5).
//   이 파일은 디자인센터 화면만 부르고, 표의 정책이 한 번 더 막습니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { EMPTY_PRICES, type PriceSet } from '@/server/domain/pricing';

export type PartnerType = 'clinic' | 'lab';
export type InvoiceMethod = 'all' | 'email' | 'fax';

export interface PartnerRow {
  id: string;
  orgType: PartnerType;
  code: string | null;
  name: string;
  ceoName: string | null;
  tel: string | null;
  bizNo: string | null;
  address: string | null;
  /** 거래중인가. organizations.status 로 봅니다 */
  isActive: boolean;

  invoiceMethod: InvoiceMethod;
  invoiceEmail: string | null;
  fax: string | null;
  taxEmail: string | null;
  closingDay: number;

  /** 기본가를 덮어쓴 제품 수. 0 이면 전부 기본가입니다 */
  overrideCount: number;
}

interface RawOrg {
  id: string;
  org_type: string;
  code: string | null;
  name: string;
  ceo_name: string | null;
  tel: string | null;
  biz_no: string | null;
  address: string | null;
  status: string;
  invoice_method: InvoiceMethod;
  invoice_email: string | null;
  fax: string | null;
  tax_email: string | null;
  closing_day: number;
}

const ORG_COLUMNS =
  'id, org_type, code, name, ceo_name, tel, biz_no, address, status, ' +
  'invoice_method, invoice_email, fax, tax_email, closing_day';

function toPartner(raw: RawOrg, overrideCount: number): PartnerRow {
  return {
    id: raw.id,
    orgType: raw.org_type as PartnerType,
    code: raw.code,
    name: raw.name,
    ceoName: raw.ceo_name,
    tel: raw.tel,
    bizNo: raw.biz_no,
    address: raw.address,
    isActive: raw.status === 'active',
    invoiceMethod: raw.invoice_method,
    invoiceEmail: raw.invoice_email,
    fax: raw.fax,
    taxEmail: raw.tax_email,
    closingDay: raw.closing_day,
    overrideCount,
  };
}

/**
 * 내 거래처 전부. 치과와 기공소가 섞여 옵니다.
 *
 * ★ 자기 조직은 뺍니다. 자사 기공(디자인센터가 겸함)은 거래처가 아닙니다 —
 *   자기에게 지급하지 않으니 기공원가를 매길 자리도 없습니다.
 */
export async function listPartners(): Promise<PartnerRow[]> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return [];

  const supabase = await createClient();

  const [orgs, clinicPrices, labCosts] = await Promise.all([
    supabase
      .from('organizations')
      .select(ORG_COLUMNS)
      .in('org_type', ['clinic', 'lab'])
      .is('deleted_at', null)
      .neq('id', session.orgId)
      .order('org_type')
      .order('name'),
    supabase.from('clinic_product_prices').select('clinic_org_id'),
    supabase.from('lab_product_costs').select('lab_org_id'),
  ]);

  if (orgs.error || !orgs.data) return [];

  // 거래처마다 단가를 몇 개 따로 넣었는지 세어 둡니다
  const counts = new Map<string, number>();

  for (const row of (clinicPrices.data ?? []) as { clinic_org_id: string }[]) {
    counts.set(row.clinic_org_id, (counts.get(row.clinic_org_id) ?? 0) + 1);
  }
  for (const row of (labCosts.data ?? []) as { lab_org_id: string }[]) {
    counts.set(row.lab_org_id, (counts.get(row.lab_org_id) ?? 0) + 1);
  }

  return (orgs.data as unknown as RawOrg[]).map((raw) =>
    toPartner(raw, counts.get(raw.id) ?? 0),
  );
}

/** 거래처 하나. 없거나 내 거래처가 아니면 null (RLS 가 0행으로 막습니다) */
export async function getPartner(orgId: string): Promise<PartnerRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .select(ORG_COLUMNS)
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  return toPartner(data as unknown as RawOrg, 0);
}

// ---------- 거래처별 단가 ----------

/**
 * 단가 화면의 한 줄. 제품 하나에 기본가와 이 거래처 값이 나란히 옵니다.
 */
export interface PartnerPriceRow {
  materialId: string;

  typeName: string;
  typeSortOrder: number;
  materialName: string;
  materialAbbr: string;
  sortOrder: number;

  hasPontic: boolean;
  hasPink: boolean;
  isActive: boolean;

  /** 제품탭이 정한 값 */
  base: PriceSet;
  /** 이 거래처만 다르게 준 값. 없으면 null */
  override: PriceSet | null;
}

interface RawPriceType {
  name: string;
  sort_order: number;
  prosthesis_materials:
    | {
        id: string;
        name: string;
        abbr: string;
        sort_order: number;
        is_active: boolean;
        has_pontic: boolean;
        has_pink: boolean;
        price: number | null;
        pontic_price: number | null;
        pink_price: number | null;
      }[]
    | null;
}

/**
 * 거래처 하나의 단가표.
 *
 * ★ 판매중지된 제품도 함께 줍니다.
 *   지난 주문이 그 제품을 가리키고 있고, 다시 켤 때 값이 남아 있어야 합니다.
 *   화면에서 흐리게 찍어 구분합니다.
 */
export async function getPartnerPrices(partner: PartnerRow): Promise<PartnerPriceRow[]> {
  const supabase = await createClient();

  const isClinic = partner.orgType === 'clinic';

  const [products, overrides] = await Promise.all([
    supabase
      .from('prosthesis_types')
      .select(
        'name, sort_order, ' +
          'prosthesis_materials(id, name, abbr, sort_order, is_active, ' +
          'has_pontic, has_pink, price, pontic_price, pink_price)',
      )
      .order('sort_order'),
    isClinic
      ? supabase
          .from('clinic_product_prices')
          .select('material_id, price, pontic_price, pink_price')
          .eq('clinic_org_id', partner.id)
      : supabase
          .from('lab_product_costs')
          .select('material_id, lab_cost, pontic_cost, pink_cost')
          .eq('lab_org_id', partner.id),
  ]);

  if (products.error || !products.data) return [];

  // 표마다 칸 이름이 다릅니다. 화면이 알 필요 없게 여기서 한 모양으로 폅니다
  const byMaterial = new Map<string, PriceSet>();

  for (const row of (overrides.data ?? []) as Record<string, unknown>[]) {
    byMaterial.set(row.material_id as string, {
      price: (isClinic ? row.price : row.lab_cost) as number | null,
      ponticPrice: (isClinic ? row.pontic_price : row.pontic_cost) as number | null,
      pinkPrice: (isClinic ? row.pink_price : row.pink_cost) as number | null,
    });
  }

  return (products.data as unknown as RawPriceType[]).flatMap((type) =>
    (type.prosthesis_materials ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        materialId: m.id,
        typeName: type.name,
        typeSortOrder: type.sort_order,
        materialName: m.name,
        materialAbbr: m.abbr,
        sortOrder: m.sort_order,
        hasPontic: m.has_pontic,
        hasPink: m.has_pink,
        isActive: m.is_active,
        base: {
          price: m.price,
          ponticPrice: m.pontic_price,
          pinkPrice: m.pink_price,
        },
        override: byMaterial.get(m.id) ?? (null as PriceSet | null),
      })),
  );
}

/** 아직 아무 값도 없는 거래처를 위한 빈 칸 */
export const NO_OVERRIDE: PriceSet = EMPTY_PRICES;
