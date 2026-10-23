// =========================================================
// 놓을 위치: tests/domain/auto-print.test.ts
// 기준: 사용자 요청 2026-10-06 — "전체적으로 연결이 원활하게 되는지가 중요해"
//
// ★ 고리가 다섯입니다 (기공소 사람 → 기공소 PC → 서버 → 치과 PC → 프린터).
//   고리가 많은 길에서 가장 무서운 것은 **끊긴 줄 모르고 지나가는 것**입니다.
//   그래서 여기서 못 박는 것은 "잘 되는 경우" 가 아니라 **건너뛰지 못한다**는
//   것과 **멈추면 멈춘 자리가 보인다**는 것입니다.
//
// ★ 프린터 기종은 아직 없습니다. 이 시험에도 기종이 없습니다 —
//   기종이 정해져도 이 파일은 그대로여야 맞습니다.
// =========================================================

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  AUTO_STEPS,
  SHOWN_STEPS,
  MAX_TRIES,
  alertOnMove,
  alertPushes,
  typicalPrintSeconds,
  pausedReason,
  PAUSE_MARK,
  autoAlert,
  autoNotice,
  boardRow,
  boardTone,
  canReprint,
  canDismiss,
  stallAdvice,
  stallKind,
  designVerdict,
  GIVE_UP_MESSAGE,
  DESIGN_AUTO_RETRIES,
  DESIGN_RETRY_AFTER_MINUTES,
  remainingLabel,
  remainingOf,
  canHandDesign,
  isUpperTooth,
  deviceOnline,
  withClinicPc,
  autoProgress,
  canClearBed,
  canMove,
  claimable,
  isAutoStep,
  retryTo,
  shouldAutoRetry,
  stepLabel,
  teethMismatch,
  type AutoJob,
  type AutoStep,
} from '@/server/domain/auto-print';

const job = (over: Partial<AutoJob> = {}): AutoJob => ({
  step: 'waiting_design',
  bedClearedAt: null,
  percent: null,
  failedAt: null,
  failedReason: null,
  ...over,
});

describe('길은 한 방향입니다', () => {
  it('정해진 다음 자리로만 갑니다', () => {
    expect(canMove('waiting_design', 'slicing')).toBe(true);
    expect(canMove('slicing', 'queued')).toBe(true);
    expect(canMove('queued', 'sending')).toBe(true);
    expect(canMove('sending', 'printing')).toBe(true);
    expect(canMove('printing', 'done')).toBe(true);
  });

  it('건너뛰지 못합니다', () => {
    // ★ 슬라이스를 안 했는데 출력으로 가면 무엇을 뽑았는지 아무도 모릅니다
    expect(canMove('waiting_design', 'printing')).toBe(false);
    expect(canMove('waiting_design', 'queued')).toBe(false);
    expect(canMove('slicing', 'printing')).toBe(false);
    expect(canMove('queued', 'printing')).toBe(false);
    expect(canMove('queued', 'done')).toBe(false);
  });

  it('뒤로 가지 못합니다', () => {
    expect(canMove('printing', 'sending')).toBe(false);
    expect(canMove('queued', 'slicing')).toBe(false);
    expect(canMove('done', 'printing')).toBe(false);
  });

  it('어느 자리에서든 멈출 수는 있습니다', () => {
    for (const step of ['waiting_design', 'slicing', 'queued', 'sending', 'printing'] as const) {
      expect(canMove(step, 'failed')).toBe(true);
    }
  });

  it('끝난 것은 더 가지 않습니다', () => {
    for (const to of AUTO_STEPS) expect(canMove('done', to)).toBe(false);
  });
});

describe('다시 걸면 그 일이 시작되는 자리로 돌아갑니다', () => {
  /*
    ★★ 2026-10-12 에 고쳤습니다. 전에는 failedAt 을 **그대로** 돌려줬는데,
      'sending' 에서 실패한 건을 'sending' 으로 되돌리면 치과 PC 가
      집어갈 수 없습니다 — 집어가는 조건이 `queued` 이기 때문입니다.
      다시 걸어도 아무 일이 안 일어나는 길이었습니다.
  */
  it('★ 보내다 실패한 것은 집어갈 수 있는 자리로 돌아갑니다', () => {
    expect(retryTo(job({ step: 'failed', failedAt: 'sending' }))).toBe('queued');
    expect(retryTo(job({ step: 'failed', failedAt: 'printing' }))).toBe('queued');
  });

  // ★ 자르다 실패한 것은 디자인 파일부터 다시 받아야 합니다
  it('★ 자르다 실패한 것은 처음으로', () => {
    expect(retryTo(job({ step: 'failed', failedAt: 'slicing' }))).toBe('waiting_design');
  });

  it('앞으로 건너뛰지 않습니다', () => {
    // 'queued' 에서 멈춘 것은 자르기를 다시 할 이유가 없습니다
    expect(retryTo(job({ step: 'failed', failedAt: 'queued' }))).toBe('queued');
  });

  it('멈추지 않은 작업은 다시 걸 것이 없습니다', () => {
    expect(retryTo(job({ step: 'printing' }))).toBeNull();
    expect(retryTo(job({ step: 'failed', failedAt: null }))).toBeNull();
  });

  it('저절로 다시 거는 것은 오가는 두 자리만입니다', () => {
    // ★ 슬라이스·전송은 네트워크 탓일 수 있어 다시 걸어 봅니다
    expect(shouldAutoRetry(job({ step: 'failed', failedAt: 'slicing' }), 0)).toBe(true);
    expect(shouldAutoRetry(job({ step: 'failed', failedAt: 'sending' }), 1)).toBe(true);

    // ★ 출력은 아닙니다. 되풀이하면 필라멘트와 시간만 버립니다
    expect(shouldAutoRetry(job({ step: 'failed', failedAt: 'printing' }), 0)).toBe(false);
    expect(shouldAutoRetry(job({ step: 'failed', failedAt: 'waiting_design' }), 0)).toBe(false);
  });

  it('세 번까지만 입니다', () => {
    const stuck = job({ step: 'failed', failedAt: 'sending' });
    expect(shouldAutoRetry(stuck, MAX_TRIES - 1)).toBe(true);
    expect(shouldAutoRetry(stuck, MAX_TRIES)).toBe(false);
  });
});

