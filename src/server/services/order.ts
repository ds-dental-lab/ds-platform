// =========================================================
// 놓을 위치: src/server/services/order.ts
//
// 주문 저장. (설계서 §5.2 서비스 계층)
//
// ★ 화면에서 온 데이터를 그대로 믿지 않습니다.
//   브라우저는 조작할 수 있으므로 저장 직전에 도메인 규칙으로 다시 검사합니다.
//   (설계서 §5.3 결정 2 — 2중 검사)
// =========================================================

import { createClient } from '@/lib/supabase/server';
import { isValidTooth } from '@/server/domain/tooth';
import { isValidCombination, requiresImplantModel } from '@/server/domain/prosthesis';
import { isAllowedPair, MAX_PER_TOOTH, type Placement } from '@/server/domain/duplicate';
import { computeBridges, type ToothPlacement } from '@/server/domain/bridge';
import { isValidShade } from '@/server/domain/shade';

// ---------- 입력 모양 ----------

export interface OrderItemInput {
  tooth: number;
  typeCode: string;
  materialCode: string;
  isPontic?: boolean;
  shadeSystem?: string | null;
  shadeCervical?: string | null;
  shadeIncisal?: string | null;
  implantManufacturer?: string | null;
  implantType?: string | null;
  implantSize?: string | null;
  implantScrew?: string | null;
  implantOption?: string | null;
}

export interface CreateOrderInput {
  patientId?: string | null;
  patientLabel: string;
  orderType?: 'modelless' | 'with_model' | 'model_only' | 'repair';
  dueDate: string;          // YYYY-MM-DD
  notes?: string;
  items: OrderItemInput[];
  severedKeys?: string[];   // 사용자가 끊어 둔 브릿지 연결
}

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string };

// ---------- 검증 ----------

/**
 * 저장해도 되는 주문인지 확인합니다.
 * 문제가 있으면 첫 번째 이유를 돌려줍니다.
 */
export function validateOrder(input: CreateOrderInput): string | null {
  if (!input.patientLabel?.trim()) return '환자를 선택해 주세요';
  if (!input.dueDate) return '요청시한을 입력해 주세요';
  if (input.items.length === 0) return '보철물을 하나 이상 선택해 주세요';

  const seen = new Map<number, Placement[]>();

  for (const item of input.items) {
    // 실제 있는 치아인가
    if (!isValidTooth(item.tooth)) {
      return `${item.tooth} 는 존재하지 않는 치식 번호입니다`;
    }

    // 종류에 그 재료를 붙일 수 있는가
    if (!isValidCombination(item.typeCode, item.materialCode)) {
      return `${item.tooth}번 — 선택한 종류와 재료가 맞지 않습니다`;
    }

    // 인레이 폰틱은 현실에 없습니다
    if (item.isPontic && item.typeCode === 'inlay') {
      return `${item.tooth}번 — 인레이는 폰틱이 될 수 없습니다`;
    }

    // 임플란트는 모델이 필요합니다
    if (requiresImplantModel(item.typeCode) && !item.isPontic) {
      if (!item.implantManufacturer || !item.implantType) {
        return `${item.tooth}번 — 임플란트 제조사와 타입을 선택해 주세요`;
      }
    }

    // 쉐이드가 그 체계에 있는 값인가
    if (item.shadeSystem) {
      for (const shade of [item.shadeCervical, item.shadeIncisal]) {
        if (shade && !isValidShade(item.shadeSystem, shade)) {
          return `${item.tooth}번 — ${shade} 는 선택한 쉐이드 체계에 없습니다`;
        }
      }
    }

    // 한 치아에 몇 개까지, 어떤 조합인가
    const placement: Placement = {
      typeCode: item.typeCode,
      materialCode: item.materialCode,
    };
    const existing = seen.get(item.tooth) ?? [];

    if (existing.length >= MAX_PER_TOOTH) {
      return `${item.tooth}번 — 한 치아에는 최대 ${MAX_PER_TOOTH}개까지입니다`;
    }

    if (existing.length === 1 && !isAllowedPair(existing[0], placement)) {
      return `${item.tooth}번 — 함께 등록할 수 없는 조합입니다`;
    }

    if (existing.some((p) => p.typeCode === placement.typeCode && p.materialCode === placement.materialCode)) {
      return `${item.tooth}번 — 같은 보철이 두 번 들어 있습니다`;
    }

    seen.set(item.tooth, [...existing, placement]);
  }

  return null;
}

