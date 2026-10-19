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
  // ★ '디자인 준비' 였습니다. 이제 주문을 넣자마자 이 칸에 서고 실제로 설계가
  //   돕니다(2026-10-15) — '준비' 라고 하면 아무 일도 안 일어나는 줄 압니다.
  waiting_design: '디자인',
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

/**
 * 치과 화면에 보여 줄 여섯 칸 (`failed` 는 칸이 아니라 멈춘 표시입니다).
 * ★ '완료' 칸을 더했습니다 (2026-10-15 — "출력 완료도 가시성이 떨어져").
 *   다섯 칸이 다 초록이 돼도 '끝났다' 는 칸이 없어서 눈에 안 들어왔습니다.
 */
export const SHOWN_STEPS: readonly AutoStep[] = [
  'waiting_design',
  'slicing',
  'queued',
  'sending',
  'printing',
  'done',
] as const;

/**
 * 디자인 칸 안의 잔걸음 (2026-10-15).
 *
 * ★ 단계(AutoStep)를 늘리지 않습니다. 'waiting_design' 안에서만 움직이는
 *   글자라, 되돌리기·다시 걸기 규칙을 건드릴 일이 없습니다.
 * ★ 설계 PC 의 매크로가 넘을 때마다 적습니다. 비어 있으면 아직 손 안 댄 것.
 */
export type DesignStage = 'uploading' | 'analyzing' | 'generating' | 'exporting' | 'stalled';

export const DESIGN_STAGES: readonly DesignStage[] = [
  'uploading',
  'analyzing',
  'generating',
  'exporting',
  'stalled',
] as const;

export function isDesignStage(v: unknown): v is DesignStage {
  return typeof v === 'string' && (DESIGN_STAGES as readonly string[]).includes(v);
}

/**
 * 치과가 보는 잔걸음 말.
 *
 * ★ **설계 프로그램 이름을 안 씁니다.** 치과는 어디까지 왔는지만 알면 됩니다.
 * ★ 멈춰도 '실패' 라고 안 합니다 — 센터가 붙잡고 있는 중입니다. 까닭은
 *   센터 화면(design_note)에만 뜹니다.
 */
// ★ 치과가 읽는 문장으로 (사용자 2026-10-19 — "진행상황이 보였으면"). 잔걸음 칸·책갈피 둘 다 씁니다
const DESIGN_STAGE_LABEL: Record<DesignStage, string> = {
  uploading: '스캔을 확인하고 있습니다',
  analyzing: '치아를 분석하고 있습니다',
  generating: '치아를 설계하고 있습니다',
  exporting: '설계를 마무리하고 있습니다',
  stalled: '확인 중',
};

export function designStageLabel(stage: DesignStage): string {
  return DESIGN_STAGE_LABEL[stage];
}