describe('베드 잠금 — 사람이 없는 곳에서 덮어 뽑지 않게', () => {
  it('치과가 누르기 전에는 집어갈 수 없습니다', () => {
    expect(claimable(job({ step: 'queued' }))).toBe(false);
    expect(claimable(job({ step: 'queued', bedClearedAt: '2026-10-06T01:00:00Z' }))).toBe(true);
  });

  it('출력 파일이 준비되기 전에는 누를 수도 없습니다', () => {
    expect(canClearBed(job({ step: 'slicing' }))).toBe(false);
    expect(canClearBed(job({ step: 'queued' }))).toBe(true);
  });

  it('한 번 누르면 또 누를 일이 없습니다', () => {
    expect(canClearBed(job({ step: 'queued', bedClearedAt: '2026-10-06T01:00:00Z' }))).toBe(false);
  });

  it('다른 단계에서는 집어가지 않습니다', () => {
    for (const step of AUTO_STEPS) {
      if (step === 'queued') continue;
      expect(claimable(job({ step, bedClearedAt: '2026-10-06T01:00:00Z' }))).toBe(false);
    }
  });
});

describe('진행 줄 — 멈추면 멈춘 자리가 보입니다', () => {
  it('다섯 칸을 늘 보여 줍니다', () => {
    expect(autoProgress(job()).map((s) => s.key)).toEqual([...SHOWN_STEPS]);
  });

  it('지난 칸·지금 칸·올 칸이 나뉩니다', () => {
    const steps = autoProgress(job({ step: 'sending' }));
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current', 'todo', 'todo']);
  });

  it('멈춘 칸에 표시가 남습니다', () => {
    const steps = autoProgress(job({ step: 'failed', failedAt: 'sending' }));
    expect(steps.find((s) => s.key === 'sending')?.state).toBe('stopped');
    // ★ 그 앞은 지나간 것으로 둡니다. 거기까지는 실제로 됐습니다
    expect(steps.find((s) => s.key === 'slicing')?.state).toBe('done');
    expect(steps.find((s) => s.key === 'printing')?.state).toBe('todo');
  });

  it('출력 중에만 숫자가 붙습니다', () => {
    const printing = autoProgress(job({ step: 'printing', percent: 42.6 }));
    expect(printing.find((s) => s.key === 'printing')?.percent).toBe(43);

    const sending = autoProgress(job({ step: 'sending', percent: 42 }));
    expect(sending.find((s) => s.key === 'sending')?.percent).toBeUndefined();
  });

  it('숫자가 넘치거나 모자라도 화면이 깨지지 않습니다', () => {
    const over = autoProgress(job({ step: 'printing', percent: 140 }));
    expect(over.find((s) => s.key === 'printing')?.percent).toBe(100);

    const under = autoProgress(job({ step: 'printing', percent: -5 }));
    expect(under.find((s) => s.key === 'printing')?.percent).toBe(0);
  });

  it('다 끝나면 모든 칸이 지나간 것입니다', () => {
    expect(autoProgress(job({ step: 'done' })).every((s) => s.state === 'done')).toBe(true);
  });
});

describe('치과에 하는 말', () => {
  it('눌러야 할 때만 눌러 달라고 합니다', () => {
    expect(autoNotice(job({ step: 'queued' }))).toContain('비웠습니다');
    expect(autoNotice(job({ step: 'queued', bedClearedAt: '2026-10-06T01:00:00Z' }))).not.toContain(
      '비웠습니다',
    );
  });

  it('멈추면 까닭을 함께 말합니다', () => {
    expect(autoNotice(job({ step: 'failed', failedAt: 'sending', failedReason: '프린터를 찾지 못했습니다' })))
      .toContain('프린터를 찾지 못했습니다');
    // ★ 까닭이 없어도 멈췄다는 사실은 말합니다
    expect(autoNotice(job({ step: 'failed', failedAt: 'sending' }))).toContain('멈췄');
  });

  it('출력 중이면 숫자를 말합니다', () => {
    expect(autoNotice(job({ step: 'printing', percent: 61 }))).toContain('61%');
  });
});

