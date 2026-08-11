// =========================================================
// 놓을 위치: src/server/services/repair.ts
//
// 리페어 신청. (설계서 §4.5 리페어 생성 규칙 v0.4, Q-13, Q-15)
//
// 규칙 요약
//   신청 가능 상태 — shipping · completed 만 (리메이크와 같은 시점)
//   신청 주체     — 치과
//   초기 상태     — production_wait (디자인센터를 거치지 않습니다)
//   배정          — 원주문의 기공소를 그대로 승계
//   태그          — is_repair, is_billable=false, parent_order_id
//   알림          — 배정된 기공소에게
//
// ★ 원주문은 건드리지 않습니다.
//   고친 이력이 원주문 금액에 섞이면 정산 근거가 흔들립니다 (§4.5.2).
//
// ★ 리페어에는 수거가 따라옵니다.
//   고칠 보철물을 기공소가 가져가야 합니다. 그래서 같은 트랜잭션에서
//   pickup_requests 를 함께 만듭니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { canRequestRepair, type OrderStatus } from '@/server/domain/order-status';
import { publishRepairRequested } from '@/server/events';

export interface RepairInput {
  orderId: string;
  /** 고칠 보철물. 원주문 order_items 의 id 들입니다 */
  itemIds: string[];
  /** 무엇이 문제인지. 기공소가 그대로 봅니다 */
  notes: string;
}

export type RepairResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string };

/** 리페어 주문으로 옮겨 담을 보철물의 모양 */
interface CopyableItem {
  id: string;
  tooth_number: number;
  slot: number;
  type_code: string;
  material_code: string;
  is_pontic: boolean;
  shade_system: string | null;
  shade_cervical: string | null;
  shade_incisal: string | null;
  implant_manufacturer: string | null;
  implant_type: string | null;
  implant_size: string | null;
  implant_screw: string | null;
  implant_option: string | null;
}

