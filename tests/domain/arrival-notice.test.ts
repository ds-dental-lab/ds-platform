// =========================================================
// 놓을 위치: tests/domain/arrival-notice.test.ts
// 기준: 사용자 요청 2026-09-07 — 아침 "오늘 도착 예정" 알림톡
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  noticeDate,
  nameLine,
  composeArrivalNotice,
  groupByClinic,
  isNoticeable,
  ARRIVAL_LINK,
  MAX_NAMES,
} from '@/server/domain/arrival-notice';

describe('날짜', () => {
  it('9/15(화) — 2026-09-15 는 화요일', () => {
    expect(noticeDate('2026-09-15')).toBe('9/15(화)');
  });
});

describe('이름 줄', () => {
  it('쉼표로 잇고 님을 붙입니다', () => {
    expect(nameLine(['김민서', '이서준'])).toBe('김민서, 이서준 님');
  });
  it('넘치면 외 n명', () => {
    const many = Array.from({ length: MAX_NAMES + 3 }, (_, i) => `환자${i}`);
    expect(nameLine(many)).toContain(`외 3명 님`);
    expect(nameLine(many)).not.toContain(`환자${MAX_NAMES}`);
  });
});

describe('문구', () => {
  it('사용자가 준 모양 그대로 — 인사·날짜·이름·링크', () => {
    const n = composeArrivalNotice('2026-09-15', ['김민서', '이서준'])!;
    expect(n.body).toBe(
      '안녕하세요. 9/15(화) 배송 도착 예정 안내입니다.\n' +
        '김민서, 이서준 님\n' +
        '보철물이 오늘 도착할 예정입니다.\n' +
        `오늘 받을 것 보기: ${ARRIVAL_LINK}`,
    );
    expect(n.link).toBe('https://denflow.kr/m/today');
  });
  it('이름이 없으면 안 보냅니다', () => {
    expect(composeArrivalNotice('2026-09-15', [])).toBeNull();
  });
});

describe('★ 보낸 것만 싣습니다', () => {
  it('배송 중·도착만 — 만드는 중·취소는 아닙니다', () => {
    expect(isNoticeable('shipping')).toBe(true);
    expect(isNoticeable('completed')).toBe(true);
    expect(isNoticeable('production')).toBe(false);
    expect(isNoticeable('designing')).toBe(false);
    expect(isNoticeable('cancelled')).toBe(false);
  });

  it('치과별로 묶고 같은 환자는 한 번만', () => {
    const grouped = groupByClinic([
      { clinicOrgId: 'a', patientLabel: '김민서', status: 'shipping' },
      { clinicOrgId: 'a', patientLabel: '김민서', status: 'shipping' },
      { clinicOrgId: 'a', patientLabel: '이서준', status: 'production' },
      { clinicOrgId: 'b', patientLabel: '박지우', status: 'completed' },
    ]);
    expect(grouped.get('a')).toEqual(['김민서']);
    expect(grouped.get('b')).toEqual(['박지우']);
  });
});
