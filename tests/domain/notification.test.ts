// =========================================================
// 놓을 위치: tests/domain/notification.test.ts
// 기준: 시스템설계서 Q-7 알림 트리거, §8.5 민감 필드 차단
// =========================================================

import { describe, it, expect } from 'vitest';
import { planStatusNotifications } from '@/server/domain/notification';

const context = {
  orderNo: 'ORD-260808-006',
  patientLabel: '박민 (10003)',
  patientLabelMasked: '박* (10003)',
};

describe('Q-7 알림 트리거', () => {
  it('★ ① 접수가 생기면 디자인센터에 알린다', () => {
    const plans = planStatusNotifications('rescan', 'received', 'clinic', context);

    expect(plans).toHaveLength(1);
    expect(plans[0].to).toBe('design');
    expect(plans[0].channel).toBe('kakao');
  });

  it('★ ② 재스캔은 치과에 알리고 사유를 함께 보낸다', () => {
    const plans = planStatusNotifications('designing', 'rescan', 'design_center', {
      ...context,
      reason: '마진이 잘렸습니다',
    });

    expect(plans[0].to).toBe('clinic');
    expect(plans[0].channel).toBe('kakao');
    expect(plans[0].body).toContain('마진이 잘렸습니다');
  });

  it('★ ③ 제작대기는 기공소에 알린다', () => {
    const plans = planStatusNotifications(
      'designing',
      'production_wait',
      'design_center',
      context,
    );

    expect(plans[0].to).toBe('lab');
    expect(plans[0].channel).toBe('kakao');
  });

  it('그 외 상태는 인앱으로만 나간다', () => {
    const plans = planStatusNotifications('production', 'shipping', 'lab', context);

    expect(plans.every((p) => p.channel === 'in_app')).toBe(true);
  });

  it('자기가 한 일은 자기에게 알리지 않는다', () => {
    // 기공소가 제작을 시작했고, 다음 차례도 기공소입니다
    const plans = planStatusNotifications('production_wait', 'production', 'lab', context);

    expect(plans).toHaveLength(0);
  });
});

// ★ 화면에서 실명을 가려 놓고 알림으로 흘려보내면 아무 의미가 없습니다.
//   실제로 한 번 새서 막았고, 다시 새지 않도록 여기서 지킵니다.
describe('환자 실명 차단 (§8.5)', () => {
  it('★ 기공소 앞으로 가는 알림에는 실명이 들어가지 않는다', () => {
    const plans = planStatusNotifications(
      'designing',
      'production_wait',
      'design_center',
      context,
    );

    for (const plan of plans) {
      expect(plan.to).toBe('lab');
      expect(plan.body).not.toContain('박민');
      expect(plan.body).toContain('박*');
    }
  });

  it('★ 기공소가 받는 인앱 알림에도 실명이 없다', () => {
    // 제작대기 → 제작 은 기공소가 하지만, 디자인센터가 되돌리는 등
    // 기공소가 받는 인앱 알림 경로도 같은 규칙을 지켜야 합니다.
    const plans = planStatusNotifications(
      'production_wait',
      'production',
      'design_center',
      context,
    );

    for (const plan of plans.filter((p) => p.to === 'lab')) {
      expect(plan.body).not.toContain('박민');
    }
  });

  it('치과와 디자인센터에는 실명이 그대로 간다', () => {
    const toClinic = planStatusNotifications('shipping', 'completed', 'clinic', context);
    const toDesign = planStatusNotifications('rescan', 'received', 'clinic', context);

    for (const plan of [...toClinic, ...toDesign]) {
      expect(plan.body).toContain('박민');
    }
  });
});
