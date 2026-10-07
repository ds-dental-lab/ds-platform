// =========================================================
// 놓을 위치: src/server/domain/auto-print/index.ts
//
// 자동 템포러리 — 한 주문이 디자인·슬라이스·출력까지 가는 길 (사용자 요청 2026-10-06).
//
// ★ Next.js 도 Supabase 도 프린터도 모르는 순수 계산입니다.
//   고리가 다섯이나 되고(기공소 사람 → 기공소 PC → 서버 → 치과 PC → 프린터)
//   어느 고리든 끊길 수 있습니다. 끊긴 자리를 말할 수 있어야 고칠 수 있습니다.
//
// ★ 프린터 기종을 아직 모릅니다 (2026-10-06). 그래서 이 파일에는 기종이
//   한 글자도 없습니다. 기종은 프로파일 고를 때만 쓰이고, 길 자체는 같습니다.
//
// ★ '베드 비움' 을 단계로 두지 않았습니다.
//   단계를 늘리는 대신 `bedClearedAt` 도장 하나로 풉니다. queued 에 머문 채
//   도장이 없으면 "치과 확인 대기", 찍히면 집어갈 수 있는 것 — 같은 뜻인데
//   되돌릴 자리가 하나 줄어듭니다.
// =========================================================

/**
 * 한 주문이 지금 어느 고리에 있는가.
 *
 * ★ 뒤로 가는 길은 없습니다. 실패하면 `failed` 로 빠지고, 사람이 다시 걸면
 *   **실패한 그 자리**로 돌아갑니다 (앞으로 건너뛰지 못합니다).
 */
export type AutoStep =
  /** 덴트버드에서 받은 STL 을 기다립니다 (사람이 폴더에 떨어뜨립니다) */
  | 'waiting_design'
  /** 슬라이스 중 */
  | 'slicing'
  /** 출력 파일이 올라갔습니다. 치과가 베드를 비웠다고 눌러야 넘어갑니다 */
  | 'queued'
  /** 치과 PC 가 프린터로 보내는 중 */
  | 'sending'
  /** 출력 중 */
  | 'printing'
  | 'done'
  | 'failed';

export const AUTO_STEPS: readonly AutoStep[] = [
  'waiting_design',
  'slicing',
  'queued',
  'sending',
  'printing',
  'done',
  'failed',
] as const;

export function isAutoStep(v: unknown): v is AutoStep {
  return typeof v === 'string' && (AUTO_STEPS as readonly string[]).includes(v);
}

/** 앞뒤를 견줄 번호. `failed` 는 줄 밖이라 -1 입니다 */
const RANK: Record<AutoStep, number> = {
  failed: -1,
  waiting_design: 0,
  slicing: 1,
  queued: 2,
  sending: 3,
  printing: 4,
  done: 5,
};

/**
 * 치과가 보는 말.
 *
 * ★ **기공소를 입에 올리지 않습니다** (사용자 결정 2026-09-11).
 *   이 줄은 치과 주문상세에 그대로 뜹니다. 'design'·'slice' 같은
 *   속사정도 쓰지 않습니다 — 치과는 어디까지 왔는지만 알면 됩니다.
 */
const LABEL: Record<AutoStep, string> = {
  waiting_design: '디자인 준비',
  slicing: '출력 준비',
  queued: '출력 대기',
  sending: '프린터로 보내는 중',
  printing: '출력 중',
  done: '출력 완료',
  failed: '멈췄습니다',
};

export function stepLabel(step: AutoStep): string {
  return LABEL[step];
}

/** 치과 화면에 보여 줄 다섯 칸 (`failed` 는 칸이 아니라 멈춘 표시입니다) */
export const SHOWN_STEPS: readonly AutoStep[] = [
  'waiting_design',
  'slicing',
  'queued',
  'sending',
  'printing',
] as const;

export interface AutoJob {
  step: AutoStep;
  /** 치과가 '베드 비움' 을 누른 때. 안 눌렀으면 null */
  bedClearedAt: string | null;
  /** 출력 중일 때 0~100. 모르면 null */
  percent: number | null;
  /** 실패한 자리와 까닭 */
  failedAt: AutoStep | null;
  failedReason: string | null;
}

/**
 * 갈 수 있는 길.
 *
 * ★ 건너뛰기를 막습니다. 슬라이스를 안 했는데 `printing` 이 되면
 *   무엇을 출력했는지 아무도 모릅니다.
 */
const NEXT: Record<AutoStep, readonly AutoStep[]> = {
  waiting_design: ['slicing', 'failed'],
  slicing: ['queued', 'failed'],
  queued: ['sending', 'failed'],
  sending: ['printing', 'failed'],
  printing: ['done', 'failed'],
  done: [],
  /* 실패에서 나가는 길은 `retryTo` 가 정합니다 */
  failed: [],
};

export function canMove(from: AutoStep, to: AutoStep): boolean {
  return (NEXT[from] as readonly string[]).includes(to);
}

/**
 * 다시 걸면 어디로 돌아가는가.
 *
 * ★ 실패한 그 자리입니다. 사람이 고쳐 놓고 다시 거는 것이니
 *   앞으로 건너뛰게 두면 고치지 않은 채로 지나갑니다.
 */
export function retryTo(job: AutoJob): AutoStep | null {
  if (job.step !== 'failed') return null;
  if (!job.failedAt || job.failedAt === 'failed' || job.failedAt === 'done') return null;
  return job.failedAt;
}

