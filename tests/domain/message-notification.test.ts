// =========================================================
// 놓을 위치: tests/domain/message-notification.test.ts
//
// 주문 대화에 글이 올라오면 누구에게 알리는가. (사용자 결정 2026-08-13)
//
// ★ 대화만 알림을 하나도 안 만들고 있었습니다.
//   상태가 바뀌면 종에 숫자가 붙는데 글은 아무 소리 없이 쌓였습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  planMessageNotifications,
  resolveRecipients,
  MESSAGE_PREVIEW,
} from '@/server/domain/notification';

const CONTEXT = {
  orderNo: 'ORD-260813-001',
  patientLabel: '김철수',
  body: '마진 라인 다시 봐 주세요',
  authorName: '테스트치과',
};

describe('대화는 나머지 둘에게 간다', () => {
  it('치과가 쓰면 디자인센터와 기공소가 받는다', () => {
    const plans = planMessageNotifications('clinic', CONTEXT);

    expect(plans.map((p) => p.to).sort()).toEqual(['design', 'lab']);
  });

  it('디자인센터가 쓰면 치과와 기공소가 받는다', () => {
    const plans = planMessageNotifications('design_center', CONTEXT);

    expect(plans.map((p) => p.to).sort()).toEqual(['clinic', 'lab']);
  });

  it('기공소가 쓰면 치과와 디자인센터가 받는다', () => {
    const plans = planMessageNotifications('lab', CONTEXT);

    expect(plans.map((p) => p.to).sort()).toEqual(['clinic', 'design']);
  });

  it('★ 쓴 사람 자리로는 절대 안 간다', () => {
    expect(planMessageNotifications('clinic', CONTEXT).some((p) => p.to === 'clinic')).toBe(
      false,
    );
    expect(
      planMessageNotifications('design_center', CONTEXT).some((p) => p.to === 'design'),
    ).toBe(false);
    expect(planMessageNotifications('lab', CONTEXT).some((p) => p.to === 'lab')).toBe(false);
  });

  it('★ 알림톡으로는 안 나간다 — 대화는 하루에도 여러 번 오갑니다', () => {
    for (const sector of ['clinic', 'design_center', 'lab'] as const) {
      for (const plan of planMessageNotifications(sector, CONTEXT)) {
        expect(plan.channel).toBe('in_app');
      }
    }
  });
});

describe('무엇이 적히나', () => {
  it('누가 말했는지가 제목이다', () => {
    const [plan] = planMessageNotifications('clinic', CONTEXT);

    expect(plan.title).toContain('테스트치과');
  });

  it('조직 이름이 비면 섹터 이름으로 버틴다', () => {
    const [plan] = planMessageNotifications('lab', { ...CONTEXT, authorName: '' });

    expect(plan.title).toContain('기공소');
  });

  it('어느 주문인지와 글 앞머리가 본문에 있다', () => {
    const [plan] = planMessageNotifications('clinic', CONTEXT);

    expect(plan.body).toContain('ORD-260813-001');
    expect(plan.body).toContain('김철수');
    expect(plan.body).toContain('마진 라인');
  });

  it('★ 긴 글은 잘라서 담는다 — 종 목록이 글 하나로 채워지면 안 됩니다', () => {
    const long = '가'.repeat(MESSAGE_PREVIEW + 40);
    const [plan] = planMessageNotifications('clinic', { ...CONTEXT, body: long });

    expect(plan.body).toContain('…');
    expect(plan.body!.length).toBeLessThan(long.length);
  });

  it('딱 맞는 길이는 안 자른다', () => {
    const exact = '나'.repeat(MESSAGE_PREVIEW);
    const [plan] = planMessageNotifications('clinic', { ...CONTEXT, body: exact });

    expect(plan.body).not.toContain('…');
  });
});

// ---------- 실제로 어느 조직에 꽂히는가 ----------

const CLINIC = 'org-clinic';
const DESIGN = 'org-design';
const LAB = 'org-lab';

const 보통 = { clinic: CLINIC, design: DESIGN, lab: LAB };

describe('슬롯이 아니라 조직으로 꽂힌다', () => {
  it('치과가 쓰면 디자인센터와 기공소 조직에 하나씩', () => {
    const rows = resolveRecipients(
      planMessageNotifications('clinic', CONTEXT),
      보통,
      CLINIC,
    );

    expect(rows.map((r) => r.orgId).sort()).toEqual([DESIGN, LAB]);
  });

  it('★ 기공소가 아직 없으면 보낼 곳도 없다 — 배정 전 주문', () => {
    const rows = resolveRecipients(
      planMessageNotifications('clinic', CONTEXT),
      { clinic: CLINIC, design: DESIGN, lab: null },
      CLINIC,
    );

    expect(rows.map((r) => r.orgId)).toEqual([DESIGN]);
  });

  it('★ 자사 제작이면 자기가 쓴 글이 자기 종에 붙지 않는다', () => {
    // 디자인센터가 기공소 자리를 겸합니다 (통합 조직 모델)
    const 자사 = { clinic: CLINIC, design: DESIGN, lab: DESIGN };

    const rows = resolveRecipients(
      planMessageNotifications('design_center', CONTEXT),
      자사,
      DESIGN,
    );

    expect(rows.map((r) => r.orgId)).toEqual([CLINIC]);
  });

  it('★ 자사 제작 건에 치과가 쓰면 디자인센터에 딱 한 번만 간다', () => {
    const 자사 = { clinic: CLINIC, design: DESIGN, lab: DESIGN };

    const rows = resolveRecipients(planMessageNotifications('clinic', CONTEXT), 자사, CLINIC);

    expect(rows.map((r) => r.orgId)).toEqual([DESIGN]);
  });

  it('쓴 사람의 조직은 어떤 자리에 있든 빠진다', () => {
    for (const author of [CLINIC, DESIGN, LAB]) {
      const rows = resolveRecipients(planMessageNotifications('clinic', CONTEXT), 보통, author);
      expect(rows.some((r) => r.orgId === author)).toBe(false);
    }
  });
});
