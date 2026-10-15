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
  autoAlert,
  autoNotice,
  boardRow,
  boardTone,
  canReprint,
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
    expect(steps[0].detail).toBe('치아 분석');
  });

  it('디자인 칸을 지나면 잔걸음이 안 붙는다', () => {
    const steps = autoProgress(job({ step: 'queued', designStage: 'generating' }));
    expect(steps[0].detail).toBeUndefined();
  });

  it('한 줄 안내 — 아직 / 하는 중 / 멈춤', () => {
    expect(autoNotice(job())).toBe('디자인 차례를 기다립니다');
    expect(autoNotice(job({ designStage: 'generating' }))).toBe('디자인 중 — 설계');
    expect(autoNotice(job({ designStage: 'stalled' }))).toContain('늦어지고');
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
    expect(alertOnMove('printing', 'failed')).toBeNull();
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