describe('치과가 읽는 말에 안 들어가야 하는 것', () => {
  /*
    ★ 기공소는 대외 비밀입니다 (사용자 결정 2026-09-11).
      이 진행 줄은 치과 주문상세에 그대로 뜹니다.
    ★ 속사정도 쓰지 않습니다. 'STL'·'슬라이스'·'덴트버드' 는 치과가 알 바가
      아니고, 어느 날 다른 것으로 바꿰도 치과 화면은 그대로여야 합니다.
  */
  const 금지 = ['기공소', '기공', 'STL', '슬라이스', '덴트버드', 'Dentbird', 'exocad', '오르카'];

  it('단계 이름에 없습니다', () => {
    for (const step of AUTO_STEPS) {
      for (const word of 금지) {
        expect(stepLabel(step)).not.toContain(word);
      }
    }
  });

  it('한 줄 안내에도 없습니다', () => {
    const cases: AutoJob[] = [
      job(),
      job({ step: 'slicing' }),
      job({ step: 'queued' }),
      job({ step: 'queued', bedClearedAt: '2026-10-06T01:00:00Z' }),
      job({ step: 'sending' }),
      job({ step: 'printing', percent: 10 }),
      job({ step: 'done' }),
      job({ step: 'failed', failedAt: 'slicing' }),
    ];
    for (const j of cases) {
      for (const word of 금지) {
        expect(autoNotice(j)).not.toContain(word);
      }
    }
  });
});

describe('값이 이상해도 죽지 않습니다', () => {
  it('모르는 단계 이름을 걸러냅니다', () => {
    expect(isAutoStep('printing')).toBe(true);
    expect(isAutoStep('PRINTING')).toBe(false);
    expect(isAutoStep('bed_check')).toBe(false);
    expect(isAutoStep(null)).toBe(false);
    expect(isAutoStep(3)).toBe(false);
  });
});

describe('기종을 코드에 적지 않았습니다', () => {
  /*
    ★ 2026-10-06 현재 기종 미정입니다. 길과 기종을 섞어 두면 기종을
      고르는 날 이 파일부터 고쳐야 합니다. 그래서 못 박아 둡니다.
  */
  it('도메인 파일에 기종 이름이 없습니다', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/server/domain/auto-print/index.ts'),
      'utf8',
    );
    for (const word of ['P1S', 'X1C', 'A1 ', 'Bambu', 'bambu', 'FTPS', 'MQTT']) {
      expect(src).not.toContain(word);
    }
  });
});

describe('치식 대조 — 엉뚱한 이가 출력되지 않게', () => {
  /*
    ★★ 덴트버드가 치식을 알아서 잡습니다. 틀렸을 때 아무도 모르는 것이
      위험합니다 — 치과에서 엉뚱한 이의 크라운이 그대로 출력됩니다.
      `.constructionInfo` 에 치식이 적혀 오므로 기계가 견줍니다
      (2026-10-07, 실제 내보내기로 확인 — 차정순 27번).
  */
  it('맞으면 보냅니다', () => {
    expect(teethMismatch([27], [27])).toBeNull();
    expect(teethMismatch([26, 27], [26, 27])).toBeNull();
  });

  it('두 개짜리 주문에 하나만 먼저 보내는 것은 됩니다', () => {
    expect(teethMismatch([26, 27], [27])).toBeNull();
  });

  it('주문에 없는 이가 섞이면 막습니다', () => {
    const why = teethMismatch([26], [27]);
    expect(why).not.toBeNull();
    expect(why).toContain('26');
    expect(why).toContain('27');
  });

  it('하나라도 섞이면 막습니다', () => {
    expect(teethMismatch([26, 27], [27, 36])).not.toBeNull();
  });

  it('치식을 못 읽었으면 막지 않습니다', () => {
    // ★ 사람이 크라운만 따로 옮겨 놓았을 수 있습니다 — 대조를 못 한 것뿐
    expect(teethMismatch([27], [])).toBeNull();
  });

  it('주문에 치식이 없는데 디자인에 있으면 막습니다', () => {
    expect(teethMismatch([], [27])).not.toBeNull();
  });

  it('같은 이가 여러 번 적혀 와도 흔들리지 않습니다', () => {
    expect(teethMismatch([27], [27, 27])).toBeNull();
  });
});

describe('디자인 잔걸음 (2026-10-15 — 치과가 설계 중인지 몰랐습니다)', () => {
  it('디자인 칸 아래에 지금 하는 일이 붙는다', () => {
    const steps = autoProgress(job({ designStage: 'analyzing' }));
    expect(steps[0].state).toBe('current');
    expect(steps[0].detail).toBe('치아를 분석하고 있습니다');
  });

  it('디자인 칸을 지나면 잔걸음이 안 붙는다', () => {
    const steps = autoProgress(job({ step: 'queued', designStage: 'generating' }));
    expect(steps[0].detail).toBeUndefined();
  });

  it('한 줄 안내 — 아직 / 하는 중 / 멈춤', () => {
    expect(autoNotice(job())).toBe('디자인 차례를 기다립니다');
    expect(autoNotice(job({ designStage: 'generating' }))).toBe('디자인 중 — 치아를 설계하고 있습니다');
    expect(autoNotice(job({ designStage: 'stalled' }))).toContain('늦어집니다');
  });

  it('멈춰도 치과에는 실패라고 하지 않고, 프로그램 이름도 없다', () => {
    for (const designStage of ['uploading', 'analyzing', 'generating', 'exporting', 'stalled'] as const) {
      const text = autoNotice(job({ designStage })) + autoProgress(job({ designStage }))[0].detail;
      expect(text).not.toMatch(/덴트버드|dentbird|실패|기공소/i);
    }
  });
});

