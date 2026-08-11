// =========================================================
// 놓을 위치: src/server/services/remake.ts
//
// 리메이크 신청. (설계서 §2.1 C-3, §4.5.2, Q-12, Q-15)
//
// 규칙 요약
//   신청 가능 상태 — shipping · completed 만 (리페어와 같은 시점)
//   신청 주체     — 치과
//   초기 상태     — received (디자인부터 다시 합니다)
//   배정          — 없음. 디자인센터가 다시 정합니다
//   태그          — is_remake, is_billable=false, parent_order_id
//   스캔 파일     — 원주문 재사용 + 신규 업로드 병행, 둘 다 비면 차단 (Q-12)
//
// ★ 리페어와 갈리는 지점은 '어디서부터 다시 하는가' 입니다.
//   리페어는 만든 물건을 손보는 것이라 기공소로 바로 갑니다(production_wait).
//   리메이크는 처음부터 다시 만드는 것이라 디자인부터 갑니다(received).
//   그래서 기공소도 승계하지 않습니다 — 다른 곳에 맡길 수 있어야 합니다.
//
// ★ 원주문은 숫자 두 개만 건드립니다.
//   remake_count 를 올리고 이슈를 하나 답니다. 항목·금액은 그대로 둡니다 —
//   다시 만든 이력이 원주문 금액에 섞이면 정산 근거가 흔들립니다 (§4.5.2).
//
// ★ 계보는 사슬을 타지 않고 root_order_id 로 한 번에 찾습니다.
//   3차 리메이크에서 첫 주문을 찾겠다고 parent 를 세 번 거슬러 오르면
//   조회가 늘어납니다. 뿌리를 그대로 물려줍니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { canRequestRemake, type OrderStatus } from '@/server/domain/order-status';
import { todayInKst } from '@/server/domain/week';
import { defaultDueDate, checkDueDate } from '@/server/domain/due-date';
import { isValidCombination } from '@/server/domain/prosthesis';
import { isValidShade } from '@/server/domain/shade';

const BUCKET = 'order-files';

/**
 * 치아 하나에 대한 변경. 안 바꾸면 필드를 비워 둡니다.
 *
 * ★ 바꾼 것만 담습니다. '그대로' 를 값으로 채워 보내면
 *   원주문이 나중에 고쳐졌을 때 옛 값이 박혀 버립니다.
 */
export interface RemakeChange {
  itemId: string;
  /** 보철 종류·재료를 바꿀 때만 */
  typeCode?: string;
  materialCode?: string;
  /** 쉐이드를 바꿀 때만 */
  shadeSystem?: string;
  shadeCervical?: string | null;
  shadeIncisal?: string | null;
}

export interface RemakeInput {
  orderId: string;
  /** 다시 만들 보철물. 원주문 order_items 의 id 들입니다 (부분 리메이크) */
  itemIds: string[];
  /** 치아별 사양 변경. 안 바꾼 치아는 여기 없습니다 */
  changes?: RemakeChange[];
  /** 요청시한. 리메이크도 그날 기준으로 다시 잡습니다 */
  dueDate?: string;
  /** 왜 다시 만드는지. 디자인센터가 그대로 봅니다 */
  notes: string;
  /** 그대로 쓸 원주문 스캔 파일. order_files 의 id 들입니다 */
  reuseFileIds: string[];
  /** 새로 올릴 파일이 있는가. 실제 업로드는 주문이 생긴 뒤 화면에서 합니다 */
  willUploadNew: boolean;
}

export type RemakeResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string };

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
  has_gingival: boolean;
}

