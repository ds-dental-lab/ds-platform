// =========================================================
// 놓을 위치: src/server/domain/progress/index.ts
//
// 주문이 지금 어디까지 왔는가. (사용자 요청 2026-08-13 —
//   "수거 대기 / 수거 중 / 수거완료 / 작업중 / 배송중 으로 상태가
//    나뉘었으면 좋겠어. 치과입장에서도 과정을 알아야하잖아?")
//
// ★ 상태 하나만으로는 과정이 안 보입니다.
//   머리줄의 '제작대기' 는 **지금** 어디인지만 말합니다. 치과가 알고
//   싶은 것은 "어디까지 왔고 다음이 무엇인가" 입니다. 특히 리페어는
//   물건이 오가는 동안 상태가 '제작대기' 에 한참 머물러 있어서,
//   그것만 보면 아무 일도 안 일어나는 것처럼 보입니다.
//
// ★ 수거는 주문 상태에 안 담깁니다.
//   수거대기·수거중·수거완료는 pickup_requests 에 있고 orders 에는
//   없습니다. 그래서 둘을 합쳐야 과정이 됩니다 — 이 파일이 그 일을
//   합니다. 어느 쪽도 모르는 순수 함수라 테스트로 고정합니다.
// =========================================================

import type { OrderStatus } from '../order-status';

export type StepState = 'done' | 'current' | 'todo';

export interface ProgressStep {
  key: string;
  label: string;
  state: StepState;
}

/**
 * 상태를 앞뒤로 견줄 수 있게 번호를 매깁니다.
 *
 * ★ 재스캔은 접수와 같은 자리입니다. 뒤로 간 것이 아니라 **접수 단계에
 *   머물러 있는 것**입니다 — 치과가 다시 올리면 접수로 돌아옵니다.
 */
const RANK: Record<OrderStatus, number> = {
  cancelled: -1,
  /*
    ★ 접수와 같은 자리입니다. 뒤로 간 것이 아니라 **접수 칸에 아직
      도착하지 못한 것**입니다 — 재스캔과 같은 이치입니다.

    ★★ 음수를 주면 안 됩니다. 아래에서 `rank < 0` 을 **취소**로
      보기 때문에, 업로드중인 주문이 '취소' 로 그려집니다.
      실제로 -0.5 를 넣었다가 그렇게 됐습니다.
  */
  uploading: 0,
  rescan: 0,
  received: 0,
  designing: 1,
  production_wait: 2,
  production: 3,
  shipping: 4,
  completed: 5,
};

/** 수거가 어디까지 왔나. 여러 건이면 **제일 덜 온 것**을 따릅니다 */
export type PickupPhase = 'open' | 'assigned' | 'done';

export function pickupPhase(pickups: { status: string }[]): PickupPhase | null {
  const live = pickups.filter((p) => p.status !== 'cancelled');
  if (live.length === 0) return null;

  /*
    ★ 하나라도 안 왔으면 안 온 것입니다.
      두 개를 가져가야 하는데 하나만 받고 '수거완료' 라고 적으면,
      나머지 하나를 기다리는 사람이 없어집니다.
  */
  if (live.some((p) => p.status === 'open')) return 'open';
  if (live.some((p) => p.status === 'assigned')) return 'assigned';
  return 'done';
}

export interface ProgressInput {
  status: OrderStatus;
  /** 리페어는 접수·디자인 단계를 지나지 않습니다 */
  isRepair: boolean;
  pickups: { status: string }[];
}

/**
 * 지금 단계를 **고객의 말**로 한 줄. (사용자 요청 2026-08-13 —
 *   "치과는 작업하는 사람들이 아니고 고객이니깐 과정만 확인할뿐")
 *
 * ★ 치과에게는 '수거대기' 같은 우리 말이 안 통합니다.
 *   그건 우리가 일을 나누려고 만든 이름입니다. 치과가 알고 싶은 것은
 *   "내 환자 것이 지금 어떻게 되고 있나" 하나뿐입니다.
 *
 * ★ 시킬 일을 적지 않습니다.
 *   치과는 여기서 누를 것이 없습니다. "~해 주세요" 를 적으면 자기가
 *   뭔가 해야 하는 줄 알고 버튼을 찾습니다.
 */
