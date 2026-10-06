// =========================================================
// 놓을 위치: src/app/api/device/agent/route.ts
//
// 에이전트가 "내 판이 최신인가" 물어보는 곳 (2026-10-06).
//   { "version": "1.0.0" }  →  { latest, note, url, outdated }
//
// ★ **저절로 받지 않습니다.** 알리기만 합니다 — 받는 것은 치과 사람이
//   누릅니다. 치과 PC 에서 프로그램이 저 혼자 바뀌면, 스캔이 안 올라가는
//   날 원인을 못 찾습니다.
//
// ★ 열쇠를 **안 가립니다.** 판 번호는 비밀이 아니고, 아직 연결하지 않은
//   PC 도 물어볼 수 있어야 합니다. 다만 열쇠를 함께 보내면 그 PC 가 어느
//   판인지 적어 둡니다 — 치과마다 어느 판인지 알 길이 그래야 생깁니다.
// =========================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { deviceFromToken } from '@/server/repositories/device-link';
import { agentUpdate, cleanVersion } from '@/server/domain/agent';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { version?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* 판 번호를 안 보내도 최신 판은 알려 줍니다 */
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (token) {
    const device = await deviceFromToken(token);
    const version = cleanVersion(body.version);
    if (device && version) {
      await createAdminClient()
        .from('clinic_devices')
        .update({ agent_version: version, last_seen_at: new Date().toISOString() })
        .eq('id', device.id);
    }
  }

  return Response.json(agentUpdate(body.version), {
    headers: { 'cache-control': 'no-store' },
  });
}
