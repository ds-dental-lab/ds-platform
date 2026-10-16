// =========================================================
// 놓을 위치: src/server/domain/device-health/index.ts
//
// 기기 상태판 — 치과 PC·설계 PC 가 잘 도는지 (사용자 요청 2026-10-16).
//
// ★ 꺼진 것을 **모르는 것**이 가장 위험합니다. 2026-10-16 설계 PC 프로그램이
//   한꺼번에 꺼졌는데 아무도 몰랐고, 메이트 exocad 요청을 아무도 안 가져갔습니다.
// ★ 새 에이전트는 1분마다 상태를 보냅니다(heartbeatAt). 옛 에이전트는 안 보내서
//   '옛 판' 으로 따로 둡니다 — 꺼졌다고 단정하지 않습니다.
// ★ 상태에 환자 정보를 싣지 않습니다. 받는 쪽(sanitizeStatus)에서도 정한 칸만 받습니다.
// ★ Next.js 도 Supabase 도 모르는 순수 계산입니다.
// =========================================================

import { olderThan } from '@/server/domain/agent';

/** 상태 보고가 이만큼 없으면 꺼진 것으로 봅니다 (1분마다 보냄 — 세 번 놓치면) */
export const HEARTBEAT_OFFLINE_SECONDS = 180;
/** 오류가 이만큼 안에 있었으면 '확인 필요' 로 둡니다 */
export const RECENT_ERROR_MINUTES = 60;

/**
 * 기기 하나의 상태.
 *   ok       정상
 *   warn     켜져 있지만 최근 오류가 있음
 *   offline  상태 보고가 끊김
 *   legacy   옛 판 — 상태를 안 보냄. 마지막 소식만 압니다
 */
export type DeviceState = 'ok' | 'warn' | 'offline' | 'legacy';

export interface DeviceHealthInput {
  heartbeatAt: string | null;
  lastSeenAt: string | null;
  lastErrorAt: string | null;
  /** 설계 PC 가 스스로 본 '빠진 것' — 하나라도 있으면 확인 필요 */
  status?: { missing?: string[] };
}

export function deviceState(d: DeviceHealthInput, now: number): DeviceState {
  if (!d.heartbeatAt) return 'legacy';
  if (now - new Date(d.heartbeatAt).getTime() > HEARTBEAT_OFFLINE_SECONDS * 1000) return 'offline';
  // ★ 2026-10-16 빠진 설정 하나가 아무 말 없이 일을 멈췄습니다. 빠지면 바로 노랗게
  if (d.status?.missing?.length) return 'warn';
  if (d.lastErrorAt && now - new Date(d.lastErrorAt).getTime() < RECENT_ERROR_MINUTES * 60_000) return 'warn';
  return 'ok';
}

const LABEL: Record<DeviceState, string> = {
  ok: '정상',
  warn: '확인 필요',
  offline: '꺼짐',
  legacy: '옛 판 — 상태를 안 보냄',
};

export function stateLabel(s: DeviceState): string {
  return LABEL[s];
}

/** 판이 뒤처졌나 — 옛 판이면 상태판에 표시 */
export function versionBehind(version: string | null | undefined, latest: string): boolean {
  return !!version && olderThan(version, latest);
}

// ---------- 받은 상태를 거르기 ----------
//
// ★ 기기가 보낸 것을 그대로 표에 넣지 않습니다. **정한 칸만**, 정한 길이로.
//   기기 열쇠가 새어도 표에 아무거나 쌓이지 않고, 환자 정보가 섞여 들어오지 않습니다.

export interface DeviceStatus {
  kind?: 'clinic' | 'design';
  host?: string;
  /** 치과 PC — 스캔 감시 폴더가 있는가 */
  folderOk?: boolean;
  /** 치과 PC — 프린터 */
  printer?: { kind?: string; ip?: string; ok?: boolean };
  /** 설계 PC — 덴트버드 창 상태(문구) */
  dentbird?: string;
  /** 설계 PC — 지켜보기들이 마지막으로 소식을 남긴 지 몇 초 */
  watchers?: Record<string, number>;
  /** 설계 PC — 일하는 데 꼭 필요한데 **빠진 것** (설계 열쇠·런처 설정·시작프로그램 등) */
  missing?: string[];
  /** 지금 하는 일 — '대기' · '디자인 중' 등 (주문 번호까지만, 환자 이름 없음) */
  doing?: string;
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

export function sanitizeStatus(raw: unknown): DeviceStatus {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: DeviceStatus = {};
  if (r.kind === 'clinic' || r.kind === 'design') out.kind = r.kind;
  const host = str(r.host, 60);
  if (host) out.host = host;
  if (typeof r.folderOk === 'boolean') out.folderOk = r.folderOk;
  if (r.printer && typeof r.printer === 'object') {
    const p = r.printer as Record<string, unknown>;
    out.printer = {
      kind: str(p.kind, 20),
      ip: str(p.ip, 40),
      ok: typeof p.ok === 'boolean' ? p.ok : undefined,
    };
  }
  const dentbird = str(r.dentbird, 120);
  if (dentbird) out.dentbird = dentbird;
  if (r.watchers && typeof r.watchers === 'object') {
    const w: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.watchers as Record<string, unknown>).slice(0, 8)) {
      if (/^[a-z_]{1,30}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) w[k] = Math.max(0, Math.round(v));
    }
    out.watchers = w;
  }
  if (Array.isArray(r.missing)) {
    out.missing = r.missing
      .slice(0, 10)
      .map((m) => str(m, 120))
      .filter((m): m is string => !!m);
  }
  const doing = str(r.doing, 80);
  if (doing) out.doing = doing;
  return out;
}

export interface DeviceEventInput {
  level: 'error' | 'warn' | 'info';
  message: string;
}

/** 기기가 올린 오류들 — 한 번에 20개, 한 줄 300자까지 */
export function sanitizeEvents(raw: unknown): DeviceEventInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .map((e) => {
      const r = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      const level = r.level === 'warn' || r.level === 'info' ? r.level : 'error';
      const message = str(r.message, 300);
      return message ? { level, message } : null;
    })
    .filter((e): e is DeviceEventInput => e !== null);
}

/** 지켜보기가 죽었다고 볼 시간 (watch_common.STALE_SECONDS 와 같게) */
export const WATCHER_STALE_SECONDS = 180;

/** 설계 PC — 소식이 끊긴 지켜보기 이름들 */
export function staleWatchers(w: Record<string, number> | undefined): string[] {
  return Object.entries(w ?? {})
    .filter(([, age]) => age > WATCHER_STALE_SECONDS)
    .map(([name]) => name);
}
