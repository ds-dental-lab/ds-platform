// =========================================================
// 놓을 위치: src/app/(dev)/playground/order-detail/page.tsx
//
// 주문상세를 로그인 없이 띄워 봅니다. **개발 중에만 열립니다**
// ((dev)/layout 이 운영에서 404 를 냅니다).
//
// ★ 만든 이유 (2026-08-19): "스크롤 없이 한눈에 보고 싶다" 는 요청은
//   **높이를 재야** 답할 수 있는 일입니다. 그런데 이 화면은 로그인
//   안에만 있어 열어 볼 수가 없었습니다. 눈금자 없이 자르는 셈이라
//   먼저 잴 자리를 만들었습니다.
//
// ★ 여기 자료는 **가짜**입니다. 높이와 열 맞춤만 봅니다.
//   숫자가 맞는지는 repositories/order 의 일입니다.
// =========================================================

import OrderDetailScreen from '@/components/order/OrderDetailScreen';
import { FALLBACK_TYPES } from '@/server/domain/prosthesis';
import type { OrderDetail, OrderDetailItem } from '@/server/repositories/order';

function item(tooth: number, patch: Partial<OrderDetailItem> = {}): OrderDetailItem {
  return {
    id: `i${tooth}`,
    tooth_number: tooth,
    slot: 1,
    type_code: 'crown',
    material_code: 'zirconia',
    is_pontic: false,
    shade_system: 'VITA',
    shade_cervical: 'A2',
    shade_incisal: 'A1',
    implant_manufacturer: null,
    implant_type: null,
    implant_size: null,
    implant_screw: null,
    implant_option: null,
    has_gingival: false,
    ...patch,
  };
}

const ORDER: OrderDetail = {
  id: 'demo',
  order_no: 'ORD-260819-004',
  patient_label: '김철수 (10001)',
  status: 'received',
  order_type: 'normal',
  due_date: '2026-08-26',
  notes: '대구치 Implant Case\n- supra margin [ eq보다 살짝 높게 ]\n- embrassure open [ 0.7mm ~ 1.5mm ]',
  created_at: '2026-08-19T02:00:00.000Z',
  received_at: '2026-08-19T02:10:00.000Z',
  clinic_name: '[안양]선한이웃치과',
  lab_name: '메이트치과기공소',
  in_house: false,
  lab_org_id: 'lab',
  clinic_org_id: 'clinic',
  designer_user_id: null,
  designer_name: '',
  is_repair: false,
  is_remake: false,
  parent_order_id: null,
  roles: ['design_center'],
  items: [
    item(24),
    item(25),
    item(26, {
      type_code: 'implant',
      implant_manufacturer: 'OSSTEM',
      implant_type: 'TS',
      implant_size: '4.0 x 10',
      implant_screw: 'SS',
    }),
    item(36, { is_pontic: true }),
    item(37),
  ],
  files: [
    {
      id: 'f1',
      kind: 'scan',
      file_name: '김철수2026-08-19_10-24-30.dxd',
      file_size: 2_400_000,
      mime_type: null,
      created_at: '2026-08-19T02:11:00.000Z',
      upload_status: 'uploaded',
    },
    {
      id: 'f2',
      kind: 'scan',
      file_name: '김철수_bite.stl',
      file_size: 900_000,
      mime_type: null,
      created_at: '2026-08-19T02:12:00.000Z',
      upload_status: 'uploaded',
    },
  ],
  options: [
    { groupName: '컨택유형', value: '보통' },
    { groupName: '바이트', value: '보통' },
    { groupName: '멤브레저', value: 'Close' },
    { groupName: '축', value: '미사용' },
  ],
};

export default function OrderDetailPlayground() {
  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* 실제 화면의 상단바(48px)를 흉내 냅니다 — 높이를 재려면 있어야 합니다 */}
      <div className="flex h-12 items-center border-b border-[#E8EBF0] bg-white px-4 text-[13px] text-[#98A2B3]">
        (상단바 자리 — 시연용)
      </div>

      <div className="p-3.5">
      <OrderDetailScreen
        order={ORDER}
        sector="design_center"
        today="2026-08-19"
        implantCatalog={[]}
        prosthesisCatalog={FALLBACK_TYPES}
        messages={[]}
        showCost
        labName="메이트치과기공소"
        progress={[
          { key: 'received', label: '접수', state: 'current' },
          { key: 'designing', label: '디자인', state: 'todo' },
          { key: 'making', label: '제작', state: 'todo' },
          { key: 'shipped', label: '배송', state: 'todo' },
        ]}
        />
      </div>
    </div>
  );
}
