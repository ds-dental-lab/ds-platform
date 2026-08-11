// =========================================================
// 놓을 위치: src/server/actions/repair.ts
//
// 리페어 신청 창구. 검증은 서비스 계층에서 합니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import {
  requestRepair,
  type RepairInput,
  type RepairResult,
} from '@/server/services/repair';

export async function submitRepair(input: RepairInput): Promise<RepairResult> {
  const result = await requestRepair(input);

  if (result.ok) {
    // 새 주문이 생겼으므로 세 섹터의 목록이 모두 달라집니다
    revalidatePath('/clinic/orders', 'layout');
    revalidatePath('/design/orders', 'layout');
    revalidatePath('/lab/orders', 'layout');
  }

  return result;
}
