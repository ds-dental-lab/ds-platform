import { describe, expect, it } from 'vitest';
import { planResubmit, type LivingFile } from '@/server/domain/rescan';

const f = (id: string, kind = 'scan', uploaded = true): LivingFile => ({ id, kind, uploaded });

describe('planResubmit — 스캔 재등록', () => {
  it('새로 올렸으면 옛 스캔만 치운다', () => {
    const plan = planResubmit([f('old1'), f('old2'), f('new1')], ['old1', 'old2'], false);
    expect(plan).toEqual({ ok: true, remove: ['old1', 'old2'], kept: 1 });
  });

  it('사진·대화 첨부는 치울 목록에 들어 있어도 건드리지 않는다', () => {
    const plan = planResubmit(
      [f('old1'), f('shade', 'photo'), f('chat', 'etc'), f('new1')],
      ['old1', 'shade', 'chat'],
      false,
    );
    expect(plan).toEqual({ ok: true, remove: ['old1'], kept: 1 });
  });

  it('디자인 파일도 건드리지 않는다', () => {
    const plan = planResubmit([f('old1'), f('d', 'design'), f('new1')], ['old1', 'd'], false);
    expect(plan.ok && plan.remove).toEqual(['old1']);
  });

  it('새 파일이 표에 없으면 옛 스캔을 치우지 않고 멈춘다', () => {
    const plan = planResubmit([f('old1'), f('old2')], ['old1', 'old2'], false);
    expect(plan.ok).toBe(false);
  });

  it('덜 올라온 새 파일은 세지 않는다', () => {
    const plan = planResubmit([f('old1'), f('new1', 'scan', false)], ['old1'], false);
    expect(plan.ok).toBe(false);
  });

  it('사진만 남는 경우도 멈춘다 — 스캔이 있어야 한다', () => {
    const plan = planResubmit([f('old1'), f('shade', 'photo')], ['old1'], false);
    expect(plan.ok).toBe(false);
  });

  it('이전 스캔을 그대로 쓰면 아무것도 치우지 않는다', () => {
    const plan = planResubmit([f('old1'), f('old2')], ['old1', 'old2'], true);
    expect(plan).toEqual({ ok: true, remove: [], kept: 2 });
  });

  it('그대로 쓰겠다는데 스캔이 없으면 멈춘다', () => {
    const plan = planResubmit([f('shade', 'photo')], [], true);
    expect(plan).toEqual({ ok: false, error: '다시 쓸 이전 스캔이 없습니다. 새로 올려 주세요' });
  });
});