describe('치과에 알리는 때는 둘뿐 (2026-10-15)', () => {
  it('출력 파일이 막 준비됐을 때 — 출력판을 비워 달라', () => {
    expect(alertOnMove('slicing', 'queued')).toBe('bed');
  });

  it('다 나왔을 때 — 꺼내 달라', () => {
    expect(alertOnMove('printing', 'done')).toBe('done');
  });

  it('그 밖의 걸음에는 안 울린다', () => {
    expect(alertOnMove('waiting_design', 'slicing')).toBeNull();
    expect(alertOnMove('queued', 'sending')).toBeNull();
    expect(alertOnMove('sending', 'printing')).toBeNull();
    expect(alertOnMove('queued', 'queued')).toBeNull();
    expect(alertOnMove('slicing', 'failed')).toBeNull(); // 자르기 실패는 센터 일
  });

  it('알림 글에 주문번호·환자·제품 이름이 들고, 설계 프로그램 이름은 없다', () => {
    for (const kind of ['bed', 'done'] as const) {
      const a = autoAlert(kind, { orderNo: 'ORD-261015-011', patientLabel: '한복계1', productName: 'FlowTemp' });
      const all = a.title + a.body;
      expect(all).toContain('ORD-261015-011');
      expect(all).toContain('한복계1');
      expect(all).toContain('FlowTemp');
      expect(all).not.toMatch(/덴트버드|dentbird|기공소/i);
    }
    expect(autoAlert('bed', { orderNo: 'A', patientLabel: 'B', productName: 'C' }).title).toContain('비워');
    expect(autoAlert('done', { orderNo: 'A', patientLabel: 'B', productName: 'C' }).title).toContain('꺼내');
  });
});

describe('치과 책갈피 한 줄 (2026-10-15)', () => {
  it('오류는 빨강 — 까닭을 그대로', () => {
    const r = boardRow(job({ step: 'failed', failedAt: 'sending', failedReason: '프린터를 찾지 못했습니다' }));
    expect(r.tone).toBe('error');
    expect(r.status).toBe('오류');
    expect(r.detail).toBe('프린터를 찾지 못했습니다');
  });

  it('출력판 확인을 기다리면 파랑 — 여기서 바로 누를 수 있다', () => {
    const r = boardRow(job({ step: 'queued' }));
    expect(r.tone).toBe('action');
    expect(r.canClearBed).toBe(true);
    expect(boardRow(job({ step: 'queued', bedClearedAt: '2026-10-15T00:00:00Z' })).canClearBed).toBe(false);
  });

  it('출력 중이면 실제 퍼센트와 막대', () => {
    const r = boardRow(job({ step: 'printing', percent: 62 }));
    expect(r.percent).toBe(62);
    expect(r.overall).toBeGreaterThan(boardRow(job({ step: 'sending' })).overall);
    expect(r.overall).toBeLessThan(100);
  });

  it('막대는 뒤로 가지 않는다 — 디자인 잔걸음부터 완료까지', () => {
    const path = [
      job(),
      job({ designStage: 'uploading' }),
      job({ designStage: 'analyzing' }),
      job({ designStage: 'generating' }),
      job({ designStage: 'exporting' }),
      job({ step: 'slicing' }),
      job({ step: 'queued' }),
      job({ step: 'sending' }),
      job({ step: 'printing', percent: 0 }),
      job({ step: 'printing', percent: 100 }),
      job({ step: 'done' }),
    ].map((j) => boardRow(j).overall);
    for (let i = 1; i < path.length; i++) expect(path[i]).toBeGreaterThanOrEqual(path[i - 1]);
    expect(path.at(-1)).toBe(100);
  });

  it('디자인 지연은 주황, 실패라고 하지 않는다', () => {
    const r = boardRow(job({ designStage: 'stalled' }));
    expect(r.tone).toBe('delay');
    expect(r.status + r.detail).not.toMatch(/실패|오류|덴트버드/);
  });

  it('다 나온 것은 초록 — 할 일로 붙잡지 않는다', () => {
    expect(boardRow(job({ step: 'done' })).tone).toBe('done');
  });

  it('접힌 탭은 가장 급한 색을 따른다', () => {
    expect(boardTone(['progress', 'error', 'action'])).toBe('error');
    expect(boardTone(['done', 'action'])).toBe('action');
    expect(boardTone(['done', 'progress'])).toBe('progress');
    expect(boardTone([])).toBeNull();
  });
});

