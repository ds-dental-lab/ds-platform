// =========================================================
// 놓을 위치: src/server/actions/pickup.ts
//
// 수거 처리 창구. 검증은 서비스 계층에서 합니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { completePickup, type PickupResult } from '@/server/services/pickup';

export async function submitPickupComplete(pickupId: string): Promise<PickupResult> {
  const result = await completePickup(pickupId);

  if (result.ok) {
    // 상태까지 넘어갔을 수 있으므로 세 섹터를 모두 다시 그립니다
    revalidatePath('/clinic/orders', 'layout');
    revalidatePath('/design/orders', 'layout');
    revalidatePath('/lab/orders', 'layout');
  }

  return result;
}
