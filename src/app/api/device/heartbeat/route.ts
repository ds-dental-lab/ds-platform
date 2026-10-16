// =========================================================
// 놓을 위치: src/app/api/device/heartbeat/route.ts
//
// 기기가 1분마다 "살아 있습니다 + 지금 상태" 를 알리는 곳 (2026-10-16).
//   { version, status: {…}, events: [{ level, message }] }
//
// ★ 받은 것은 정한 칸만 거릅니다(domain/device-health). 환자 정보를 싣지 않습니다.
// ★ 살아났으면 꺼짐 알림 표시(offline_alerted_at)를 비웁니다 — 다음에 또 꺼지면 다시 알립니다.
// =========================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { deviceFromToken } from '@/server/repositories/device-link';
import { cleanVersion } from '@/server/domain/agent';
import { sanitizeEvents, sanitizeStatus } from '@/server/domain/device-health';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    version?: unknown;
    status?: unknown;
    events?: unknown;
  };

  const now = new Date().toISOString();
  const events = sanitizeEvents(body.events);
  const lastError = [...events].reverse().find((e) => e.level === 'error');

  const patch: Record<string, unknown> = {
    heartbeat_at: now,
    last_seen_at: now,
    status: sanitizeStatus(body.status),
    offline_alerted_at: null,
  };
  const version = cleanVersion(body.version);
  if (version) patch.agent_version = version;
  if (lastError) {
    patch.last_error = lastError.message;
    patch.last_error_at = now;
  }

  const admin = createAdminClient();
  const { error } = await admin.from('clinic_devices').update(patch).eq('id', device.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  if (events.length) {
    await admin
      .from('device_events')
      .insert(events.map((e) => ({ device_id: device.id, level: e.level, message: e.message })));
  }

  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
