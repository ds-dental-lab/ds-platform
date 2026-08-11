// =========================================================
// 놓을 위치: src/server/actions/remake.ts
//
// 리메이크 신청 창구. 검증은 서비스 계층에서 합니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import {
  requestRemake,
  type RemakeInput,
  type RemakeResult,
} from '@/server/services/remake';

export async function submitRemake(input: RemakeInput): Promise<RemakeResult> {
  const result = await requestRemake(input);

  if (result.ok) {
    // 새 주문이 생기고 원주문의 리메이크 횟수도 올라갑니다
    revalidatePath('/clinic/orders', 'layout');
    revalidatePath('/design/orders', 'layout');
  }

  return result;
}
