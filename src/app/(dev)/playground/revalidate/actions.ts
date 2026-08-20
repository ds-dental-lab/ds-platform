'use server';

import { revalidatePath } from 'next/cache';

/** 수정 저장(submitUpdateOrder)이 하는 것과 같은 모양입니다 */
export async function touchLayout(): Promise<{ ok: true }> {
  revalidatePath('/playground', 'layout');
  return { ok: true };
}

/** 견주기 위해 — 아무것도 안 무르는 서버 액션 */
export async function touchNothing(): Promise<{ ok: true }> {
  return { ok: true };
}