describe('FlowTemp 그만두기 — ✕ 로 치울 수 있는 것 (2026-10-19 "UI 출구가 없네")', () => {
  it('다 나온 것·실패한 것·디자인이 멈춘 것은 치운다', () => {
    expect(canDismiss(job({ step: 'done' }))).toBe(true);
    expect(canDismiss(job({ step: 'failed' }))).toBe(true);
    expect(canDismiss(job({ step: 'waiting_design', designStage: 'stalled' }))).toBe(true);
  });

  it('★ 돌고 있는 것은 못 치운다 — 프린터가 뽑는 중에 사라지면 안 된다', () => {
    expect(canDismiss(job({ step: 'waiting_design', designStage: 'generating' }))).toBe(false);
    for (const step of ['slicing', 'queued', 'sending', 'printing'] as const) {
      expect(canDismiss(job({ step }))).toBe(false);
    }
  });

  it('책갈피 줄에 canDismiss 가 붙고, 멈춘 줄은 출구를 말해 준다', () => {
    const r = boardRow(job({ step: 'waiting_design', designStage: 'stalled', designNote: '치식을 못 읽었습니다 — 화면을 보고 사람이 확인해 주세요' }));
    expect(r.canDismiss).toBe(true);
    expect(r.status).toBe('디자인 멈춤');
    expect(r.detail).toBe('자연치가 아닙니다. 임플란트는 추후 업데이트 됩니다');
    expect(boardRow(job({ step: 'printing', percent: 10 })).canDismiss).toBe(false);
  });
});

describe('멈춘 까닭을 치과 말로 (2026-10-19)', () => {
  it('치식을 못 읽음 → 자연치가 아님 (짧게 — 사용자 2026-10-19)', () => {
    const a = stallAdvice('치식을 못 읽었습니다 — 화면을 보고 사람이 확인해 주세요');
    expect(a.what).toBe('자연치가 아닙니다');
    expect(a.todo).toBe('임플란트는 추후 업데이트 됩니다');
  });
  it('★ 어느 말도 한 줄 — 30자를 넘지 않는다', () => {
    for (const n of ['치식을 못 읽었습니다', '건수가 없습니다', '로그인이 풀렸습니다', '내보낸 뒤 30분째', '시험으로 돌렸습니다', null, 'xyz']) {
      const a = stallAdvice(n);
      expect(a.what.length).toBeLessThanOrEqual(30);
      expect(a.todo.length).toBeLessThanOrEqual(30);
    }
  });
  it('건수·로그인·배달 — 센터 몫', () => {
    expect(stallAdvice('내보내기 건수가 없습니다 (0/3)').todo).toContain('센터');
    expect(stallAdvice('덴트버드 로그인이 풀렸습니다').what).not.toContain('덴트버드');
    expect(stallAdvice("전용 크롬에서 ai.dentbird.com 의 '여러 파일 다운로드' 를 허용해 주세요").what).toBe('설계 PC 설정이 필요합니다');
    expect(stallAdvice('내보낸 뒤 30분째 주문에 안 올라왔습니다').what).toContain('안 올라왔습니다');
  });
  it('★ 모르는 까닭은 내부 말을 새지 않고 "잠시 뒤 다시 합니다" (2026-10-21 — 센터 손 없이)', () => {
    const a = stallAdvice('Dentbird: Multiple login detected on chrome 9333');
    expect(a.what).not.toMatch(/Dentbird|chrome|9333/);
    expect(a.todo).toContain('다시 합니다');
    expect(stallAdvice(null).todo).toContain('다시 합니다');
  });
  it('알림 한 줄도 같은 말을 쓴다', () => {
    expect(autoNotice(job({ step: 'waiting_design', designStage: 'stalled', designNote: '치식을 못 읽었습니다' }))).toContain('자연치가 아닙니다');
  });
});

describe('다시 뽑기 (2026-10-15)', () => {
  it('다 나온 것만 다시 뽑는다 — 멈춘 것은 다시 걸기가 맡는다', () => {
    expect(canReprint(job({ step: 'done' }))).toBe(true);
    for (const step of ['waiting_design', 'slicing', 'queued', 'sending', 'printing', 'failed'] as const) {
      expect(canReprint(job({ step }))).toBe(false);
    }
  });

  it('책갈피의 완료 줄에 다시 뽑기와 끝난 시각이 붙는다', () => {
    const r = boardRow(job({ step: 'done', finishedAt: '2026-10-15T06:32:47Z' }));
    expect(r.canReprint).toBe(true);
    expect(r.finishedAt).toBe('2026-10-15T06:32:47Z');
    expect(boardRow(job({ step: 'printing', percent: 10 })).canReprint).toBe(false);
  });

  it('진행 줄에 완료 칸이 있고, 끝나면 그 칸까지 초록이다', () => {
    const steps = autoProgress(job({ step: 'done' }));
    expect(steps.at(-1)?.key).toBe('done');
    expect(steps.every((s) => s.state === 'done')).toBe(true);
    expect(autoProgress(job({ step: 'printing' })).at(-1)?.state).toBe('todo');
  });
});

