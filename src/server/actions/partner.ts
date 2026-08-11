// =========================================================
// 놓을 위치: src/server/actions/partner.ts
//
// 거래처 등록·수정과 거래처별 단가 저장. 디자인센터만 합니다.
// 실제 차단은 RLS 와 create_partner_org() 안의 검사입니다.
//
// ★ 지우는 길은 두지 않습니다.
//   거래처를 지우면 그 치과의 지난 주문과 정산이 주인을 잃습니다.
//   끊을 때는 '거래중지' 로 내립니다 — 목록에는 남고 새 주문만 막힙니다.
//
// ★ 제품의 성질(폰틱·핑크)은 화면 말을 믿지 않고 표에서 다시 읽습니다.
//   화면이 보낸 값을 그대로 넣으면, 폰틱이 안 되는 제품에 폰틱 단가가
//   남았다가 나중에 그 제품이 폰틱을 켜는 순간 살아납니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { planSave, type PriceSet } from '@/server/domain/pricing';
import type { InvoiceMethod, PartnerType } from '@/server/repositories/partner';

export type PartnerResult = { ok: true } | { ok: false; error: string };

export interface PartnerInput {
  name: string;
  ceoName: string;
  tel: string;
  bizNo: string;
  address: string;

  invoiceMethod: InvoiceMethod;
  invoiceEmail: string;
  fax: string;
  taxEmail: string;
  closingDay: number;

  isActive: boolean;
}

export interface CreatePartnerInput extends PartnerInput {
  orgType: PartnerType;
}

function refresh(orgId?: string) {
  revalidatePath('/design/users');
  if (orgId) revalidatePath(`/design/users/${orgId}`);
  // 주문등록·배정 목록이 거래처에서 나옵니다
  revalidatePath('/design/orders', 'layout');
}

async function requireDesign() {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return null;
  return session;
}

/** 빈 칸은 null 로 넣습니다. '' 를 넣어 두면 '값이 있다' 로 보입니다 */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function checkPartner(input: PartnerInput): string | null {
  if (!input.name.trim()) return '상호를 넣어 주세요';

  if (!Number.isInteger(input.closingDay) || input.closingDay < 1 || input.closingDay > 28) {
    return '정산 기준일은 1일에서 28일 사이여야 합니다';
  }

  // 청구서를 이메일로 받는다면서 주소가 없으면 보낼 곳이 없습니다
  if (input.invoiceMethod !== 'fax' && !input.invoiceEmail.trim()) {
    return '청구서 수신 이메일을 넣어 주세요';
  }
  if (input.invoiceMethod !== 'email' && !input.fax.trim()) {
    return '팩스 번호를 넣어 주세요';
  }

  return null;
}

// ---------- 거래처 ----------

export async function submitCreatePartner(input: CreatePartnerInput): Promise<PartnerResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 거래처를 등록할 수 있습니다' };

  const problem = checkPartner(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  // 조직과 거래관계를 한 번에 세웁니다 (create_partner_org)
  const { error } = await supabase.rpc('create_partner_org', {
    p_org_type: input.orgType,
    p_name: input.name.trim(),
    p_ceo_name: orNull(input.ceoName),
    p_tel: orNull(input.tel),
    p_biz_no: orNull(input.bizNo),
    p_address: orNull(input.address),
    p_invoice_method: input.invoiceMethod,
    p_invoice_email: orNull(input.invoiceEmail),
    p_fax: orNull(input.fax),
    p_tax_email: orNull(input.taxEmail),
    p_closing_day: input.closingDay,
    p_active: input.isActive,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '같은 사업자등록번호가 이미 있습니다'
          : `등록하지 못했습니다: ${error.message}`,
    };
  }

  refresh();
  return { ok: true };
}

export async function submitUpdatePartner(
  orgId: string,
  input: PartnerInput,
): Promise<PartnerResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 거래처를 고칠 수 있습니다' };

  const problem = checkPartner(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  // ★ org_type 과 code 는 건드리지 않습니다.
  //   주문·정산이 이 조직을 치과로 알고 붙어 있습니다.
  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: input.name.trim(),
      ceo_name: orNull(input.ceoName),
      tel: orNull(input.tel),
      biz_no: orNull(input.bizNo),
      address: orNull(input.address),
      invoice_method: input.invoiceMethod,
      invoice_email: orNull(input.invoiceEmail),
      fax: orNull(input.fax),
      tax_email: orNull(input.taxEmail),
      closing_day: input.closingDay,
      status: input.isActive ? 'active' : 'suspended',
    })
    .eq('id', orgId)
    .select('id');

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '같은 사업자등록번호가 이미 있습니다'
          : `저장하지 못했습니다: ${error.message}`,
    };
  }

  // RLS 는 오류가 아니라 0행으로 막습니다
  if (!data || data.length === 0) return { ok: false, error: '고칠 수 있는 거래처가 아닙니다' };

  refresh(orgId);
  return { ok: true };
}

