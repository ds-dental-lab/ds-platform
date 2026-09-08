// =========================================================
// 놓을 위치: tests/domain/alimtalk-template.test.ts
// 기준: 2026-09-08 알리고에 등록한 템플릿 7개 — 글자 그대로 만들어야 카카오가 받습니다
// =========================================================

import { describe, it, expect } from 'vitest';
import { renderTemplate, TEMPLATE_CODE, TEMPLATES, fill } from '@/server/domain/alimtalk/template';
import { ALIMTALK_RULES } from '@/server/domain/alimtalk';

describe('템플릿 코드', () => {
  it('★ 사건마다 코드가 있고, 리메이크는 접수와 같은 템플릿', () => {
    for (const event of Object.keys(ALIMTALK_RULES) as (keyof typeof ALIMTALK_RULES)[]) {
      expect(TEMPLATE_CODE[event]).toMatch(/^UL_\d+$/);
      expect(TEMPLATES[event]).toBeDefined();
    }
    expect(TEMPLATE_CODE.remake_received).toBe(TEMPLATE_CODE.order_received);
  });
});

describe('변수 채우기', () => {
  it('있는 변수만 바꾸고 없는 건 남깁니다', () => {
    expect(fill('#{a} #{b}', { a: '1' })).toBe('1 #{b}');
  });
});

describe('보낼 글 만들기', () => {
  it('★ 접수 — 등록한 본문 그대로, 버튼 링크에 주문ID', () => {
    const r = renderTemplate('order_received', {
      구분: '새', 치과명: '미사치과', 주문번호: 'ORD-260908-001', 환자명: '김민서', 요청시한: '2026-09-12', 주문ID: 'abc',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toBe('UL_1850');
    expect(r.message).toBe(
      '[DenFlow] 새 주문이 접수되었습니다.\n\n치과: 미사치과\n주문번호: ORD-260908-001\n환자: 김민서\n요청시한: 2026-09-12\n\n덴플로우에서 확인해 주세요.',
    );
    expect(r.button).toEqual({ name: '주문 확인', linkMo: 'https://denflow.kr/design/orders/abc', linkPc: 'https://denflow.kr/design/orders/abc' });
  });

  it('★ 변수가 빠지면 안 만듭니다 — 변수 자리가 그대로 나가면 카카오가 거절', () => {
    const r = renderTemplate('rescan_requested', { 주문번호: 'x', 환자명: 'y', 주문ID: 'z' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('사유');
  });

  it('옛 줄(vars 없음)은 안 만듭니다', () => {
    expect(renderTemplate('order_received', null).ok).toBe(false);
  });

  it('값 안의 줄바꿈은 한 칸으로 — 줄 수가 어긋나면 대조에 걸립니다', () => {
    const r = renderTemplate('repair_requested', { 주문번호: 'a', 환자명: 'b', 요청내용: '마진\n깨짐', 주문ID: 'c' });
    expect(r.ok && r.message).toContain('요청: 마진 깨짐');
  });

  it('가입 접수는 버튼이 없고, 승인은 로그인 버튼', () => {
    const a = renderTemplate('signup_received', { 상호: '미사치과' });
    const b = renderTemplate('signup_approved', { 상호: '미사치과' });
    expect(a.ok && a.button).toBeNull();
    expect(b.ok && b.button?.linkMo).toBe('https://denflow.kr/login');
  });
});
