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
import {
  changeOrderStatus,
  type ChangeStatusOptions,
  type ChangeStatusResult,
} from '@/server/services/order-status';
import type { OrderStatus } from '@/server/domain/order-status';

export async function submitOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const result = await createOrder(input);

  if (result.ok) {
    revalidatePath('/clinic');
  }

  return result;
}

/**
 * 상태 전이. 검증은 전부 서비스 계층에서 합니다.
 * 같은 주문을 치과와 디자인센터가 각자의 화면에서 보므로 양쪽을 다시 그립니다.
 */
export async function submitStatusChange(
  orderId: string,
  to: OrderStatus,
  options: ChangeStatusOptions = {},
): Promise<ChangeStatusResult> {
  const result = await changeOrderStatus(orderId, to, options);

  if (result.ok) {
    revalidatePath('/clinic/orders', 'layout');
    revalidatePath('/design/orders', 'layout');
    revalidatePath('/lab/orders', 'layout');
  }

  return result;
}
