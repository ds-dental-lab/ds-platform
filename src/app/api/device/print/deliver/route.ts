// =========================================================
// 놓을 위치: src/app/api/device/print/deliver/route.ts
//
// 기공소 PC 가 만든 출력 파일을 주문에 붙이는 곳 (2026-10-06).
//
//   1) POST { orderId }                     → 올릴 자리(서명 주소) 셋을 받습니다
//   2) PUT  (저장소로 직접)                  → 파일은 우리 서버를 안 지나갑니다
//   3) POST { orderId, done: true, … }      → 다 올렸다고 알립니다 → 작업이 '출력 대기' 로
//
// ★ 세 가지를 함께 올립니다 — **출력 파일 · 디자인 STL · 놓인 모습 그림**.
//   디자인 STL 과 그림은 기록입니다 (사용자 2026-10-06 — "기록이 있으면
//   좋을거같아서 디자인파일로 업로드 해놓은거야"). 무엇을 어떤 각도로
//   뽑았는지 나중에 확인할 수 있어야 하고, 그림은 서포트가 교합면에
//   붙는 것을 **사람이 눈으로 잡을 유일한 자리**입니다.
//
// ★ 열쇠는 exocad 런처와 같은 방식입니다 — 주문마다 짧게 사는 토큰.
//   기공소 PC 는 치과 기기가 아니라서 기기 열쇠를 쓸 수 없습니다.
// =========================================================

import { verifyExocadToken } from '@/server/exocad/token';
import { openDeliverSlots, finishDeliver } from '@/server/repositories/auto-print';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('t');

  let body: {
    orderId?: unknown;
    done?: unknown;
    files?: unknown;
    rotate?: unknown;
    facts?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: 'JSON 이 아닙니다' }, { status: 400 });
  }

  if (typeof body.orderId !== 'string' || !body.orderId) {
    return Response.json({ ok: false, error: 'orderId 가 없습니다' }, { status: 400 });
  }

  const check = verifyExocadToken(body.orderId, token);
  if (!check.ok) return Response.json({ ok: false, error: check.reason }, { status: 401 });

  const result = body.done
    ? await finishDeliver(body.orderId, body)
    : await openDeliverSlots(body.orderId, body);

  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  });
}