export interface AutoJob {
  step: AutoStep;
  /** 디자인 칸 안의 잔걸음. 디자인 칸이 아니거나 아직이면 null */
  designStage?: DesignStage | null;
  /** 일꾼이 남긴 멈춘 까닭 (원문). 치과에는 그대로 안 보이고 stallAdvice 로 바꿔 보입니다 */
  designNote?: string | null;
  /** 다 나온 때. 아직이면 null */
  finishedAt?: string | null;
  /** 프린터가 우리 파일을 돌리기 시작한 때 */
  startedAt?: string | null;
  /** 프린터가 말한 남은 분. 모르면 null — 그때는 어림합니다 */
  remainingMin?: number | null;
  /** 지금 층 / 전체 층 */
  layerNow?: number | null;
  layerTotal?: number | null;
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
 * ★★ 실패한 **그 자리가 아니라 그 일이 시작되는 자리**입니다
 *   (2026-10-12에 고쳤습니다). 전에는 failedAt 을 그대로 돌려줬는데,
 *   'sending' 에서 실패한 건을 'sending' 으로 되돌리면 **치과 PC 가
 *   집어갈 수 없습니다** — 집어가는 조건이 `queued` 라서요.
 *   다시 걸어도 아무 일이 안 일어나는 길이었습니다.
 *
 * ★ 보내다·뽑다 실패한 것은 `queued` 로 돌아갑니다. 파일은 이미
 *   올라가 있으니 자르기부터 다시 할 이유가 없습니다.
 * ★ 자르다 실패한 것은 `waiting_design` 입니다 — 디자인 파일부터
 *   다시 받아야 합니다.
 */
const RETRY_FROM: Record<AutoStep, AutoStep | null> = {
  waiting_design: 'waiting_design',
  slicing: 'waiting_design',
  queued: 'queued',
  sending: 'queued',
  printing: 'queued',
  done: null,
  failed: null,
};

export function retryTo(job: AutoJob): AutoStep | null {
  if (job.step !== 'failed') return null;
  if (!job.failedAt) return null;
  return RETRY_FROM[job.failedAt];
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

/**
 * 같은 디자인을 다시 뽑을 수 있는가 (사용자 요청 2026-10-15 — 깨짐·분실·하나 더).
 *
 * ★ **다 나온 것만.** 출력 파일이 이미 있으니 자르기도 설계도 다시 안 합니다 —
 *   '출력 대기' 로 돌아가 출력판 확인부터 다시 돕니다.
 * ★ 멈춘 것은 「다시 걸기」 (retryTo) 가 맡습니다. 길이 다릅니다.
 * ★ 횟수를 막지 않습니다. PLA 몇 그램과 10분이라. 대신 몇 번인지 남깁니다 —
 *   같은 건을 자꾸 다시 뽑으면 디자인을 고쳐야 한다는 신호입니다.
 */
/**
 * 디자인이 멈춘 까닭을 **치과 말로** — 무엇이 문제이고(what) 무엇을 하면 되는지(todo).
 * (사용자 지적 2026-10-19 — "어떤 오류인지도, 뭘 해야 할지도 안 알려준다")
 *
 * ★ 일꾼의 원문(design_note)은 센터용입니다 — 설계 도구 이름·화면 상태 같은 내부 말이 섞여
 *   치과에 그대로 보이면 안 됩니다. 여기서 **정해진 문장**으로만 바꿉니다. 모르는 까닭은
 *   "센터가 보고 있습니다" 로 — 틀린 안내보다 조용한 쪽이 낫습니다.
 * ★ todo 는 치과가 **실제로 할 수 있는 것**만 적습니다: 스캔 다시 올리기, FlowTemp 그만두기, 기다리기.
 */
export interface StallAdvice {
  what: string;
  todo: string;
}

export function stallAdvice(note: string | null | undefined): StallAdvice {
  // ★ 짧게 — 책갈피 한 줄에 들어가야 합니다 (사용자 2026-10-19 "설명이 너무 길어")
  const n = (note ?? '').trim();
  if (/치식을 못 읽|프렙|지대치|깎은/.test(n)) {
    return { what: '자연치가 아닙니다', todo: '임플란트는 추후 업데이트 됩니다' };
  }
  if (/건수|횟수|차감|credit/i.test(n)) {
    return { what: '이번 달 설계 건수를 다 썼습니다', todo: '센터가 처리합니다' };
  }
  if (/다운로드|download/i.test(n)) {
    return { what: '설계 PC 설정이 필요합니다', todo: '센터가 처리합니다' };
  }
  if (/로그인|session|세션/i.test(n)) {
    return { what: '설계 PC 점검 중입니다', todo: '센터가 처리합니다' };
  }
  if (/올라오지|내보낸 뒤|배달|deliver/i.test(n)) {
    return { what: '설계 파일이 안 올라왔습니다', todo: '센터가 다시 겁니다' };
  }
  if (/시험|--no-export/.test(n)) {
    return { what: '시험 건입니다', todo: '센터가 정리합니다' };
  }
  return { what: '디자인이 늦어집니다', todo: '센터가 보고 있습니다' };
}

export function canReprint(job: AutoJob): boolean {
  return job.step === 'done';
}

/**
 * 치과가 ✕ 로 치울 수 있는가 — **FlowTemp 그만두기** (사용자 지적 2026-10-19 "UI 출구가 없네").
 *
 * ★ 전에는 다 나온 것만 치웠습니다. 그러자 디자인이 멈추거나 출력이 실패한 건은
 *   치과 화면에 빨갛게 **영원히** 남고, 치과가 할 수 있는 게 없었습니다 — 다시 걸기는
 *   센터 몫이라서요. 멈춘 건·실패한 건도 치과가 "임시치아는 그만두겠다" 고 할 수 있어야
 *   합니다. 크라운 주문은 그대로 갑니다 — 치우는 건 FlowTemp 줄뿐입니다.
 * ★ 돌고 있는 것(디자인 중·출력 중)은 못 치웁니다 — 프린터가 뽑는 중에 사라지면 안 됩니다.
 */
export function canDismiss(job: AutoJob): boolean {
  if (job.step === 'done' || job.step === 'failed') return true;
  return job.step === 'waiting_design' && job.designStage === 'stalled';
}

export type StepState = 'done' | 'current' | 'todo' | 'stopped';

export interface AutoProgressStep {
  key: AutoStep;
  label: string;
  state: StepState;
  /** 출력 중일 때만 숫자가 붙습니다 */
  percent?: number;
  /** 디자인 칸에서 지금 하는 잔걸음 — '치아 분석' 처럼 */
  detail?: string;
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
    if (job.step === 'done') state = 'done';
    else if (stopped === key) state = 'stopped';
    else if (job.step === 'failed') state = rank < RANK[stopped ?? 'waiting_design'] ? 'done' : 'todo';
    else if (rank < here) state = 'done';
    else if (rank === here) state = 'current';
    else state = 'todo';

    const step: AutoProgressStep = { key, label: LABEL[key], state };

    if (key === 'printing' && state === 'current' && job.percent !== null) {
      step.percent = Math.max(0, Math.min(100, Math.round(job.percent)));
    }
    if (key === 'waiting_design' && state === 'current' && job.designStage) {
      step.detail = DESIGN_STAGE_LABEL[job.designStage];
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
  if (job.step === 'waiting_design') {
    if (job.designStage === 'stalled') {
      const a = stallAdvice(job.designNote);
      return `디자인 멈춤 — ${a.what}. ${a.todo}`;
    }
    if (job.designStage) return `디자인 중 — ${DESIGN_STAGE_LABEL[job.designStage]}`;
    return '디자인 차례를 기다립니다';
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

// ---------- 떨어진 파일이 어느 주문 것인가 ----------
//
// ★★ **왜 — 여기가 마지막 사람 손입니다** (2026-10-14). 덴트버드에서 받은
//   STL 을 사람이 **창에서 골라** 줘야 했습니다. 다른 자리는 다 자동인데
//   그 한 번 때문에 사람이 PC 앞에 있어야 합니다. 폴더에 떨어진 파일이
//   어느 주문 것인지 기계가 정할 수 있으면 그 손이 없어집니다.
//
// ★ 고를 재료는 **치식**입니다. 덴트버드가 `.constructionInfo` 에 적어 주고
//   (dentbird_case.py), 이미 그 값으로 서버가 주문서와 대조하고 있습니다.
//   같은 재료를 '막는 데' 말고 '찾는 데' 도 씁니다.

export interface WaitingJob {
  orderId: string;
  /** 그 주문의 치식 */
  teeth: number[];
}

export type Matched =
  | { ok: true; orderId: string }
  | { ok: false; why: string };

/**
 * 치식으로 기다리는 주문 하나를 고릅니다.
 *
 * ★★ **둘이면 멈춥니다.** 같은 치식으로 기다리는 주문이 둘이면 어느
 *   환자 것인지 알 길이 없습니다. 반쯤 맞는 것으로 고르면 **엉뚱한 이의
 *   크라운이 치과에서 그대로 출력됩니다.** 멈춰서 사람이 고르게 두는
 *   쪽이 훨씬 쌉니다.
 * ★★ **치식을 못 읽었으면 안 고릅니다.** `teethMismatch` 는 못 읽은 것을
 *   통과시키지만(대조를 못 했을 뿐이니까), **찾는 데는 다릅니다** —
 *   아무 근거 없이 하나를 집는 셈이 됩니다.
 * ★ 주문에 든 이를 **모두 덮어야** 고릅니다. 부분 납품은 사람이 창에서
 *   고르면 되고, 자동으로는 하지 않습니다 — 두 개짜리 주문의 첫 크라운이
 *   떨어졌을 때 그걸 '그 주문' 으로 잡아 출력까지 보내면 나머지 하나가
 *   영영 안 나옵니다.
 */
export function matchWaiting(jobs: WaitingJob[], designTeeth: number[]): Matched {
  const want = [...new Set(designTeeth)].sort((a, b) => a - b);
  if (want.length === 0) {
    return { ok: false, why: '디자인에서 치식을 못 읽었습니다' };
  }

  const same = (a: number[]) => {
    const b = [...new Set(a)].sort((x, y) => x - y);
    return b.length === want.length && b.every((t, i) => t === want[i]);
  };

  const hit = jobs.filter((j) => same(j.teeth));

  if (hit.length === 1) return { ok: true, orderId: hit[0].orderId };
  if (hit.length === 0) {
    return { ok: false, why: `치식 ${want.join('·')} 로 기다리는 주문이 없습니다` };
  }
  return {
    ok: false,
    why: `치식 ${want.join('·')} 로 기다리는 주문이 ${hit.length}건입니다 — 사람이 골라 주세요`,
  };
}

// ---------- 치과에 알릴 때 (2026-10-15) ----------
//
// ★ **치과가 손댈 일이 생길 때만** 알립니다 (사용자 결정 2026-10-15 — 아이디어 4번).
//   단계마다 울리면 시끄러워서 결국 꺼 둡니다. 둘뿐입니다.
//     bed  — 출력 파일이 준비됐는데 출력판 확인을 기다립니다
//     done — 다 나왔습니다. 꺼내야 다음 것을 뽑습니다
// ★ 설계 프로그램·기공소 이야기를 안 합니다. 제품 이름은 표에서 읽어 넘깁니다.

// ★ 'failed' 를 더했습니다 (2026-10-16 점검) — 출력이 멈추면 치과가 손댈 일입니다.
//   책갈피가 빨개지는 것만으로는 화면을 안 보고 있는 치과가 모릅니다.
export type AutoAlertKind = 'bed' | 'done' | 'failed';

export interface AutoAlert {
  title: string;
  body: string;
}

export function autoAlert(
  kind: AutoAlertKind,
  input: { orderNo: string; patientLabel: string; productName: string; reason?: string | null },
): AutoAlert {
  const who = `${input.orderNo} · ${input.patientLabel}`;
  if (kind === 'failed') {
    return {
      title: `${input.productName} 출력이 멈췄습니다 — 확인해 주세요`,
      body: `${who} — ${input.reason?.trim() || '프린터를 확인하고 「다시 걸기」를 눌러 주세요'}`,
    };
  }
  if (kind === 'bed') {
    return {
      title: `${input.productName} 출력 준비 — 출력판을 비워 주세요`,
      body: `${who} — 비우고 「비웠습니다」를 누르면 시작합니다`,
    };
  }
  return {
    title: `${input.productName} 다 나왔습니다 — 꺼내 주세요`,
    body: `${who} — 꺼내야 다음 출력을 걸 수 있습니다`,
  };
}

/** 단계가 이렇게 넘어가면 알릴 것. 없으면 null */
export function alertOnMove(from: AutoStep, to: AutoStep): AutoAlertKind | null {
  if (to === 'queued' && from !== 'queued') return 'bed';
  if (to === 'done' && from !== 'done') return 'done';
  // ★ 치과 쪽(보내기·출력)에서 멈춘 것만 치과에 — 자르기 실패는 센터 일입니다
  if (to === 'failed' && (from === 'sending' || from === 'printing' || from === 'queued')) return 'failed';
  return null;
}

// ---------- 치과 책갈피 (2026-10-15) ----------
//
// ★ 사용자 요청 — "DenFlow 모든 화면에서 오른쪽 책갈피처럼 접어두고, 펼치면
//   환자 이름 / 상태값 / 진행률. 오류면 오류라고". 주문 상세에 들어가야만
//   보이던 진행을, 어느 화면에서든 한눈에.
// ★ 한 줄이 무엇을 말할지는 여기서 정합니다. 화면은 늘어놓기만.

/**
 * 줄의 성격 — 색이 됩니다.
 *   error    빨강. 멈췄습니다
 *   action   파랑. **치과가 손댈 차례** (출력판 비우기 · 꺼내기)
 *   delay    주황. 늦어지는 중 (디자인 확인 중) — 치과가 할 일은 없습니다
 *   progress 회청. 기다리면 됩니다
 *   done     초록. 다 나왔습니다 — 꺼냈는지는 모르니 '할 일' 로 붙잡지 않습니다
 *            (6시간 내내 탭이 파랗게 서 있으면 이미 꺼낸 사람에게 거짓말이 됩니다)
 */
export type BoardTone = 'error' | 'action' | 'delay' | 'progress' | 'done';

export interface BoardRow {
  tone: BoardTone;
  /** 짧은 상태 — '출력 중' · '오류' 처럼 */
  status: string;
  /** 한 줄 설명 — 무엇을 하면 되는지, 무엇이 일어나는지 */
  detail: string;
  /** 전체 길에서 어디쯤인가 0~100 — 막대 길이 */
  overall: number;
  /** 출력 중일 때의 실제 퍼센트. 아니면 null */
  percent: number | null;
  /** 여기서 바로 「비웠습니다」 를 누를 수 있는가 */
  canClearBed: boolean;
  /** 여기서 바로 「다시 뽑기」 를 누를 수 있는가 */
  canReprint: boolean;
  /** ✕ 로 치울 수 있는가 — 다 나온 것·멈춘 것·실패한 것 (FlowTemp 그만두기) */
  canDismiss: boolean;
  /** 다 나온 때 (ISO). 완료가 아니면 null */
  finishedAt: string | null;
  /** 출력 중 — 남은 분 (프린터 값, 없으면 어림). 모르면 null */
  remainingMin: number | null;
  /** 출력 중 — 끝날 때 (ISO). 모르면 null */
  etaAt: string | null;
  /** 출력 중 — 층 */
  layerNow: number | null;
  layerTotal: number | null;
}

/**
 * 남은 분 (사용자 요청 2026-10-15 — "남은 시간은 안 보여주네").
 *
 * ★ 프린터가 말한 값이 먼저입니다 — 예열·마지막
 *   층까지 셈한 값이라 가장 맞습니다.
 * ★ 없으면 **지난 시간과 퍼센트로 어림합니다.** 옛 치과 PC 는 그 값을 안
 *   올리고, 프린터가 잠깐 말을 안 할 때도 있습니다. 3% 전에는 어림이 크게
 *   흔들려서 안 합니다.
 */
export function remainingOf(job: AutoJob, now: number): number | null {
  if (job.step !== 'printing') return null;
  if (typeof job.remainingMin === 'number' && job.remainingMin >= 0) return Math.round(job.remainingMin);
  const p = job.percent;
  if (!job.startedAt || p === null || p < 3 || p >= 100) return null;
  const elapsedMin = (now - new Date(job.startedAt).getTime()) / 60000;
  if (!(elapsedMin > 0)) return null;
  return Math.max(1, Math.round((elapsedMin * (100 - p)) / p));
}

/** '약 7분 남음' · 1분 아래는 '곧 끝납니다' */
export function remainingLabel(min: number): string {
  if (min <= 1) return '곧 끝납니다';
  if (min < 60) return `약 ${min}분 남음`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `약 ${h}시간 ${m}분 남음` : `약 ${h}시간 남음`;
}

/**
 * 전체 길에서의 자리. 디자인 7분 · 출력 10분쯤이라 출력에 가장 많이 줍니다.
 * ★ 디자인 잔걸음도 칸을 나눠 줍니다 — 7분 동안 막대가 안 움직이면 멈춘 줄 압니다.
 */
const OVERALL: Record<AutoStep, number> = {
  waiting_design: 2,
  slicing: 32,
  queued: 38,
  sending: 42,
  printing: 45,
  done: 100,
  failed: 0,
};
const DESIGN_OVERALL: Record<DesignStage, number> = {
  uploading: 6,
  analyzing: 12,
  generating: 20,
  exporting: 28,
  stalled: 12,
};

function overallOf(job: AutoJob): number {
  if (job.step === 'printing' && job.percent !== null) {
    // 출력 45 → 99 사이를 실제 퍼센트로 채웁니다
    return Math.min(99, 45 + Math.round((Math.max(0, Math.min(100, job.percent)) * 54) / 100));
  }
  if (job.step === 'waiting_design' && job.designStage) return DESIGN_OVERALL[job.designStage];
  if (job.step === 'failed') return job.failedAt ? OVERALL[job.failedAt] : 0;
  return OVERALL[job.step];
}

export function boardRow(job: AutoJob, now: number = Date.now()): BoardRow {
  const overall = overallOf(job);
  const remaining = remainingOf(job, now);
  const printing = job.step === 'printing';
  const base = {
    overall,
    percent: null as number | null,
    canClearBed: false,
    canReprint: canReprint(job),
    canDismiss: canDismiss(job),
    finishedAt: job.step === 'done' ? (job.finishedAt ?? null) : null,
    remainingMin: remaining,
    etaAt: remaining === null ? null : new Date(now + remaining * 60000).toISOString(),
    layerNow: printing ? (job.layerNow ?? null) : null,
    layerTotal: printing ? (job.layerTotal ?? null) : null,
  };

  if (job.step === 'failed') {
    return {
      ...base,
      tone: 'error',
      status: '오류',
      detail: job.failedReason?.trim() || `${LABEL[job.failedAt ?? 'waiting_design']} 단계에서 멈췄습니다`,
    };
  }
  if (job.step === 'waiting_design') {
    if (job.designStage === 'stalled') {
      // ★ 까닭과 할 일을 치과 말로 (2026-10-19 — "어떤 오류인지도 뭘 해야 할지도 안 알려준다")
      const a = stallAdvice(job.designNote);
      return { ...base, tone: 'delay', status: '디자인 멈춤', detail: `${a.what}. ${a.todo}` };
    }
    return {
      ...base,
      tone: 'progress',
      status: '디자인 중',
      detail: job.designStage ? DESIGN_STAGE_LABEL[job.designStage] : '차례를 기다립니다',
    };
  }
  if (job.step === 'queued' && job.bedClearedAt === null) {
    return { ...base, tone: 'action', status: '출력 준비됨', detail: '출력판을 비우고 「비웠습니다」를 눌러 주세요', canClearBed: true };
  }
  if (job.step === 'done') {
    return { ...base, tone: 'done', status: '출력 완료', detail: '다 나왔습니다 — 꺼내 주세요' };
  }
  if (job.step === 'printing') {
    const p = job.percent === null ? null : Math.max(0, Math.min(100, Math.round(job.percent)));
    // ★ 남은 시간이 첫째, 층은 둘째 — 치과가 궁금한 것은 '언제 끝나나' 입니다
    const bits = [
      remaining !== null ? remainingLabel(remaining) : null,
      base.layerNow && base.layerTotal ? `${base.layerNow}/${base.layerTotal}층` : null,
    ].filter(Boolean);
    return {
      ...base,
      tone: 'progress',
      status: '출력 중',
      detail: bits.length ? bits.join(' · ') : '프린터가 뽑고 있습니다',
      percent: p,
    };
  }
  // slicing · queued(비움 확인됨) · sending
  const detail: Record<string, string> = {
    slicing: '출력 파일을 만들고 있습니다',
    queued: '곧 프린터로 보냅니다',
    sending: '프린터로 보내고 있습니다',
  };
  return { ...base, tone: 'progress', status: '출력 준비', detail: detail[job.step] ?? LABEL[job.step] };
}

/** 접힌 탭의 색 — 가장 급한 줄을 따릅니다 (오류 > 할 일 > 지연 > 진행 > 완료) */
export function boardTone(rows: BoardTone[]): BoardTone | null {
  for (const t of ['error', 'action', 'delay', 'progress', 'done'] as const) {
    if (rows.includes(t)) return t;
  }
  return null;
}

/**
 * 끝난 것을 얼마나 남겨 둘까. 꺼내 달라는 말이 보여야 하지만, 하루 종일
 * 남아 있으면 책갈피가 지난 일로 찹니다.
 */
export const BOARD_DONE_HOURS = 6;

// ---------- 설계 PC 일꾼 — 다음 일감 (2026-10-15) ----------
//
// ★ 사용자 중간점검 — "에이전트 하나로 디자인부터 출력까지 원격으로 되는 거 맞지?"
//   아니었습니다. 새 FlowTemp 주문을 알아채 매크로를 거는 손이 없었습니다.
//   설계 PC 가 서버에 일감을 묻고, 하나씩 잡아 갑니다.

/** 일꾼이 손을 놓고 사라졌다고 보는 시간. 이보다 오래 소식이 없으면 다시 줍니다 */
export const DESIGN_CLAIM_STALE_MINUTES = 30;

export interface DesignCandidate {
  orderStatus: string;
  step: AutoStep;
  designStage: DesignStage | null;
  /** 작업 줄이 마지막으로 바뀐 때 (ISO) */
  updatedAt: string;
  /** 다 올라온 스캔 파일 수 */
  scanCount: number;
}

/**
 * 이 주문을 일꾼에게 줄 수 있는가.
 *
 * ★ 디자인 차례이고, 스캔이 **다 올라왔고**(주문이 '업로드중' 이 아님),
 *   아무도 안 잡았거나 잡은 지 오래 소식이 없을 때만.
 * ★ '확인 중'(stalled) 은 **안 줍니다.** 사람이 볼 차례입니다 — 다시 주면
 *   같은 데서 또 멈추고 덴트버드 건수만 씁니다.
 * ★ 취소·완료된 주문은 안 줍니다.
 */
export function canHandDesign(c: DesignCandidate, now: number): boolean {
  if (c.step !== 'waiting_design') return false;
  if (['uploading', 'cancelled', 'completed'].includes(c.orderStatus)) return false;
  if (c.scanCount === 0) return false;
  if (c.designStage === 'stalled') return false;
  /*
    ★★ '마무리'(내보냄) 는 **묵어도 다시 안 줍니다** (2026-10-16 점검). 내보낸 뒤
      네트워크가 끊겨 소식이 없을 때 다시 주면, 처음부터 설계해 **덴트버드 건수를
      또 씁니다.** 30분 넘게 안 올라오면 감시(auto_jobs_watchdog)가 '확인 중'
      으로 세워 사람이 봅니다.
  */
  if (c.designStage === 'exporting') return false;
  if (c.designStage === null) return true;
  const age = (now - new Date(c.updatedAt).getTime()) / 60000;
  return age >= DESIGN_CLAIM_STALE_MINUTES;
}

/** 치식이 위턱인가 (1x·2x 위, 3x·4x 아래) */
export function isUpperTooth(tooth: number): boolean {
  const q = Math.floor(tooth / 10);
  return q === 1 || q === 2 || q === 5 || q === 6;
}

// ---------- 기기가 켜져 있나 (2026-10-16 점검) ----------
//
// ★ 사용자 — "어느 쪽에서 오류가 날 것 같은지, 네트워크 연결 쪽은".
//   치과 PC 가 꺼져 있으면 책갈피가 '곧 프린터로 보냅니다' 만 하염없이 보였습니다.
//   기기는 몇 초마다 서버에 묻고(last_seen_at), 그게 끊기면 꺼진 것입니다.

/** 이만큼 소식이 없으면 꺼진 것으로 봅니다. 치과 PC 는 10초, 설계 PC 는 3~30초마다 묻습니다 */
export const DEVICE_OFFLINE_SECONDS = 180;

export function deviceOnline(lastSeenAt: string | null | undefined, now: number): boolean {
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() < DEVICE_OFFLINE_SECONDS * 1000;
}

/**
 * 치과 PC 가 꺼져 있을 때 책갈피 줄을 고쳐 씁니다.
 *
 * ★ 치과 PC 가 일해야 하는 자리만 — 비움 확인 뒤 대기·보내는 중·출력 중.
 *   출력판을 비워 달라는 것(치과가 할 일)과 끝난 것은 그대로 둡니다.
 * ★ 출력 중에 끊겼으면 **프린터는 계속 뽑고 있을 수 있다** 고 말합니다.
 *   실패라고 단정하지 않습니다 — 와이파이가 잠깐 끊긴 것일 수 있습니다.
 */
export function withClinicPc(row: BoardRow, job: AutoJob, online: boolean): BoardRow {
  if (online) return row;
  const waitsPc =
    (job.step === 'queued' && job.bedClearedAt !== null) || job.step === 'sending' || job.step === 'printing';
  if (!waitsPc) return row;
  return {
    ...row,
    tone: 'delay',
    status: '치과 PC 꺼짐',
    detail:
      job.step === 'printing'
        ? '덴플로우 에이전트 소식이 없습니다 — 프린터는 계속 뽑고 있을 수 있습니다'
        : '덴플로우 에이전트가 꺼져 있어 출력을 못 보냅니다 — PC 와 에이전트를 켜 주세요',
  };
}