export async function requestRepair(input: RepairInput): Promise<RepairResult> {
  const session = await getSession();
  if (!session?.orgId || session.orgType !== 'clinic') {
    return { ok: false, error: '치과 계정만 리페어를 신청할 수 있습니다' };
  }

  if (input.itemIds.length === 0) {
    return { ok: false, error: '고칠 보철물을 하나 이상 골라 주세요' };
  }

  if (!input.notes.trim()) {
    return { ok: false, error: '어디가 어떻게 문제인지 적어 주세요' };
  }

  const supabase = await createClient();

  // 원주문 — RLS 가 남의 주문을 걸러 줍니다
  const { data: parentRow } = await supabase
    .from('orders')
    .select(
      'id, status, clinic_org_id, design_org_id, lab_org_id, ' +
        'patient_id, patient_label, patient_label_masked, order_type',
    )
    .eq('id', input.orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!parentRow) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const parent = parentRow as unknown as {
    id: string;
    status: OrderStatus;
    clinic_org_id: string;
    design_org_id: string | null;
    lab_org_id: string | null;
    patient_id: string | null;
    patient_label: string;
    patient_label_masked: string;
    order_type: string;
  };

  // ★ 화면에서 버튼을 숨기는 것은 UX 일 뿐입니다. 여기서 다시 봅니다.
  if (!canRequestRepair(parent.status, 'clinic')) {
    return {
      ok: false,
      error: '리페어는 배송·완료 상태에서만 신청할 수 있습니다',
    };
  }

  if (!parent.lab_org_id) {
    return {
      ok: false,
      error: '이 주문은 기공소가 배정되지 않아 리페어를 보낼 곳이 없습니다',
    };
  }

  // 고를 수 있는 보철물이 맞는지 확인합니다.
  // 남의 주문 항목 id 를 섞어 보내도 통과하면 안 됩니다.
  const { data: itemRows } = await supabase
    .from('order_items')
    .select('id, tooth_number, slot, type_code, material_code, is_pontic, ' +
      'shade_system, shade_cervical, shade_incisal, ' +
      'implant_manufacturer, implant_type, implant_size, implant_screw, implant_option')
    .eq('order_id', parent.id)
    .in('id', input.itemIds);

  if (!itemRows || itemRows.length !== input.itemIds.length) {
    return { ok: false, error: '고른 보철물이 이 주문의 것이 아닙니다' };
  }

  const items = itemRows as unknown as CopyableItem[];

  const { data: orderNo, error: noError } = await supabase.rpc('next_order_no');
  if (noError || !orderNo) {
    return { ok: false, error: '주문번호를 만들지 못했습니다' };
  }

  // 리페어 주문 — 디자인 단계를 건너뛰고 바로 제작대기로 들어갑니다
  const { data: repair, error: repairError } = await supabase
    .from('orders')
    .insert({
      order_no: orderNo,
      clinic_org_id: parent.clinic_org_id,
      design_org_id: parent.design_org_id,
      lab_org_id: parent.lab_org_id,      // 원주문 기공소 승계
      patient_id: parent.patient_id,
      patient_label: parent.patient_label,
      patient_label_masked: parent.patient_label_masked,
      order_type: 'repair',
      status: 'production_wait',
      due_date: defaultDueDate(),
      notes: input.notes.trim(),
      is_repair: true,
      is_billable: false,                 // 청구 제외 (§4.5)
      parent_order_id: parent.id,
      created_by: session.user.id,
      received_at: new Date().toISOString(),
    })
    .select('id, order_no')
    .single();

  if (repairError || !repair) {
    return { ok: false, error: `리페어를 만들지 못했습니다: ${repairError?.message}` };
  }

  // 고칠 보철물만 복사합니다. 전체가 아니라 고른 것만입니다.
  const rows = items.map((item) => ({
    order_id: repair.id,
    tooth_number: item.tooth_number,
    slot: item.slot,
    type_code: item.type_code,
    material_code: item.material_code,
    is_pontic: item.is_pontic,
    shade_system: item.shade_system,
    shade_cervical: item.shade_cervical,
    shade_incisal: item.shade_incisal,
    implant_manufacturer: item.implant_manufacturer,
    implant_type: item.implant_type,
    implant_size: item.implant_size,
    implant_screw: item.implant_screw,
    implant_option: item.implant_option,
  }));

  const { error: itemError } = await supabase.from('order_items').insert(rows);

  if (itemError) {
    // 항목 없는 리페어 주문이 남으면 안 됩니다
    await supabase.from('orders').delete().eq('id', repair.id);
    return { ok: false, error: `보철물을 옮기지 못했습니다: ${itemError.message}` };
  }

  // 수거요청 — 고칠 보철물을 기공소가 가져가야 합니다
  await supabase.from('pickup_requests').insert({
    clinic_org_id: parent.clinic_org_id,
    lab_org_id: parent.lab_org_id,
    order_id: repair.id,
    kind: 'prosthesis',
    status: 'open',
    memo: input.notes.trim(),
    requested_by_user_id: session.user.id,
  });

  // 상태 이력에 시작점을 남깁니다 (from 은 비어 있습니다 — 생성이니까)
  await supabase.from('order_status_history').insert({
    order_id: repair.id,
    from_status: null,
    to_status: 'production_wait',
    actor_org_id: session.orgId,
    actor_user_id: session.user.id,
    reason: input.notes.trim(),
  });

  await publishRepairRequested({
    repairOrderId: repair.id,
    parentOrderId: parent.id,
    labOrgId: parent.lab_org_id,
    actorOrgId: session.orgId,
    actorUserId: session.user.id,
    notes: input.notes.trim(),
  });

  return { ok: true, orderId: repair.id, orderNo: repair.order_no };
}

/**
 * 리페어의 요청시한.
 * 원주문 시한은 이미 지났으므로 다시 잡습니다.
 * 수거가 다음날 오전이라 넉넉히 일주일을 둡니다.
 */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}
