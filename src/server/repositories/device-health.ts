// =========================================================
// 놓을 위치: src/server/repositories/device-health.ts
//
// 기기 상태판에 그릴 것 — 센터만 (2026-10-16).
// ★ 관리자 열쇠로 읽습니다 — 치과 기기 표는 RLS 가 치과 자기 것만 보이게 해서
//   센터가 못 봅니다. 그래서 부르는 쪽(page)에서 **센터인지 먼저** 확인합니다.
// =========================================================

import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeStatus, type DeviceStatus } from '@/server/domain/device-health';

export interface DeviceRow {
  id: string;
  name: string;
  orgName: string;
  orgType: string;
  version: string | null;
  lastSeenAt: string | null;
  heartbeatAt: string | null;
  status: DeviceStatus;
  lastError: string | null;
  lastErrorAt: string | null;
  events: { at: string; level: string; message: string }[];
}

export async function listDevices(): Promise<DeviceRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('clinic_devices')
    .select(
      'id, name, agent_version, last_seen_at, heartbeat_at, status, last_error, last_error_at, ' +
        'organizations(name, org_type)',
    )
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false, nullsFirst: false });

  type Raw = {
    id: string;
    name: string;
    agent_version: string | null;
    last_seen_at: string | null;
    heartbeat_at: string | null;
    status: unknown;
    last_error: string | null;
    last_error_at: string | null;
    organizations: { name: string; org_type: string } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  if (rows.length === 0) return [];

  const { data: ev } = await admin
    .from('device_events')
    .select('device_id, at, level, message')
    .in('device_id', rows.map((r) => r.id))
    .order('at', { ascending: false })
    .limit(300);
  const byDevice = new Map<string, DeviceRow['events']>();
  for (const e of (ev ?? []) as { device_id: string; at: string; level: string; message: string }[]) {
    const list = byDevice.get(e.device_id) ?? [];
    if (list.length < 5) list.push({ at: e.at, level: e.level, message: e.message });
    byDevice.set(e.device_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    orgName: r.organizations?.name ?? '—',
    orgType: r.organizations?.org_type ?? '',
    version: r.agent_version,
    lastSeenAt: r.last_seen_at,
    heartbeatAt: r.heartbeat_at,
    status: sanitizeStatus(r.status),
    lastError: r.last_error,
    lastErrorAt: r.last_error_at,
    events: byDevice.get(r.id) ?? [],
  }));
}

/** 상태판 한 번 그릴 것 — 지금 시각과 함께 (화면 쪽에서 시각을 부르지 않게) */
export async function deviceBoard(): Promise<{ now: number; rows: DeviceRow[] }> {
  const rows = await listDevices();
  return { now: Date.now(), rows };
}