/**
 * 치과 PC 가 이 작업을 집어갈 수 있는가.
 *
 * ★ 조건이 둘입니다 — 출력 파일이 준비됐고(`queued`),
 *   **치과가 베드를 비웠다고 눌렀어야** 합니다. 사람이 없는 곳에서
 *   전 출력물 위에 덮어 뽑는 일을 막는 유일한 잠금입니다.
 */
export function claimable(job: AutoJob): boolean {
  return job.step === 'queued' && job.bedClearedAt !== null;
}

/** 치과가 '베드 비움' 을 누를 수 있는 때인가 */
export function canClearBed(job: AutoJob): boolean {
  return job.step === 'queued' && job.bedClearedAt === null;
}

export type StepState = 'done' | 'current' | 'todo' | 'stopped';

export interface AutoProgressStep {
  key: AutoStep;
  label: string;
  state: StepState;
  /** 출력 중일 때만 숫자가 붙습니다 */
  percent?: number;
}

/**
 * 진행 줄.
 *
 * ★ exocad 때 "진행되는 상황을 알 수가 없어" 를 들었습니다 (2026-10-06).
 *   그래서 **지금 어디인지**만 말하지 않고 다섯 칸을 모두 보여 줍니다.
 * ★ 멈추면 멈춘 칸에 `stopped` 를 답니다. 조용히 지나가지 않습니다.
 */
export function autoProgress(job: AutoJob): AutoProgressStep[] {
  const stopped = job.step === 'failed' ? job.failedAt : null;
  const here = RANK[job.step];

  return SHOWN_STEPS.map((key) => {
    const rank = RANK[key];

    let state: StepState;
    if (stopped === key) state = 'stopped';
    else if (job.step === 'failed') state = rank < RANK[stopped ?? 'waiting_design'] ? 'done' : 'todo';
    else if (rank < here) state = 'done';
    else if (rank === here) state = 'current';
    else state = 'todo';

    const step: AutoProgressStep = { key, label: LABEL[key], state };

    if (key === 'printing' && state === 'current' && job.percent !== null) {
      step.percent = Math.max(0, Math.min(100, Math.round(job.percent)));
    }
    return step;
  });
}

/**
 * 치과에 한 줄로 알릴 말.
 *
 * ★ `queued` 에서 도장이 없으면 **치과가 할 일이 있다**는 뜻입니다.
 *   그 경우만 다른 말을 합니다 — 기다리면 되는 것과 눌러야 하는 것은 다릅니다.
 */
export function autoNotice(job: AutoJob): string {
  if (job.step === 'failed') {
    return job.failedReason?.trim()
      ? `멈췄습니다 — ${job.failedReason.trim()}`
      : '멈췄습니다';
  }
  if (job.step === 'queued' && job.bedClearedAt === null) {
    return '출력판을 비우고 「비웠습니다」를 눌러 주세요';
  }
  if (job.step === 'printing' && job.percent !== null) {
    return `출력 중 ${Math.round(job.percent)}%`;
  }
  return LABEL[job.step];
}

/**
 * 저절로 다시 걸어 볼 단계.
 *
 * ★ 네트워크로 오가는 두 자리만입니다. 슬라이스와 출력은
 *   한 번 실패하면 사람을 부릅니다 — 같은 실수를 되풀이하면
 *   필라멘트와 시간만 버립니다.
 */
const AUTO_RETRY: readonly AutoStep[] = ['slicing', 'sending'] as const;

export const MAX_TRIES = 3;

export function shouldAutoRetry(job: AutoJob, tries: number): boolean {
  const at = job.failedAt;
  if (job.step !== 'failed' || !at) return false;
  if (!(AUTO_RETRY as readonly string[]).includes(at)) return false;
  return tries < MAX_TRIES;
}

// ---------------------------------------------------------------- 치식 대조

/**
 * 디자인에 적힌 치식이 주문서와 맞는가.
 *
 * ★★ 덴트버드가 치식을 **알아서 잡아 줍니다.** 좋은 기능이지만, 틀렸을 때
 *   아무도 모르는 것이 위험합니다 — 엉뚱한 이의 크라운이 치과에서 그대로
 *   출력됩니다. 다행히 덴트버드가 `.constructionInfo` 에 치식을 적어 주므로
 *   **사람 눈이 아니라 기계가** 견줍니다.
 *
 * ★ **부분 납품은 됩니다.** 두 개짜리 주문에 크라운 하나만 먼저 보낼 수
 *   있습니다. 막는 것은 **주문에 없는 이**가 섞여 들어오는 경우입니다.
 *
 * ★ 치식을 못 읽었으면(빈 배열) 막지 않습니다 — 사람이 크라운만 따로
 *   옮겨 놓았을 수 있습니다. 대조를 못 했을 뿐, 틀렸다는 뜻은 아닙니다.
 *
 * 돌려주는 값: 막아야 할 까닭. 괜찮으면 null.
 */
export function teethMismatch(orderTeeth: number[], designTeeth: number[]): string | null {
  if (designTeeth.length === 0) return null;

  const inOrder = new Set(orderTeeth);
  const stray = [...new Set(designTeeth)].filter((t) => !inOrder.has(t)).sort((a, b) => a - b);
  if (stray.length === 0) return null;

  return (
    `치식이 주문서에 없습니다 — 주문서 ${[...inOrder].sort((a, b) => a - b).join('·') || '없음'} · ` +
    `디자인 ${[...designTeeth].sort((a, b) => a - b).join('·')}`
  );
}
