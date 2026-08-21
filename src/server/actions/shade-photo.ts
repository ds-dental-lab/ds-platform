// =========================================================
// 놓을 위치: src/server/actions/shade-photo.ts
//
// 쉐이드 사진을 다 올린 뒤 알립니다. (명세서 SPEC_shade-photo S4)
//
// ★ 왜 따로 있나 — 사진은 **브라우저가 직접** 저장소로 올립니다
//   (서버를 거치면 큰 파일이 두 번 갑니다). 그래서 다 올린 뒤에
//   서버에게 "붙었다" 고 알려 주는 자리가 필요합니다.
//
// ★ 알림이 실패해도 사진은 이미 붙어 있습니다. 화면은 이 결과를
//   보고 실패를 크게 알리지 않습니다 — 사진이 안 갔다는 말로
//   읽히면 안 됩니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/policies/session';
import { publishShadePhotoAdded } from '@/server/events/shade-photo';

export type NoticeResult = { ok: boolean };

export async function submitShadePhotoAdded(
  orderId: string,
  count: number,
): Promise<NoticeResult> {
  const session = await getSession();
  if (!session?.orgId || !session.user) return { ok: false };

  await publishShadePhotoAdded({
    orderId,
    count,
    actorOrgId: session.orgId,
    actorUserId: session.user.id,
  });

  revalidatePath(`/design/orders/${orderId}`);
  revalidatePath(`/lab/orders/${orderId}`);
  revalidatePath('/design', 'layout');
  revalidatePath('/lab', 'layout');

  return { ok: true };
}