export async function requestRemake(input: RemakeInput): Promise<RemakeResult> {
  const session = await getSession();
  if (!session?.orgId || session.orgType !== 'clinic') {
    return { ok: false, error: '치과 계정만 리메이크를 신청할 수 있습니다' };
  }

  if (input.itemIds.length === 0) {
    return { ok: false, error: '다시 만들 보철물을 하나 이상 골라 주세요' };
  }

  if (!input.notes.trim()) {
    return { ok: false, error: '왜 다시 만드는지 적어 주세요' };
  }

  // ★ Q-12 — 재사용도 신규도 없으면 디자인센터가 볼 것이 없습니다
  if (input.reuseFileIds.length === 0 && !input.willUploadNew) {
    return {
      ok: false,
      error: '스캔 파일이 있어야 합니다. 원주문 파일을 고르거나 새로 올려 주세요',
    };
  }

  const supabase = await createClient();

  const { data: parentRow } = await supabase
    .from('orders')
    .select(
      'id, status, clinic_org_id, design_org_id, order_type, ' +
        'patient_id, patient_label, patient_label_masked, ' +
        'root_order_id, remake_seq, remake_count',
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
    order_type: string;
    patient_id: string | null;
    patient_label: string;
    patient_label_masked: string;
    root_order_id: string | null;
    remake_seq: number;
    remake_count: number;
  };

  // ★ 화면에서 버튼을 숨기는 것은 UX 일 뿐입니다. 여기서 다시 봅니다.
  if (!canRequestRemake(parent.status, 'clinic')) {
    return { ok: false, error: '리메이크는 배송·완료 상태에서만 신청할 수 있습니다' };
  }

  // 남의 주문 항목 id 를 섞어 보내도 통과하면 안 됩니다
  const { data: itemRows } = await supabase
    .from('order_items')
    .select(
      'id, tooth_number, slot, type_code, material_code, is_pontic, ' +
        'shade_system, shade_cervical, shade_incisal, ' +
        'implant_manufacturer, implant_type, implant_size, implant_screw, implant_option, has_gingival',
    )
    .eq('order_id', parent.id)
    .in('id', input.itemIds);

  if (!itemRows || itemRows.length !== input.itemIds.length) {
    return { ok: false, error: '고른 보철물이 이 주문의 것이 아닙니다' };
  }

  const items = itemRows as unknown as CopyableItem[];

  // ---------- 바꾼 사양이 실제로 있는 조합인지 ----------
  //
  // ★ 화면의 셀렉트가 목록을 좁혀 주지만 그것만 믿지 않습니다.
  //   여기서 걸러야 없는 재료·없는 색조가 주문서에 박히지 않습니다.
  const changes = (input.changes ?? []).filter((c) => input.itemIds.includes(c.itemId));

  for (const change of changes) {
    const base = items.find((i) => i.id === change.itemId);
    if (!base) return { ok: false, error: '바꾸려는 보철물이 이 주문의 것이 아닙니다' };

    const typeCode = change.typeCode ?? base.type_code;
    const materialCode = change.materialCode ?? base.material_code;

    if (!isValidCombination(typeCode, materialCode)) {
      return {
        ok: false,
        error: `${base.tooth_number}번 — 바꾼 종류와 재료가 맞지 않습니다`,
      };
    }

    const system = change.shadeSystem ?? base.shade_system;
    if (system) {
      for (const shade of [change.shadeCervical, change.shadeIncisal]) {
        if (shade && !isValidShade(system, shade)) {
          return {
            ok: false,
            error: `${base.tooth_number}번 — ${shade} 는 선택한 쉐이드 체계에 없습니다`,
          };
        }
      }
    }
  }

  // 재사용할 파일도 같은 방식으로 확인합니다
  const reuse: { id: string; storage_path: string; file_name: string; file_size: number | null; mime_type: string | null }[] = [];

  if (input.reuseFileIds.length > 0) {
    const { data: fileRows } = await supabase
      .from('order_files')
      .select('id, storage_path, file_name, file_size, mime_type')
      .eq('order_id', parent.id)
      .is('deleted_at', null)
      .in('id', input.reuseFileIds);

    if (!fileRows || fileRows.length !== input.reuseFileIds.length) {
      return { ok: false, error: '고른 파일이 이 주문의 것이 아닙니다' };
    }
    reuse.push(...fileRows);
  }

  const { data: orderNo, error: noError } = await supabase.rpc('next_order_no');
  if (noError || !orderNo) {
    return { ok: false, error: '주문번호를 만들지 못했습니다' };
  }

  const today = todayInKst();

  // ★ 요청시한은 리메이크 신청일 기준으로 다시 잡습니다.
  //   원주문 시한은 이미 지났습니다. 일반 주문과 같은 규칙을 씁니다.
  const dueDate = input.dueDate ?? defaultDueDate(today);
  const verdict = checkDueDate(dueDate, today);
  if (!verdict.selectable) {
    return { ok: false, error: verdict.reason ?? '고를 수 없는 요청시한입니다' };
  }

  const { data: remake, error: remakeError } = await supabase
    .from('orders')
    .insert({
      order_no: orderNo,
      clinic_org_id: parent.clinic_org_id,
      design_org_id: parent.design_org_id,
      // ★ 기공소는 비워 둡니다. 디자인센터가 다시 정합니다
      lab_org_id: null,
      patient_id: parent.patient_id,
      patient_label: parent.patient_label,
      patient_label_masked: parent.patient_label_masked,
      order_type: parent.order_type,
      status: 'received',
      due_date: dueDate,
      notes: input.notes.trim(),
      is_remake: true,
      is_billable: false,                              // 청구 제외 (§2.1 C-3)
      parent_order_id: parent.id,
      root_order_id: parent.root_order_id ?? parent.id,
      remake_seq: parent.remake_seq + 1,
      created_by: session.user.id,
      received_at: new Date().toISOString(),
    })
    .select('id, order_no')
    .single();

  if (remakeError || !remake) {
    return { ok: false, error: `리메이크를 만들지 못했습니다: ${remakeError?.message}` };
  }

  // 고른 보철물만 옮깁니다 — 부분 리메이크가 됩니다 (§3.2)
  //
  // ★ 바꾼 치아는 새 값으로 갈아 넣습니다.
  //   원주문 항목은 그대로 두므로, 나중에 정산이 부모와 견주어
  //   차액을 뽑을 수 있습니다 (parent_order_id + tooth_number).
  const changeOf = new Map(changes.map((c) => [c.itemId, c]));

  const rows = items.map((item) => {
    const c = changeOf.get(item.id);

    return {
    order_id: remake.id,
    tooth_number: item.tooth_number,
    slot: item.slot,
    type_code: c?.typeCode ?? item.type_code,
    material_code: c?.materialCode ?? item.material_code,
    is_pontic: item.is_pontic,
    shade_system: c?.shadeSystem ?? item.shade_system,
    shade_cervical: c && 'shadeCervical' in c ? c.shadeCervical ?? null : item.shade_cervical,
    shade_incisal: c && 'shadeIncisal' in c ? c.shadeIncisal ?? null : item.shade_incisal,
    implant_manufacturer: item.implant_manufacturer,
    implant_type: item.implant_type,
    implant_size: item.implant_size,
    implant_screw: item.implant_screw,
    implant_option: item.implant_option,
    has_gingival: item.has_gingival,
    };
  });

  const { error: itemError } = await supabase.from('order_items').insert(rows);

  if (itemError) {
    await supabase.from('orders').delete().eq('id', remake.id);
    return { ok: false, error: `보철물을 옮기지 못했습니다: ${itemError.message}` };
  }

  // ---------- 스캔 파일 재사용 (Q-12) ----------
  //
  // ★ order_files.storage_path 에 unique 가 걸려 있어 같은 경로를 두 번
  //   넣을 수 없습니다. 저장소에서 객체를 복사해 새 경로를 만듭니다.
  //   내려받았다 다시 올리지 않고 서버끼리 복사하므로 STL 이 커도 쌉니다.
  for (const file of reuse) {
    const ext = file.storage_path.includes('.') ? file.storage_path.split('.').pop() : '';
    const target = `orders/${remake.id}/${crypto.randomUUID()}_file${ext ? '.' + ext : ''}`;

    const { error: copyError } = await supabase.storage
      .from(BUCKET)
      .copy(file.storage_path, target);

    // 한 장 실패했다고 리메이크 전체를 무르지 않습니다.
    // 화면에서 어느 파일이 안 넘어왔는지 보이고, 다시 올리면 됩니다.
    if (copyError) continue;

    await supabase.from('order_files').insert({
      order_id: remake.id,
      kind: 'scan',
      storage_path: target,
      file_name: file.file_name,
      file_size: file.file_size,
      mime_type: file.mime_type,
      uploaded_by: session.user.id,
    });
  }

  // ---------- 원주문에 흔적 남기기 ----------
  await supabase
    .from('orders')
    .update({ remake_count: parent.remake_count + 1 })
    .eq('id', parent.id);

  await supabase.from('order_issues').insert({
    order_id: parent.id,
    issue_type: 'remake',
    opened_by_org_id: session.orgId,
    reason: input.notes.trim(),
  });

  // 새 주문의 시작점 (from 은 비어 있습니다 — 생성이니까)
  await supabase.from('order_status_history').insert({
    order_id: remake.id,
    from_status: null,
    to_status: 'received',
    actor_org_id: session.orgId,
    actor_user_id: session.user.id,
    reason: input.notes.trim(),
  });

  return { ok: true, orderId: remake.id, orderNo: remake.order_no };
}