describe('남은 시간 (2026-10-15 — "남은 시간은 안 보여주네")', () => {
  const now = Date.parse('2026-10-15T07:00:00Z');

  it('프린터가 말한 값이 먼저', () => {
    expect(remainingOf(job({ step: 'printing', percent: 50, remainingMin: 7, startedAt: '2026-10-15T06:00:00Z' }), now)).toBe(7);
  });

  it('없으면 지난 시간과 퍼센트로 어림 — 10분에 50% 면 10분 남음', () => {
    expect(remainingOf(job({ step: 'printing', percent: 50, startedAt: '2026-10-15T06:50:00Z' }), now)).toBe(10);
  });

  it('3% 전·출력 중이 아닐 때는 모른다', () => {
    expect(remainingOf(job({ step: 'printing', percent: 2, startedAt: '2026-10-15T06:59:00Z' }), now)).toBeNull();
    expect(remainingOf(job({ step: 'queued', remainingMin: 5 }), now)).toBeNull();
  });

  it('말로는 — 약 N분 / 시간 / 곧', () => {
    expect(remainingLabel(7)).toBe('약 7분 남음');
    expect(remainingLabel(75)).toBe('약 1시간 15분 남음');
    expect(remainingLabel(120)).toBe('약 2시간 남음');
    expect(remainingLabel(1)).toBe('곧 끝납니다');
  });

  it('책갈피 줄 — 남은 시간이 먼저, 층이 뒤, 끝날 시각이 붙는다', () => {
    const r = boardRow(job({ step: 'printing', percent: 62, remainingMin: 7, layerNow: 59, layerTotal: 95 }), now);
    expect(r.detail).toBe('약 7분 남음 · 59/95층');
    expect(r.etaAt).toBe('2026-10-15T07:07:00.000Z');
  });
});

describe('설계 일꾼에게 줄 일감 (2026-10-15)', () => {
  const now = Date.parse('2026-10-15T08:00:00Z');
  const base = {
    orderStatus: 'received',
    step: 'waiting_design' as const,
    designStage: null,
    updatedAt: '2026-10-15T07:59:00Z',
    scanCount: 1,
  };

  it('디자인 차례·스캔 있음·아무도 안 잡음이면 준다', () => {
    expect(canHandDesign(base, now)).toBe(true);
  });

  it('스캔이 아직 올라오는 중이거나 없으면 안 준다', () => {
    expect(canHandDesign({ ...base, orderStatus: 'uploading' }, now)).toBe(false);
    expect(canHandDesign({ ...base, scanCount: 0 }, now)).toBe(false);
  });

  it('누가 잡고 있으면 안 주고, 30분 소식이 없으면 다시 준다', () => {
    expect(canHandDesign({ ...base, designStage: 'analyzing', updatedAt: '2026-10-15T07:50:00Z' }, now)).toBe(false);
    expect(canHandDesign({ ...base, designStage: 'analyzing', updatedAt: '2026-10-15T07:20:00Z' }, now)).toBe(true);
  });

  it('멈춘 것(확인 중)은 바로 다시 안 준다 — 일시적 멈춤만 5분 뒤에 한 번 (2026-10-21)', () => {
    // 방금 멈춘 것은 안 줍니다 (now 는 01:00 기준 바로 뒤)
    expect(canHandDesign({ ...base, designStage: 'stalled', updatedAt: new Date(now - 60_000).toISOString() }, now)).toBe(false);
    // 장비·계정 문제는 아무리 지나도 안 줍니다 — 센터 몫
    expect(canHandDesign({ ...base, designStage: 'stalled', designNote: '로그인이 풀렸습니다', updatedAt: '2026-10-15T01:00:00Z' }, now)).toBe(false);
  });

  it('디자인 차례가 아니거나 취소된 주문은 안 준다', () => {
    expect(canHandDesign({ ...base, step: 'queued' }, now)).toBe(false);
    expect(canHandDesign({ ...base, orderStatus: 'cancelled' }, now)).toBe(false);
  });

  it('위턱 치식', () => {
    expect([17, 26, 55].every(isUpperTooth)).toBe(true);
    expect([36, 41, 75].some(isUpperTooth)).toBe(false);
  });
});

describe('2026-10-16 점검 — 끊겼을 때', () => {
  const now = Date.parse('2026-10-16T02:00:00Z');

  it('내보낸 일감은 묵어도 다시 안 준다 — 덴트버드 건수를 또 쓰지 않게', () => {
    expect(
      canHandDesign(
        { orderStatus: 'received', step: 'waiting_design', designStage: 'exporting', updatedAt: '2026-10-15T00:00:00Z', scanCount: 1 },
        now,
      ),
    ).toBe(false);
  });

  it('기기는 3분 소식이 없으면 꺼진 것', () => {
    expect(deviceOnline('2026-10-16T01:58:30Z', now)).toBe(true);
    expect(deviceOnline('2026-10-16T01:56:00Z', now)).toBe(false);
    expect(deviceOnline(null, now)).toBe(false);
  });

  it('치과 PC 가 꺼지면 치과 PC 가 할 차례인 줄만 바뀐다', () => {
    const waiting = job({ step: 'queued', bedClearedAt: '2026-10-16T01:00:00Z' });
    const r = withClinicPc(boardRow(waiting, now), waiting, false);
    expect(r.tone).toBe('delay');
    expect(r.status).toBe('치과 PC 꺼짐');

    const printing = job({ step: 'printing', percent: 40 });
    expect(withClinicPc(boardRow(printing, now), printing, false).detail).toContain('계속 뽑고 있을 수');

    // 출력판을 비워 달라는 것(치과가 할 일)과 끝난 것은 그대로
    const bed = job({ step: 'queued' });
    expect(withClinicPc(boardRow(bed, now), bed, false).tone).toBe('action');
    const done = job({ step: 'done' });
    expect(withClinicPc(boardRow(done, now), done, false).tone).toBe('done');
    // 켜져 있으면 그대로
    expect(withClinicPc(boardRow(waiting, now), waiting, true).status).toBe('출력 준비');
  });
});