/** 거래중 ↔ 거래중지. 목록에서 바로 누릅니다 */
export async function submitTogglePartner(
  orgId: string,
  isActive: boolean,
): Promise<PartnerResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 바꿀 수 있습니다' };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organizations')
    .update({ status: isActive ? 'active' : 'suspended' })
    .eq('id', orgId)
    .select('id');

  if (error) return { ok: false, error: `바꾸지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '고칠 수 있는 거래처가 아닙니다' };

  refresh(orgId);
  return { ok: true };
}

// ---------- 거래처별 단가 ----------

export interface PriceEdit {
  materialId: string;
  price: number | null;
  ponticPrice: number | null;
  pinkPrice: number | null;
}

/** 표마다 칸 이름이 다릅니다 */
const COLUMNS = {
  clinic: {
    table: 'clinic_product_prices',
    org: 'clinic_org_id',
    price: 'price',
    pontic: 'pontic_price',
    pink: 'pink_price',
  },
  lab: {
    table: 'lab_product_costs',
    org: 'lab_org_id',
    price: 'lab_cost',
    pontic: 'pontic_cost',
    pink: 'pink_cost',
  },
} as const;

/**
 * 거래처 단가 저장.
 *
 * ★ 칸을 비우면 줄을 지웁니다 = 제품 기본가로 돌아갑니다.
 *   0 을 넣으면 줄이 남습니다 = 이 거래처에는 무료입니다.
 *   판단은 domain/pricing 의 planSave 가 합니다.
 */
export async function submitSavePartnerPrices(
  orgId: string,
  edits: PriceEdit[],
): Promise<PartnerResult> {
  const session = await requireDesign();
  if (!session) return { ok: false, error: '디자인센터만 단가를 정할 수 있습니다' };
  if (edits.length === 0) return { ok: true };

  const supabase = await createClient();

  // 어느 표에 넣을지는 거래처 종류가 정합니다
  const { data: org } = await supabase
    .from('organizations')
    .select('org_type')
    .eq('id', orgId)
    .maybeSingle();

  const orgType = (org as { org_type: string } | null)?.org_type;
  if (orgType !== 'clinic' && orgType !== 'lab') {
    return { ok: false, error: '단가를 정할 수 있는 거래처가 아닙니다' };
  }

  const col = COLUMNS[orgType];
  const ids = edits.map((e) => e.materialId);

  // ★ 제품 성질과 지금 저장된 값을 표에서 다시 읽습니다. 화면 말을 믿지 않습니다
  const [products, saved] = await Promise.all([
    supabase
      .from('prosthesis_materials')
      .select('id, has_pontic, has_pink')
      .in('id', ids),
    supabase
      .from(col.table)
      .select(`material_id, ${col.price}, ${col.pontic}, ${col.pink}`)
      .eq(col.org, orgId)
      .in('material_id', ids),
  ]);

  if (products.error) return { ok: false, error: `제품을 읽지 못했습니다: ${products.error.message}` };

  const flags = new Map(
    ((products.data ?? []) as { id: string; has_pontic: boolean; has_pink: boolean }[]).map((p) => [
      p.id,
      { hasPontic: p.has_pontic, hasPink: p.has_pink },
    ]),
  );

  const current = new Map<string, PriceSet>(
    ((saved.data ?? []) as Record<string, unknown>[]).map((row) => [
      row.material_id as string,
      {
        price: row[col.price] as number | null,
        ponticPrice: row[col.pontic] as number | null,
        pinkPrice: row[col.pink] as number | null,
      },
    ]),
  );

  const upserts: Record<string, unknown>[] = [];
  const deletes: string[] = [];

  for (const edit of edits) {
    const product = flags.get(edit.materialId);
    if (!product) continue; // 없는 제품은 조용히 건너뜁니다

    const plan = planSave(product, current.get(edit.materialId) ?? null, {
      price: edit.price,
      ponticPrice: edit.ponticPrice,
      pinkPrice: edit.pinkPrice,
    });

    if (plan.kind === 'delete') {
      deletes.push(edit.materialId);
    } else if (plan.kind === 'upsert') {
      upserts.push({
        owner_org_id: session.orgId,
        [col.org]: orgId,
        material_id: edit.materialId,
        [col.price]: plan.values.price,
        [col.pontic]: plan.values.ponticPrice,
        [col.pink]: plan.values.pinkPrice,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (deletes.length > 0) {
    const { error } = await supabase
      .from(col.table)
      .delete()
      .eq(col.org, orgId)
      .in('material_id', deletes);

    if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from(col.table)
      .upsert(upserts, { onConflict: `${col.org},material_id` });

    if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  }

  refresh(orgId);
  return { ok: true };
}
