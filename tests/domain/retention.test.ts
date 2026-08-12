// =========================================================
// 놓을 위치: tests/domain/retention.test.ts
// 기준: 법률 검토 2026-08-12 — 보관기간과 파기
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  RETENTION_TARGETS,
  RETENTION_META,
  checkKeepDays,
  cutoffFor,
  formatDays,
  canPurge,
  MAX_KEEP_DAYS,
} from '@/server/domain/retention';

describe('항목', () => {
  it('세 항목 모두 설명이 있습니다', () => {
    for (const t of RETENTION_TARGETS) {
      const meta = RETENTION_META[t];
      expect(meta.label).toBeTruthy();
      expect(meta.what).toBeTruthy();
      expect(meta.from).toBeTruthy();
      // ★ 정하기 전에 알아야 할 것을 안 적으면 아무 숫자나 넣습니다
      expect(meta.caution).toBeTruthy();
      expect(meta.suggestedWhy).toBeTruthy();
    }
  });

  it('열람 기록은 가장 길게 제안합니다', () => {
    expect(RETENTION_META.audit_log.suggestedDays).toBeGreaterThan(
      RETENTION_META.order_file.suggestedDays,
    );
    expect(RETENTION_META.order_file.suggestedDays).toBeGreaterThan(
      RETENTION_META.soft_deleted.suggestedDays,
    );
  });
});

describe('보관기간 검사', () => {
  // ★ 0 을 '즉시 파기' 로 읽으면 손이 미끄러진 순간 다 사라집니다
  it('★ 안 정한 것(null)은 통과하고, 0일은 막습니다', () => {
    expect(checkKeepDays(null)).toEqual({ ok: true });
    expect(checkKeepDays(0).ok).toBe(false);
    expect(checkKeepDays(-1).ok).toBe(false);
  });

  it('하루부터 10년까지', () => {
    expect(checkKeepDays(1)).toEqual({ ok: true });
    expect(checkKeepDays(MAX_KEEP_DAYS)).toEqual({ ok: true });
    expect(checkKeepDays(MAX_KEEP_DAYS + 1).ok).toBe(false);
  });

  it('소수는 막습니다', () => {
    expect(checkKeepDays(30.5).ok).toBe(false);
  });
});

describe('언제 이전 것을 지우는가', () => {
  const NOW = new Date('2026-08-12T00:00:00Z');

  it('오늘에서 그만큼 뺍니다', () => {
    expect(cutoffFor(30, NOW)?.toISOString()).toBe('2026-07-13T00:00:00.000Z');
    expect(cutoffFor(365, NOW)?.toISOString()).toBe('2025-08-12T00:00:00.000Z');
  });

  // ★ 이게 이 파일에서 제일 중요한 줄입니다
  it('★ 안 정했으면 자를 곳이 없습니다 — 아무것도 안 지웁니다', () => {
    expect(cutoffFor(null, NOW)).toBeNull();
  });
});

describe('누를 수 있는가', () => {
  it('안 정한 항목은 못 누릅니다', () => {
    expect(canPurge({ target: 'audit_log', keepDays: null, due: 100, cutoff: null })).toBe(false);
  });

  // 빈 파기 기록만 쌓입니다
  it('지울 것이 없으면 못 누릅니다', () => {
    expect(canPurge({ target: 'audit_log', keepDays: 30, due: 0, cutoff: 'x' })).toBe(false);
  });

  it('정했고 지울 것이 있으면 누릅니다', () => {
    expect(canPurge({ target: 'audit_log', keepDays: 30, due: 3, cutoff: 'x' })).toBe(true);
  });
});

describe('기간 표기', () => {
  it('사람이 읽는 말로', () => {
    expect(formatDays(365)).toBe('1년');
    expect(formatDays(730)).toBe('2년');
    expect(formatDays(90)).toBe('3개월');
    expect(formatDays(30)).toBe('30일');
    expect(formatDays(45)).toBe('45일');
  });

  it('안 정했으면 그렇게 말합니다', () => {
    expect(formatDays(null)).toBe('안 지움');
  });
});