describe('멈추면 알린다 (2026-10-16 점검)', () => {
  it('치과 쪽에서 멈추면 치과에', () => {
    expect(alertOnMove('printing', 'failed')).toBe('failed');
    expect(alertOnMove('sending', 'failed')).toBe('failed');
  });

  it('까닭을 실어 보낸다', () => {
    const a = autoAlert('failed', { orderNo: 'ORD-1', patientLabel: '홍', productName: 'FlowTemp', reason: '필라멘트가 떨어졌습니다' });
    expect(a.title).toContain('멈췄습니다');
    expect(a.body).toContain('필라멘트');
  });
});

describe('센터 손 없이 — 멈춤을 기계가 가릅니다 (사용자 결정 2026-10-21)', () => {
  it('종류를 글자로 가릅니다', () => {
    expect(stallKind('치식이 0개입니다 — 지금은 싱글 크라운만 자동으로 합니다')).toBe('unsupported');
    expect(stallKind('치식을 못 읽었습니다 — 화면을 보고 사람이 확인해 주세요')).toBe('unreadable');
    expect(stallKind('치식이 주문서와 다릅니다 — 주문서 [27] · 덴트버드 [26]')).toBe('unreadable');
    expect(stallKind('상악 스캔을 못 찾았습니다 — 파일: a.ply')).toBe('scan');
    expect(stallKind('덴트버드가 두 번 다 분류하다 파일을 내려놓았습니다 — 스캔을 봐 주세요')).toBe('scan');
    expect(stallKind('이번 달 덴트버드 내보내기 건수가 없습니다 (0/3)')).toBe('credits');
    expect(stallKind("전용 크롬에서 ai.dentbird.com 의 '여러 파일 다운로드' 를 허용해 주세요")).toBe('setup');
    expect(stallKind('내보낸 뒤 30분째 주문에 안 올라왔습니다')).toBe('setup');
    expect(stallKind('설계값을 못 맞췄습니다 — 크라운을 골라도 도구 막대가 안 뜹니다')).toBe('transient');
    expect(stallKind('300초가 지나도 생성이 안 끝납니다')).toBe('transient');
    expect(stallKind(null)).toBe('transient');
  });

  it('판정 — 못 하는 건 포기, 스캔은 기다림, 장비는 센터, 일시적은 한 번 더', () => {
    expect(designVerdict('치식이 2개입니다', 0)).toBe('give_up');
    expect(designVerdict('치식을 못 읽었습니다', 0)).toBe('give_up');
    expect(designVerdict('하악 스캔을 못 찾았습니다', 0)).toBe('wait_scan');
    expect(designVerdict('건수가 없습니다', 0)).toBe('hold');
    expect(designVerdict('로그인이 풀렸습니다', 0)).toBe('hold');
    expect(designVerdict('도구 막대가 안 뜹니다', 0)).toBe('retry');
    expect(designVerdict('도구 막대가 안 뜹니다', DESIGN_AUTO_RETRIES)).toBe('give_up');
  });

  it('일시적 멈춤은 5분 뒤에 일꾼이 다시 집습니다 — 다른 멈춤은 안 집습니다', () => {
    const now = Date.parse('2026-10-21T03:00:00Z');
    const base = { orderStatus: 'designing', step: 'waiting_design' as const, scanCount: 2 };
    const at = (min: number) => new Date(now - min * 60000).toISOString();
    const tr = { ...base, designStage: 'stalled' as const, designNote: '도구 막대가 안 뜹니다', designTries: 1 };
    expect(canHandDesign({ ...tr, updatedAt: at(DESIGN_RETRY_AFTER_MINUTES - 1) }, now)).toBe(false);
    expect(canHandDesign({ ...tr, updatedAt: at(DESIGN_RETRY_AFTER_MINUTES + 1) }, now)).toBe(true);
    expect(canHandDesign({ ...tr, updatedAt: at(60), designTries: DESIGN_AUTO_RETRIES + 1 }, now)).toBe(false);
    expect(canHandDesign({ ...tr, updatedAt: at(60), designNote: '건수가 없습니다' }, now)).toBe(false);
    expect(canHandDesign({ ...tr, updatedAt: at(60), designNote: '하악 스캔을 못 찾았습니다' }, now)).toBe(false);
    expect(canHandDesign({ ...base, designStage: 'ended', updatedAt: at(60) }, now)).toBe(false);
  });

  it('포기한 건 — 치과는 부드러운 안내만 보고 ✕ 로 치울 수 있습니다', () => {
    const j = job({ step: 'waiting_design', designStage: 'ended' });
    expect(autoNotice(j)).toBe(GIVE_UP_MESSAGE);
    expect(canDismiss(j)).toBe(true);
    const r = boardRow(j);
    expect(r.tone).toBe('info');
    expect(r.detail).toBe(GIVE_UP_MESSAGE);
    for (const word of ['실패', '오류', '덴트버드', '기공소', 'STL']) {
      expect(r.status + r.detail + GIVE_UP_MESSAGE).not.toContain(word);
    }
  });

  it('치과 알림 둘 — 포기·스캔 다시 올리기 — 에 설계 프로그램 이름이 없습니다', () => {
    const a = autoAlert('design_ended', { orderNo: 'ORD-1', patientLabel: '홍', productName: 'FlowTemp' });
    expect(a.title + a.body).toContain('평소대로');
    const b = autoAlert('design_scan', { orderNo: 'ORD-1', patientLabel: '홍', productName: 'FlowTemp', reason: '스캔 파일을 확인해 주세요' });
    expect(b.title).toContain('다시 올려');
    for (const t of [a, b]) expect(t.title + t.body).not.toMatch(/덴트버드|dentbird|기공소|STL/i);
  });

  it('스캔 멈춤은 치과에 다시 올리라고, 일시적 멈춤은 잠시 뒤 다시 한다고 말합니다', () => {
    expect(stallAdvice('하악 스캔을 못 찾았습니다').todo).toContain('다시 올리면');
    expect(stallAdvice('도구 막대가 안 뜹니다').todo).toContain('다시 합니다');
  });
});