// ---------- 저장 ----------

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const problem = validateOrder(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  // 내가 누구인지, 어느 치과 소속인지
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id, organizations(org_type)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  const org = membership?.organizations as { org_type: string } | undefined;
  if (!membership || org?.org_type !== 'clinic') {
    return { ok: false, error: '치과 계정만 주문을 등록할 수 있습니다' };
  }

  // 전속 디자인센터 찾기
  const { data: partnership } = await supabase
    .from('partnerships')
    .select('to_org_id')
    .eq('from_org_id', membership.org_id)
    .eq('relation', 'clinic_design')
    .eq('status', 'active')
    .maybeSingle();

  if (!partnership) {
    return { ok: false, error: '연결된 디자인센터가 없습니다' };
  }

  // 주문번호 발급
  const { data: orderNo, error: noError } = await supabase.rpc('next_order_no');
  if (noError || !orderNo) {
    return { ok: false, error: '주문번호를 만들지 못했습니다' };
  }

  // 주문 만들기
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_no: orderNo,
      clinic_org_id: membership.org_id,
      design_org_id: partnership.to_org_id,
      patient_id: input.patientId ?? null,
      patient_label: input.patientLabel,
      order_type: input.orderType ?? 'modelless',
      status: 'received',
      due_date: input.dueDate,
      notes: input.notes ?? null,
      created_by: user.id,
      received_at: new Date().toISOString(),
    })
    .select('id, order_no')
    .single();

  if (orderError || !order) {
    return { ok: false, error: `주문 저장에 실패했습니다: ${orderError?.message}` };
  }

  // 항목 만들기 — 같은 치아의 두 번째는 slot 2
  const slotCount = new Map<number, number>();

  const rows = input.items.map((item) => {
    const slot = (slotCount.get(item.tooth) ?? 0) + 1;
    slotCount.set(item.tooth, slot);

    return {
      order_id: order.id,
      tooth_number: item.tooth,
      slot,
      type_code: item.typeCode,
      material_code: item.materialCode,
      is_pontic: item.isPontic ?? false,
      shade_system: item.shadeSystem ?? null,
      shade_cervical: item.shadeCervical ?? null,
      shade_incisal: item.shadeIncisal ?? null,
      implant_manufacturer: item.implantManufacturer ?? null,
      implant_type: item.implantType ?? null,
      implant_size: item.implantSize ?? null,
      implant_screw: item.implantScrew ?? null,
      implant_option: item.implantOption ?? null,
    };
  });

  const { data: savedItems, error: itemError } = await supabase
    .from('order_items')
    .insert(rows)
    .select('id, tooth_number, slot, type_code, material_code, is_pontic');

  if (itemError || !savedItems) {
    // 주문만 남으면 안 되므로 되돌립니다
    await supabase.from('orders').delete().eq('id', order.id);
    return { ok: false, error: `보철물 저장에 실패했습니다: ${itemError?.message}` };
  }

  // 브릿지 묶음 저장
  await saveBridges(supabase, order.id, savedItems, input);

  return { ok: true, orderId: order.id, orderNo: order.order_no };
}

/**
 * 브릿지는 화면에서 받지 않고 규칙으로 다시 계산합니다.
 * 화면과 저장 결과가 어긋날 수 없게 하려는 것입니다.
 */
async function saveBridges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  savedItems: Array<{
    id: string;
    tooth_number: number;
    slot: number;
    type_code: string;
    material_code: string;
    is_pontic: boolean;
  }>,
  input: CreateOrderInput,
): Promise<void> {
  const placements: ToothPlacement[] = savedItems.map((row) => ({
    tooth: row.tooth_number,
    typeCode: row.type_code,
    materialCode: row.material_code,
    isPontic: row.is_pontic,
  }));

  const bridges = computeBridges(placements, input.severedKeys ?? []);

  for (const bridge of bridges) {
    const { data: saved } = await supabase
      .from('order_bridges')
      .insert({ order_id: orderId, created_by_rule: true })
      .select('id')
      .single();

    if (!saved) continue;

    const memberIds = savedItems
      .filter(
        (row) =>
          row.type_code === bridge.typeCode &&
          row.material_code === bridge.materialCode &&
          bridge.teeth.includes(row.tooth_number),
      )
      .map((row) => ({ bridge_id: saved.id, order_item_id: row.id }));

    if (memberIds.length > 0) {
      await supabase.from('order_bridge_members').insert(memberIds);
    }
  }
}