const NOTE: Record<string, string> = {
  received: '접수되었습니다. 곧 디자인을 시작합니다.',
  designing: '디자인 작업 중입니다.',
  production_wait: '기공소에 제작을 넘겼습니다.',
  pickup_wait: '보철물을 가지러 갈 예정입니다.',
  pickup_moving: '수거 중입니다. 곧 기공소에 도착합니다.',
  pickup_done: '보철물을 받았습니다. 곧 제작을 시작합니다.',
  production: '기공소에서 만들고 있습니다.',
  shipping: '제작이 끝나 배송 중입니다.',
  completed: '완료되었습니다.',
  cancelled: '취소된 주문입니다.',
};

export function progressNote(steps: ProgressStep[]): string {
  const current = steps.find((s) => s.state === 'current');
  return current ? (NOTE[current.key] ?? '') : '';
}

export function orderProgress(input: ProgressInput): ProgressStep[] {
  const rank = RANK[input.status];

  // 취소된 주문은 과정이 없습니다. 거기서 멈춘 것입니다
  if (rank < 0) {
    return [{ key: 'cancelled', label: '취소', state: 'current' }];
  }

  /*
    ★ 업로드중은 **접수 앞에 칸 하나를 더 세웁니다** (작업지시서 §3-3).
      접수를 '지금' 으로 켜면 이미 접수된 것처럼 보입니다 — 파일이
      아직 다 안 왔는데요. 무엇을 기다리는 중인지가 보여야 합니다.
  */
  if (input.status === 'uploading') {
    return [
      { key: 'uploading', label: '업로드중', state: 'current' },
      { key: 'received', label: '접수', state: 'todo' },
      ...(input.isRepair ? [] : [{ key: 'designing', label: '디자인', state: 'todo' as const }]),
      { key: 'production_wait', label: '제작대기', state: 'todo' },
      { key: 'production', label: '작업중', state: 'todo' },
      { key: 'shipping', label: '배송중', state: 'todo' },
      { key: 'completed', label: '완료', state: 'todo' },
    ];
  }

  const phase = pickupPhase(input.pickups);

  const planned: { key: string; label: string; done: boolean }[] = [];

  // ★ 리페어는 디자인을 거치지 않습니다. 없는 칸을 '완료' 로 찍으면 거짓말입니다
  if (!input.isRepair) {
    planned.push(
      { key: 'received', label: '접수', done: rank >= 1 },
      { key: 'designing', label: '디자인', done: rank >= 2 },
    );
  }

  if (phase) {
    /*
      ★ 수거가 있는 건은 '제작대기' 를 세 칸으로 펼칩니다.
        그 주문에게 제작대기란 곧 **물건을 기다리는 중**이라는 뜻이고,
        기다림의 어디쯤인지가 치과가 제일 궁금해하는 대목입니다.

      ★ '수거완료' 는 물건을 받았는데 아직 시작은 안 한 칸입니다.
        받자마자 제작으로 넘어가는 것이 보통이라 이 칸에 머무는 시간은
        짧지만, 남은 수거가 있으면 여기서 기다립니다.
    */
    planned.push(
      { key: 'pickup_wait', label: '수거대기', done: phase !== 'open' },
      { key: 'pickup_moving', label: '수거중', done: phase === 'done' },
      { key: 'pickup_done', label: '수거완료', done: phase === 'done' && rank >= 3 },
    );
  } else {
    planned.push({ key: 'production_wait', label: '제작대기', done: rank >= 3 });
  }

  planned.push(
    { key: 'production', label: '작업중', done: rank >= 4 },
    { key: 'shipping', label: '배송중', done: rank >= 5 },
    { key: 'completed', label: '완료', done: rank >= 5 },
  );

  /*
    ★ '지금' 은 아직 안 끝난 첫 칸입니다.
      상태로 직접 찍지 않습니다 — 수거처럼 주문 상태 밖에서 움직이는
      칸이 섞여 있어, 한 군데서 정하지 않으면 두 칸이 동시에 켜집니다.
  */
  const currentIndex = planned.findIndex((step) => !step.done);

  return planned.map((step, i) => ({
    key: step.key,
    label: step.label,
    state:
      currentIndex === -1
        ? // 다 끝났으면 마지막 칸이 '지금' 입니다
          i === planned.length - 1
          ? 'current'
          : 'done'
        : i < currentIndex
          ? 'done'
          : i === currentIndex
            ? 'current'
            : 'todo',
  }));
}
