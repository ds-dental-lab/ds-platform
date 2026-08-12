// =========================================================
// 놓을 위치: src/server/domain/retention/index.ts
//
// 보관기간과 파기. (법률 검토 2026-08-12 에서 나온 항목)
//
// ★ 지금까지 아무것도 진짜로 안 지워졌습니다.
//   `deleted_at` 을 세워 화면에서 가릴 뿐이고, 저장소의 덩어리와
//   열람 기록은 그대로 쌓입니다. 개인정보를 "필요한 기간만" 갖고
//   있으려면 실제로 지우는 길이 있어야 합니다.
//
// ★ 기간을 제가 정하지 않습니다.
//   얼마나 보관할지는 법과 그 조직의 판단입니다. 아래 SUGGESTED 는
//   **제안**이고, 안 정하면(null) 아무것도 안 지웁니다.
//   저는 변호사가 아닙니다 — 숫자를 박아 두면 그게 근거처럼 보입니다.
//
// ★ 항목마다 **어느 날부터 세는지**가 다릅니다.
//   지운 줄은 지운 날부터, 열람 기록은 남은 날부터, 파일은 **주문이
//   끝난 날**부터입니다. 파일을 올린 날부터 세면 오래 걸린 주문의
//   파일이 아직 만드는 중에 사라집니다.
// =========================================================

export type RetentionTarget = 'soft_deleted' | 'audit_log' | 'order_file';

export const RETENTION_TARGETS: RetentionTarget[] = ['soft_deleted', 'audit_log', 'order_file'];

export interface RetentionMeta {
  label: string;
  /** 무엇을 지우는가 */
  what: string;
  /** 어느 날부터 세는가 */
  from: string;
  /** 정하기 전에 알아야 할 것 */
  caution: string;
  /** 제안 — **정답이 아닙니다** */
  suggestedDays: number;
  suggestedWhy: string;
}

export const RETENTION_META: Record<RetentionTarget, RetentionMeta> = {
  soft_deleted: {
    label: '지운 주문·파일',
    what: '지웠다고 표시만 해 둔 줄과 저장소의 덩어리',
    from: '지운 날',
    caution: '되돌릴 길이 없어집니다. 잘못 지운 것을 되살릴 수 있는 기간을 두세요.',
    suggestedDays: 30,
    suggestedWhy: '한 달이면 "잘못 지웠다" 는 말이 나올 만큼은 지났습니다',
  },
  audit_log: {
    label: '열람 기록',
    what: '누가 언제 환자 정보를 열어 봤는지',
    from: '기록이 남은 날',
    caution:
      '개인정보 접속기록은 법이 **최소 보관기간**을 정하고 있습니다 (민감정보면 더 깁니다). 짧게 잡으면 안 됩니다 — 자문을 받으세요.',
    suggestedDays: 730,
    suggestedWhy: '2년. 최소 기간을 넉넉히 넘깁니다',
  },
  order_file: {
    label: '스캔·디자인 파일',
    what: '끝난 주문에 붙은 파일 (저장소 덩어리까지)',
    from: '주문이 완료된 날',
    caution:
      '지우면 그 주문으로 다시 만들 수 없습니다. 리메이크 요청이 들어올 만한 기간을 지나서 잡으세요. 파일명에 환자 이름이 들어 있어 가장 크게 새는 곳이기도 합니다.',
    suggestedDays: 365,
    suggestedWhy: '1년. 리메이크가 들어올 만한 기간은 지났습니다',
  },
};

export const MIN_KEEP_DAYS = 1;
export const MAX_KEEP_DAYS = 3650;

export type RetentionVerdict = { ok: true } | { ok: false; reason: string };

/**
 * 이 보관기간을 쓸 수 있는가.
 *
 * ★ null 은 '안 정함' 이고, 안 정하면 **아무것도 안 지웁니다.**
 *   0 이나 빈 값을 '즉시 파기' 로 읽으면 손이 미끄러진 순간 다 사라집니다.
 */
export function checkKeepDays(days: number | null): RetentionVerdict {
  if (days === null) return { ok: true };

  if (!Number.isInteger(days)) return { ok: false, reason: '날 수를 정수로 넣어 주세요' };
  if (days < MIN_KEEP_DAYS) {
    return { ok: false, reason: '하루보다 짧게는 못 잡습니다. 안 지우려면 비워 두세요' };
  }
  if (days > MAX_KEEP_DAYS) return { ok: false, reason: '10년(3650일)까지입니다' };

  return { ok: true };
}

/**
 * 이 기간이면 언제 이전 것을 지우는가.
 *
 * ★ 안 정했으면 null — 부르는 쪽은 **아무것도 안 지워야** 합니다.
 */
export function cutoffFor(days: number | null, now: Date = new Date()): Date | null {
  if (days === null) return null;

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** 화면에 쓰는 말 — '1년' · '30일' */
export function formatDays(days: number | null): string {
  if (days === null) return '안 지움';
  if (days % 365 === 0) return `${days / 365}년`;
  if (days % 30 === 0 && days >= 60) return `${days / 30}개월`;

  return `${days}일`;
}

export interface RetentionPlan {
  target: RetentionTarget;
  keepDays: number | null;
  /** 지금 규칙대로면 몇 건이 지워지는가 */
  due: number;
  /** 이 시각 이전 것 */
  cutoff: string | null;
}

/**
 * 지금 눌러도 되는가.
 *
 * ★ 안 정한 항목은 누를 것이 없습니다.
 * ★ 지울 것이 없어도 누를 것이 없습니다 — 빈 파기 기록만 쌓입니다.
 */
export function canPurge(plan: RetentionPlan): boolean {
  return plan.keepDays !== null && plan.due > 0;
}

/**
 * 한 번에 몇 건까지.
 *
 * ★ 끊어서 지웁니다.
 *   파일은 저장소에서도 지워야 해서 한 건에 왕복이 한 번씩 붙습니다.
 *   수천 건을 한 번에 돌리면 화면이 먼저 끊기고, 어디까지 지웠는지
 *   아무도 모르는 상태가 됩니다. 끊어서 지우고 남은 수를 말해 줍니다.
 */
export const PURGE_BATCH = 200;

/**
 * 보관기간을 정하고 파기를 누를 수 있는 자리인가.
 *
 * ★ 자리 규칙(domain/member)과 같은 문입니다.
 *   여기서 따로 판단하면 언젠가 둘이 어긋납니다.
 */
export function canManage(role: string | null): boolean {
  return role === 'owner' || role === 'admin';
}
