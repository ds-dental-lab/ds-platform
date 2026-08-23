// =========================================================
// 놓을 위치: src/server/repositories/arrival.ts
//
// 오늘 도착할 보철물. (사용자 요청 2026-08-24)
//
// ★ 치과 자기 주문만 옵니다 — RLS 가 고릅니다. 여기서 조직을 다시
//   적지 않습니다. 두 곳에 조건을 적으면 어긋날 때 구멍이 납니다.
//
// ★★ 기준은 데스크톱 배송조회와 **같은 요청시한(due_date)** 입니다.
//   여기서만 다른 날짜를 쓰면 두 화면이 서로 다른 말을 하게 되고,
//   그러면 어느 쪽을 믿어야 할지 아무도 모릅니다.
// =========================================================

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { recordAccess } from '@/server/audit';
import { todayInKst } from '@/server/domain/week';
import { arrivalStateOf, arrivalRank, type ArrivalState } from '@/server/domain/arrival';
import type { OrderStatus } from '@/server/domain/order-status';

export interface ArrivalRow {
  id: string;
  orderNo: string;
  patientLabel: string;
  /** '#26 · 1개' 처럼 한 줄로 */
  workLabel: string;
  state: ArrivalState;
}

interface RawRow {
  id: string;
  order_no: string;
  patient_label: string;
  status: OrderStatus;
  order_items: { tooth_number: number }[] | null;
}

function workLabelOf(items: { tooth_number: number }[]): string {
  if (items.length === 0) return '항목 없음';

  const teeth = [...new Set(items.map((i) => i.tooth_number))].sort((a, b) => a - b);
  const shown = teeth.slice(0, 3).map((t) => `#${t}`).join(' ');
  const more = teeth.length > 3 ? ` 외 ${teeth.length - 3}` : '';

  return `${shown}${more} · ${items.length}개`;
}

/**
 * 오늘 오기로 한 것들.
 *
 * ★ 취소는 빠집니다 (arrivalStateOf 가 null 을 줍니다).
 * ★ 안 온 것이 위로 옵니다 — 전화를 걸어야 하는 건이 그것입니다.
 */
export async function listArrivingToday(): Promise<ArrivalRow[]> {
  const supabase = await createClient();
  const today = todayInKst();

  const { data } = await supabase
    .from('orders')
    .select(
      /*
        ★★ **만드는 곳을 안 싣습니다.** 치과에게는 늘 '덴플로우' 라서
          모든 줄에 같은 글자가 찍힙니다 — 다르지 않은 값은 자리만
          먹고 눈을 흐립니다.

        ★ 실제로 확인했습니다: 치과 계정으로 읽으면 lab 이 **언제나
          null** 입니다. RLS 가 하청 기공소를 가립니다(그게 맞습니다 —
          어디에 맡겼는지는 우리 사정입니다). 그러니 '기공소가 정해지면
          기공소를 보여 준다' 는 것은 치과 화면에서는 일어나지 않는
          일이고, 그걸 기대한 코드는 거짓 안전망입니다.
      */
      'id, order_no, patient_label, status, order_items(tooth_number)',
    )
    .is('deleted_at', null)
    .eq('due_date', today);

  if (!data) return [];

  /*
    ★ 환자 이름이 한 번에 여러 명 나갑니다 — 데스크톱 배송조회와
      같은 모양이라 같게 남깁니다 (설계서 §8.5). 자주 열어도 5분
      단위로 묶이므로 기록이 넘치지 않습니다.
  */
  await recordAccess({
    action: 'order.list',
    subjectCount: data.length,
    detail: '오늘 도착(모바일)',
  });

  return (data as unknown as RawRow[])
    .flatMap((row) => {
      const state = arrivalStateOf(row.status);
      if (!state) return [];

      return [
        {
          id: row.id,
          orderNo: row.order_no,
          patientLabel: row.patient_label,
          workLabel: workLabelOf(row.order_items ?? []),
          state,
        },
      ];
    })
    .sort(
      (a, b) => arrivalRank(a.state) - arrivalRank(b.state) || a.orderNo.localeCompare(b.orderNo),
    );
}
