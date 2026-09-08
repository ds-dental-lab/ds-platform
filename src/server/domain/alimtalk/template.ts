// =========================================================
// 놓을 위치: src/server/domain/alimtalk/template.ts
//
// 알리고에 등록한 카카오 템플릿 일곱 개 — **등록한 글자 그대로**.
// (사용자가 2026-09-08 등록, 코드 UL_1850~UL_1883)
//
// ★★ 여기 문장은 알리고 화면에 등록한 것과 한 글자도 다르면 안 됩니다.
//   카카오는 보낼 때 템플릿과 대조해서 변수 자리 말고 한 글자라도 다르면
//   거절합니다. 템플릿을 고치면 여기도 같이 고치고, 검수를 다시 받습니다.
//
// ★ 변수 이름(#{주문번호} 같은 것)도 등록한 것과 같습니다 — 대기열에
//   쌓는 쪽(events)이 이 이름으로 값을 넣습니다 (TemplateVars).
//
// ★ 리메이크는 접수 템플릿을 같이 씁니다 — #{구분} 에 '리메이크'.
// =========================================================

import type { AlimtalkEvent } from '@/server/domain/alimtalk';

/** 알리고가 준 템플릿 코드 (2026-09-08 등록) */
export const TEMPLATE_CODE: Record<AlimtalkEvent, string> = {
  order_received: 'UL_1850',
  remake_received: 'UL_1850',
  production_requested: 'UL_1857',
  rescan_requested: 'UL_1854',
  repair_requested: 'UL_1858',
  arrival_notice: 'UL_1859',
  signup_received: 'UL_1880',
  signup_approved: 'UL_1883',
};

export type TemplateVars = Record<string, string>;

interface TemplateSpec {
  /** 등록한 본문. #{변수} 자리만 값으로 바뀝니다 */
  body: string;
  /** 웹링크 버튼 — 링크의 #{변수} 도 값으로 바뀝니다. 없으면 null */
  button: { name: string; link: string } | null;
  /** 이 템플릿이 반드시 받아야 하는 변수 */
  requires: string[];
}

const ORDER_RECEIVED: TemplateSpec = {
  body:
    '[DenFlow] #{구분} 주문이 접수되었습니다.\n\n' +
    '치과: #{치과명}\n주문번호: #{주문번호}\n환자: #{환자명}\n요청시한: #{요청시한}\n\n' +
    '덴플로우에서 확인해 주세요.',
  button: { name: '주문 확인', link: 'https://denflow.kr/design/orders/#{주문ID}' },
  requires: ['구분', '치과명', '주문번호', '환자명', '요청시한', '주문ID'],
};

export const TEMPLATES: Record<AlimtalkEvent, TemplateSpec> = {
  order_received: ORDER_RECEIVED,
  remake_received: ORDER_RECEIVED,
  production_requested: {
    body:
      '[DenFlow] 제작 의뢰가 도착했습니다.\n\n' +
      '주문번호: #{주문번호}\n환자: #{환자명}\n요청시한: #{요청시한}\n\n' +
      '덴플로우에서 디자인 파일을 내려받으면 제작이 시작됩니다.',
    button: { name: '의뢰 확인', link: 'https://denflow.kr/lab/orders/#{주문ID}' },
    requires: ['주문번호', '환자명', '요청시한', '주문ID'],
  },
  rescan_requested: {
    body:
      '[DenFlow] 재스캔을 요청드립니다.\n\n' +
      '주문번호: #{주문번호}\n환자: #{환자명}\n사유: #{사유}\n\n' +
      '덴플로우 주문 화면에서 스캔 파일을 다시 올려 주세요.',
    button: { name: '다시 올리기', link: 'https://denflow.kr/clinic/orders/#{주문ID}' },
    requires: ['주문번호', '환자명', '사유', '주문ID'],
  },
  repair_requested: {
    body:
      '[DenFlow] 리페어가 접수되었습니다.\n\n' +
      '주문번호: #{주문번호}\n환자: #{환자명}\n요청: #{요청내용}\n\n' +
      '보철물 수거를 택배사에 접수해 주세요.',
    button: { name: '주문 확인', link: 'https://denflow.kr/design/orders/#{주문ID}' },
    requires: ['주문번호', '환자명', '요청내용', '주문ID'],
  },
  arrival_notice: {
    body: '[DenFlow] #{날짜} 배송 도착 예정 안내입니다.\n\n#{환자목록} 님\n\n보철물이 오늘 도착할 예정입니다.',
    button: { name: '오늘 받을 것 보기', link: 'https://denflow.kr/m/today' },
    requires: ['날짜', '환자목록'],
  },
  signup_received: {
    body:
      '[DenFlow] 가입 신청이 접수되었습니다.\n\n' +
      '#{상호} 님, 덴플로우 가입 신청이 접수되었습니다.\n' +
      '디자인센터가 확인한 뒤 승인 안내를 드립니다. 보통 1 영업일 안에 처리됩니다.',
    button: null,
    requires: ['상호'],
  },
  signup_approved: {
    body:
      '[DenFlow] 가입이 승인되었습니다.\n\n' +
      '#{상호} 님, 덴플로우 가입이 승인되었습니다.\n' +
      '이제 로그인하면 주문을 넣을 수 있습니다.',
    button: { name: '로그인', link: 'https://denflow.kr/login' },
    requires: ['상호'],
  },
};

/** '#{이름}' 을 값으로. 값이 없는 변수는 그대로 남깁니다 — 빠진 게 눈에 보이게 */
export function fill(text: string, vars: TemplateVars): string {
  return text.replace(/#\{([^}]+)\}/g, (m, key: string) => (key in vars ? vars[key] : m));
}

export type RenderVerdict =
  | { ok: true; code: string; message: string; button: { name: string; linkMo: string; linkPc: string } | null }
  | { ok: false; reason: string };

/**
 * 보낼 글을 만듭니다. 빠진 변수가 있으면 만들지 않습니다 — 변수 자리가
 * 그대로 나간 알림톡은 카카오가 거절하고, 받아도 망신입니다.
 *
 * ★ 값에 줄바꿈이 있으면 한 칸으로 — 템플릿 대조에서 줄 수가 어긋납니다.
 */
export function renderTemplate(event: AlimtalkEvent, vars: TemplateVars | null | undefined): RenderVerdict {
  const spec = TEMPLATES[event];
  if (!vars) return { ok: false, reason: '변수가 없는 옛 줄입니다' };

  const missing = spec.requires.filter((k) => !(k in vars) || vars[k] === undefined || vars[k] === null);
  if (missing.length > 0) return { ok: false, reason: `변수가 빠졌습니다: ${missing.join(', ')}` };

  const clean: TemplateVars = {};
  for (const [k, v] of Object.entries(vars)) clean[k] = String(v).replace(/\s*\n\s*/g, ' ').trim();

  const message = fill(spec.body, clean);
  const button = spec.button
    ? { name: spec.button.name, linkMo: fill(spec.button.link, clean), linkPc: fill(spec.button.link, clean) }
    : null;

  return { ok: true, code: TEMPLATE_CODE[event], message, button };
}
