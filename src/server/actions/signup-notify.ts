// =========================================================
// 놓을 위치: src/server/actions/signup-notify.ts
//
// 가입 화면이 가입 직후에 부릅니다 — "센터에 알려 주세요".
//
// ★ 왜 화면이 부르나. 가입 신청서는 auth.users 트리거가 만들어서
//   서버 코드가 끼어들 자리가 없습니다. 종은 표 트리거가 넣지만
//   푸시·메일은 Node 가 해야 합니다. 그래서 화면이 한 번 찔러 줍니다.
//
// ★ 누구나 부를 수 있는 액션입니다 (가입 직후엔 세션이 없을 수 있습니다).
//   그래서 **아무 값도 믿지 않습니다** — userId 로 '아직 안 알린 pending
//   신청' 을 찾을 때만 보내고, 보내면서 표시를 찍어 두 번은 안 갑니다.
//   남의 userId 를 넣어 봐야 그 사람 신청이 진짜 있고 아직 안 알린
//   경우에만, 그것도 딱 한 번 갑니다 — 어차피 가야 할 알림입니다.
// =========================================================

'use server';

import { publishSignupRequested } from '@/server/events/approval-alert';

export async function notifySignupRequested(userId: string): Promise<void> {
  if (!userId || typeof userId !== 'string' || userId.length > 64) return;

  await publishSignupRequested(userId);
}
