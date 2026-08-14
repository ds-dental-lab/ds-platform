// =========================================================
// 놓을 위치: src/server/actions/remake-reason.ts
//
// 리메이크 사유 창구. (사용자 요청 2026-08-14)
//
// ★ 디자인센터 사람이면 **관리자든 사용자든** 넣습니다.
//   실제로 그 건을 만진 디자이너가 사유를 제일 잘 압니다. 관리자만
//   넣게 하면 아무도 안 적거나, 디자이너가 말로 전하고 관리자가
//   대신 적게 됩니다 — 그러면 내용이 한 번 걸러집니다.
//   **통계를 보는 것만** 관리자입니다.
//
// ★ 여기서 막는 것은 말을 걸어 주기 위한 것이고, 진짜 자물쇠는
//   remake_reasons 의 정책입니다. 둘 중 하나만 두면 언젠가 샙니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/policies/session';
import { replaceOrderReasons } from '@/server/repositories/remake-reason';
import { NOTE_MAX } from '@/server/domain/remake-reason';

export interface RemakeReasonInput {
  orderId: string;
  codes: string[];
  note: string | null;
}

export type RemakeReasonResult = { ok: true; count: number } | { ok: false; error: string };

export async function submitRemakeReasons(
  input: RemakeReasonInput,
): Promise<RemakeReasonResult> {
  const session = await getSession();

  if (!session) return { ok: false, error: '로그인이 필요합니다.' };
  if (session.orgType !== 'design_center') {
    return { ok: false, error: '리메이크 사유는 디자인센터에서 적습니다.' };
  }

  if (!input.orderId) return { ok: false, error: '주문을 찾지 못했습니다.' };

  // 아주 긴 글은 다듬는 쪽에서 잘리지만, 오는 길에서도 한 번 막습니다
  if ((input.note ?? '').length > NOTE_MAX * 4) {
    return { ok: false, error: '기타 사유가 너무 깁니다.' };
  }

  const result = await replaceOrderReasons(input.orderId, input.codes, input.note);

  if (!result.ok) return result;

  revalidatePath(`/design/orders/${input.orderId}`);
  revalidatePath('/design/stats');

  return { ok: true, count: result.saved.codes.length };
}
