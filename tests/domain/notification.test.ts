// =========================================================
// 놓을 위치: tests/domain/notification.test.ts
// 기준: 시스템설계서 Q-7 알림 트리거, 기공소 환자명 정책 (2026-08-11 변경)
// =========================================================

import { describe, it, expect } from 'vitest';
import { planStatusNotifications } from '@/server/domain/notification';

const context = {
  orderNo: 'ORD-260808-006',
  patientLabel: '박민 (10003)',
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
    const plans = planStatusNotifications('designing', 'production_wait', 'design_center', context);

    expect(plans.every((p) => p.channel === 'kakao' || p.channel === 'in_app')).toBe(true);
  });

  // ★ 물건은 어차피 그날 옵니다. 건마다 종에 쌓이면 대화가 묻힙니다 —
  //   오늘 올 것은 HOME 의 '오늘 배송 예정' 카드가 이미 보여 줍니다 (2026-08-19)
  it('★ 배송으로 넘어가는 것은 아무에게도 알리지 않는다', () => {
    expect(planStatusNotifications('production', 'shipping', 'lab', context)).toHaveLength(0);
    expect(planStatusNotifications('production', 'shipping', 'design_center', context)).toHaveLength(0);
  });

  it('자기가 한 일은 자기에게 알리지 않는다', () => {
    // 기공소가 제작을 시작했고, 다음 차례도 기공소입니다
    const plans = planStatusNotifications('production_wait', 'production', 'lab', context);

    expect(plans).toHaveLength(0);
  });
});

// =========================================================
// 기공소 환자명
//
// ★ 2026-08-11 에 정책이 뒤집혔습니다.
//   전에는 기공소에 마스킹 이름(박*)을 보냈습니다. 그런데 기공소는
//   완성품을 치과로 보낼 때 환자 이름으로 케이스를 구분합니다.
//   가려 보내면 어느 건인지 알 수가 없어 알림이 쓸모없어집니다.
//
//   대신 '배정받은 주문만' 이 실명 차단을 대신합니다 —
//   알림은 주문의 lab_org_id 가 가리키는 기공소 한 곳에만 갑니다.
//   디자인센터가 물량을 나눠 주므로, 기공소가 치과 전체의
//   환자 명단을 긁을 길은 없습니다.
// =========================================================

describe('기공소 환자명', () => {
  it('★ 배정 알림에 실명이 들어간다 — 이 이름으로 케이스를 찾습니다', () => {
    const plans = planStatusNotifications(
      'designing',
      'production_wait',
      'design_center',
      context,
    );

    expect(plans).toHaveLength(1);
    expect(plans[0].to).toBe('lab');
    expect(plans[0].body).toContain('박민 (10003)');
  });

  it('★ 기공소가 받는 인앱 알림에도 실명이 들어간다', () => {
    const plans = planStatusNotifications(
      'production_wait',
      'production',
      'design_center',
      context,
    );

    const toLab = plans.filter((p) => p.to === 'lab');
    expect(toLab.length).toBeGreaterThan(0);

    for (const plan of toLab) {
      expect(plan.body).toContain('박민');
    }
  });

  it('★ 알림은 받는 쪽에 상관없이 같은 본문을 씁니다', () => {
    const toLab = planStatusNotifications('designing', 'production_wait', 'design_center', context);
    const toDesign = planStatusNotifications('rescan', 'received', 'clinic', context);

    expect(toLab[0].body).toBe(toDesign[0].body);
  });

  it('치과와 디자인센터에도 실명이 그대로 간다', () => {
    const toClinic = planStatusNotifications('shipping', 'completed', 'clinic', context);
    const toDesign = planStatusNotifications('rescan', 'received', 'clinic', context);

    for (const plan of [...toClinic, ...toDesign]) {
      expect(plan.body).toContain('박민');
    }
  });
});
