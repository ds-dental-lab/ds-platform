// =========================================================
// 놓을 위치: src/app/api/device/auto-print/next-reslice/route.ts
//
// 서버 PC(임시치아 지켜보기)가 "다시 자를 것 있나요" 하고 묻는 곳 (2026-10-23).
//
// ★ 치과가 「다시 뽑기」를 누르면 작업이 '출력 준비' 로 돌아갑니다. 여기서 그것을
//   잡아 주고, 지난번 놓인 STL 의 서명 주소와 올리기 열쇠를 줍니다. 서버 PC 가
//   다음 자리로 다시 잘라 /api/device/print/deliver 로 올립니다.
// ★ 디자인센터 기기만. 일감이 없으면 { ok: true, job: null }.
// =========================================================

import { deviceFromRequest } from '@/server/repositories/device-link';
import { claimNextReslice } from '@/server/repositories/auto-print';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await deviceFromRequest(request);
  if (!auth.ok) return auth.refusal;
  const device = auth.device;

  const result = await claimNextReslice(device);
  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  });
}