describe('폰 푸시는 손댈 일만 (2026-10-23)', () => {
  it("'다 나왔다' 는 폰으로 안 보냅니다 — 종 알림·책갈피만", () => {
    expect(alertPushes('done')).toBe(false);
  });
  it('판 비우기·멈춤·스캔·자동 설계 포기는 폰까지', () => {
    for (const k of ['bed', 'failed', 'design_scan', 'design_ended'] as const) expect(alertPushes(k)).toBe(true);
  });
});

describe('준비 구간 남은 시간은 실제 출력 시간으로 (2026-10-23)', () => {
  const start = '2026-10-23T06:36:44Z';
  const at = (sec: number) => new Date(start).getTime() + sec * 1000;
  const job = (over: Record<string, unknown>) =>
    ({ step: 'printing', bedClearedAt: 'x', percent: 0, failedAt: null, failedReason: null, startedAt: start, ...over }) as never;

  it('오늘 실측 — 시작 때 프린터 12분, 실제 7분(417초)', () => {
    expect(remainingOf(job({ remainingMin: 12, layerNow: 0 }), at(0), 417)).toBe(7);
    expect(remainingOf(job({ remainingMin: 7, layerNow: 0 }), at(83), 417)).toBe(6);
  });
  it('첫 층부터는 프린터 값 그대로', () => {
    expect(remainingOf(job({ remainingMin: 5, layerNow: 1 }), at(129), 417)).toBe(5);
  });
  it('프린터 값이 더 작으면 그쪽', () => {
    expect(remainingOf(job({ remainingMin: 3, layerNow: 0 }), at(60), 417)).toBe(3);
  });
  it('실제 기록이 없으면 프린터 값', () => {
    expect(remainingOf(job({ remainingMin: 12, layerNow: 0 }), at(0), null)).toBe(12);
  });
  it('가운데 값 · 너무 짧거나 긴 것은 버림', () => {
    const r = (s: number) => ({ startedAt: start, finishedAt: new Date(at(s)).toISOString() });
    expect(typicalPrintSeconds([r(417), r(432), r(440), r(60), r(5000)])).toBe(432);
    expect(typicalPrintSeconds([])).toBeNull();
  });
});

describe('출력 중 일시 정지 (2026-10-23)', () => {
  const printing = (reason: string | null) =>
    ({ step: 'printing', bedClearedAt: 'x', percent: 40, failedAt: null, failedReason: reason }) as never;

  it('머리말이 붙은 사유만 일시 정지', () => {
    expect(pausedReason(printing(PAUSE_MARK + '필라멘트'))).toBe('필라멘트');
    expect(pausedReason(printing(null))).toBeNull();
    expect(pausedReason(printing('다른 까닭'))).toBeNull();
  });
  it('책갈피는 할 일(action)로, 남은 시간은 숨김', () => {
    const row = boardRow(printing(PAUSE_MARK + '필라멘트가 끊겼거나 떨어졌을 수 있습니다'));
    expect(row.tone).toBe('action');
    expect(row.status).toBe('일시 정지');
    expect(row.etaAt).toBeNull();
  });
  it('알림은 폰까지, 이어 하기를 안내', () => {
    expect(alertPushes('paused')).toBe(true);
    const a = autoAlert('paused', { orderNo: 'O', patientLabel: 'P', productName: 'FlowTemp', reason: '필라멘트' });
    expect(a.body).toContain('이어 하기');
  });
  it('주문 상세 문구', () => {
    expect(autoNotice(printing(PAUSE_MARK + '필라멘트'))).toContain('이어 하기');
  });
});
