// =========================================================
// 놓을 위치: src/server/actions/order.ts
//
// 화면에서 부르는 창구입니다.
// 'use server' 가 붙어 있어 브라우저가 아니라 서버에서 실행됩니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import {
  createOrder,
  type CreateOrderInput,
  type CreateOrderResult,
} from '@/server/services/order';

export async function submitOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const result = await createOrder(input);

  if (result.ok) {
    revalidatePath('/clinic');
  }

  return result;
}
