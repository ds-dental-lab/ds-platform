// =========================================================
// 놓을 위치: src/server/exocad/token.ts
//
// exocad 런처용 일회용 토큰 — 서명과 검증. (2026-09-09)
//
// ★ 왜 DB 가 아니라 서명인가: 토큰은 10분 살고, 주문 하나에 묶이고,
//   그 안에 런처가 두 번(정보, 결과) 부르면 끝입니다. 표를 만들어 줄을
//   넣고 지우는 것보다 HMAC 한 줄이 단순하고 틀릴 곳이 없습니다.
// ★ 열쇠는 JOB_SECRET 을 씁니다 — 이미 Vercel 에 있고, 서버 밖으로 안
//   나갑니다. 토큰을 쥔 사람은 열쇠를 못 알아냅니다 (HMAC 의 성질).
// ★ PC 에 장기 비밀을 두지 않습니다 — 런처는 URL 로 받은 토큰만 씁니다.
// =========================================================

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { EXOCAD_TOKEN_TTL_SECONDS, exocadTokenMessage } from '@/server/domain/exocad';

function secret(): string | null {
  return process.env.JOB_SECRET ?? null;
}

function sign(message: string, key: string): string {
  return createHmac('sha256', key).update(message).digest('base64url');
}

/** 만료(초, epoch).서명 — 주문 id 는 URL 경로에 따로 있어 토큰에 안 넣습니다 */
export function issueExocadToken(orderId: string, now: Date = new Date()): string | null {
  const key = secret();
  if (!key) return null;
  const expiresAt = Math.floor(now.getTime() / 1000) + EXOCAD_TOKEN_TTL_SECONDS;
  return `${expiresAt}.${sign(exocadTokenMessage(orderId, expiresAt), key)}`;
}

export type TokenCheck = { ok: true } | { ok: false; reason: string };

export function verifyExocadToken(orderId: string, token: string | null, now: Date = new Date()): TokenCheck {
  const key = secret();
  if (!key) return { ok: false, reason: '서버에 열쇠(JOB_SECRET)가 없습니다' };
  if (!token) return { ok: false, reason: '토큰이 없습니다' };

  const dot = token.indexOf('.');
  if (dot <= 0) return { ok: false, reason: '토큰 모양이 아닙니다' };
  const expiresAt = Number(token.slice(0, dot));
  const given = token.slice(dot + 1);
  if (!Number.isFinite(expiresAt)) return { ok: false, reason: '토큰 모양이 아닙니다' };
  if (expiresAt * 1000 < now.getTime()) return { ok: false, reason: '토큰이 만료됐습니다. 버튼을 다시 누르세요' };

  const expected = sign(exocadTokenMessage(orderId, expiresAt), key);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: '토큰이 맞지 않습니다' };
  return { ok: true };
}
