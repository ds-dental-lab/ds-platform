// =========================================================
// 놓을 위치: src/server/domain/storage/index.ts
//
// 저장소가 얼마나 찼나. (사용자 요청 2026-08-25)
//
// ★★ **왜 필요한가.** Supabase 의 Spend Cap 이 켜져 있습니다.
//   그건 요금을 막는 스위치가 아니라 **서비스를 막는** 스위치입니다 —
//   100GB 에 닿는 순간 요금이 붙는 대신 업로드가 실패하기 시작합니다.
//   그리고 **왜 안 되는지 화면에 안 나옵니다.** 진료실은 그냥
//   "덴플로우 또 안 되네" 로 읽고, 그날 하루가 날아갑니다.
//
//   닿기 전에 알아야 합니다. 닿은 뒤에 아는 것은 늦습니다.
//
// ★ 센터 관리자만 봅니다. 요금제를 쥔 사람이 그 사람뿐입니다 —
//   치과·기공소에 띄우면 자기가 어쩔 수 없는 일로 걱정만 합니다.
// =========================================================

/**
 * 포함된 저장소.
 *
 * ★ Supabase Pro 기준입니다. 요금제를 바꾸면 여기를 고쳐야 합니다 —
 *   숫자가 화면에 그대로 나가므로 틀리면 바로 거짓말이 됩니다.
 */
export const PLAN_LIMIT_BYTES = 100 * 1024 * 1024 * 1024;

/** 이만큼 차면 알립니다 */
export const WARN_AT = 0.7;

/** 이만큼 차면 말을 세게 합니다 */
export const URGENT_AT = 0.9;

export type StorageLevel = 'ok' | 'warn' | 'urgent';

export function storageLevel(used: number, limit = PLAN_LIMIT_BYTES): StorageLevel {
  if (limit <= 0) return 'ok';

  const ratio = used / limit;

  if (ratio >= URGENT_AT) return 'urgent';
  if (ratio >= WARN_AT) return 'warn';

  return 'ok';
}

/** 사람이 읽는 크기. 소수점 한 자리면 충분합니다 */
export function humanSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + 'GB';
  if (bytes >= 1024 ** 2) return Math.round(bytes / 1024 ** 2) + 'MB';

  return Math.max(0, Math.round(bytes / 1024)) + 'KB';
}

export function percentFull(used: number, limit = PLAN_LIMIT_BYTES): number {
  if (limit <= 0) return 0;

  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * 띄울 한 줄.
 *
 * ★★ **무엇이 멈추는지**를 적습니다. '저장소 78%' 만으로는 그게
 *   나쁜 일인지 모릅니다 — 숫자는 경고가 아닙니다.
 */
export function storageNotice(used: number, limit = PLAN_LIMIT_BYTES): string {
  const percent = percentFull(used, limit);

  if (storageLevel(used, limit) === 'urgent') {
    return `저장소가 ${percent}% 찼습니다. 곧 업로드가 멈춥니다`;
  }

  return `저장소 ${percent}% (${humanSize(used)} / ${humanSize(limit)})`;
}
