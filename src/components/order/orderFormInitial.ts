// =========================================================
// 놓을 위치: src/components/order/orderFormInitial.ts
//
// 저장된 주문을 주문등록 폼이 아는 모양으로 되돌립니다.
//
// ★ 폼은 '치아 하나 = 줄 하나' 로 들고 있고, DB 도 그렇게 저장합니다.
//   중간에 모양이 달라지면 수정 화면에서 슬그머니 값이 빠집니다.
//   그 되돌리기를 한 곳에 모아 두어, 컬럼이 늘면 여기만 고칩니다.
// =========================================================

import { EMPTY_SELECTION } from '@/server/domain/implant';
import type { ToothShade } from '@/server/domain/shade';
import type { ImplantSelection } from '@/server/domain/implant';
import type { ToothPlacement } from '@/server/domain/bridge';
import type { OrderDetail } from '@/server/repositories/order';

export interface OrderFormEntry extends ToothPlacement {
  shadeSystem: string;
  shade: ToothShade;
  implant: ImplantSelection;
  hasGingival: boolean;
}

/** 이미 올라가 있는 파일 한 줄. 수정 화면이 '누적' 을 보여 주는 데 씁니다 */
export interface ExistingOrderFile {
  id: string;
  name: string;
  size: number;
  /** 저장소까지 갔는가. pending/failed 는 이름만 있고 파일이 없습니다 */
  status: 'pending' | 'uploaded' | 'failed';
}

export interface OrderFormInitial {
  orderId: string;
  patientText: string;
  patientId: string | null;
  dueDate: string;
  orderType: string;
  notes: string;
  entries: OrderFormEntry[];
  /** { 옵션그룹id: 옵션값id } — 저장된 것이 이름으로 오므로 id 로 되돌립니다 */
  options: Record<string, string>;
  /**
   * 이 주문에 이미 올라가 있는 스캔·쉐이드 파일.
   *
   * ★ 수정 화면에서 드롭존이 **빈 칸으로** 보였습니다. 그러면
   *   "안 올라갔나 보다" 하고 같은 파일을 또 올립니다 — 실제로
   *   같은 스캔이 두 벌씩 쌓입니다. 이미 있는 것을 먼저 보여 주고,
   *   새로 고른 것을 그 아래에 쌓습니다.
   *
   * ★ 총량 상한(1GB)도 **이미 있는 것까지 합쳐서** 잽니다.
   *   새로 고른 것만 재면 수정을 반복해 상한을 그냥 지나갑니다.
   */
  files: ExistingOrderFile[];
}

export interface OptionGroupLite {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}

/**
 * 상세 조회 결과를 폼 초기값으로 옮깁니다.
 *
 * ★ 제작옵션은 상세에서 이름(훅 · 미사용)으로 내려옵니다.
 *   폼의 셀렉트는 id 로 움직이므로 마스터를 뒤져 id 를 찾습니다.
 *   못 찾으면 그 줄을 비우고 기본값이 잡히게 둡니다 — 틀린 id 를
 *   넣느니 비는 편이 낫습니다.
 */
export function toFormInitial(
  order: OrderDetail,
  optionGroups: OptionGroupLite[],
): OrderFormInitial {
  const entries: OrderFormEntry[] = order.items.map((item) => ({
    tooth: item.tooth_number,
    typeCode: item.type_code,
    materialCode: item.material_code,
    isPontic: item.is_pontic,
    shadeSystem: item.shade_system ?? 'vita_classic',
    shade: { cervical: item.shade_cervical, incisal: item.shade_incisal },
    implant:
      item.type_code === 'implant'
        ? {
            manufacturerCode: item.implant_manufacturer,
            typeCode: item.implant_type,
            sizeCode: item.implant_size,
            screwCode: item.implant_screw,
            option: item.implant_option ?? '',
          }
        : { ...EMPTY_SELECTION },
    hasGingival: item.has_gingival,
  }));

  const options: Record<string, string> = {};
  for (const saved of order.options) {
    const group = optionGroups.find((g) => g.name === saved.groupName);
    const value = group?.values.find((v) => v.value === saved.value);
    if (group && value) options[group.id] = value.id;
  }

  return {
    orderId: order.id,
    patientText: order.patient_label,
    patientId: null,
    dueDate: order.due_date,
    orderType: order.order_type,
    notes: order.notes ?? '',
    entries,
    options,
    /*
      ★ 디자인 파일은 뺍니다. 이 드롭존은 스캔·쉐이드 칸입니다 —
        디자인 파일은 디자인센터의 제 칸(DesignFileUpload)에 있습니다.
    */
    files: order.files
      .filter((f) => f.kind !== 'design')
      .map((f) => ({
        id: f.id,
        name: f.file_name,
        size: f.file_size ?? 0,
        status: f.upload_status,
      })),
  };
}
