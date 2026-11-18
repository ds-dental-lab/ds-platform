import { describe, expect, it } from 'vitest';
import { reportLine, shouldReport, shouldRetry } from '@/server/domain/db-retry';

describe('shouldRetry', () => {
  it('읽기가 못 닿았거나 잠깐 막혔으면 한 번 더 묻습니다', () => {
    expect(shouldRetry('GET', {})).toBe(true);
    expect(shouldRetry(undefined, { status: 503 })).toBe(true);
    expect(shouldRetry('HEAD', { status: 502 })).toBe(true);
    expect(shouldRetry('get', { status: 504 })).toBe(true);
  });

  it('쓰기는 다시 보내지 않습니다 — 두 번 들어갑니다', () => {
    expect(shouldRetry('POST', {})).toBe(false);
    expect(shouldRetry('PATCH', { status: 503 })).toBe(false);
    expect(shouldRetry('DELETE', { status: 503 })).toBe(false);
  });

  it('다시 물어도 같은 답일 것은 묻지 않습니다', () => {
    expect(shouldRetry('GET', { status: 200 })).toBe(false);
    expect(shouldRetry('GET', { status: 401 })).toBe(false);
    expect(shouldRetry('GET', { status: 400 })).toBe(false);
    expect(shouldRetry('GET', { status: 500 })).toBe(false);
  });
});

describe('shouldReport', () => {
  it('못 닿았거나 서버 고장이면 남깁니다', () => {
    expect(shouldReport('/rest/v1/orders', {})).toBe(true);
    expect(shouldReport('/auth/v1/user', { status: 503 })).toBe(true);
  });

  it('자료 쪽의 권한 거절은 남깁니다', () => {
    expect(shouldReport('/rest/v1/order_options', { status: 403 })).toBe(true);
    expect(shouldReport('/rest/v1/orders', { status: 401 })).toBe(true);
  });

  it('평소에도 나오는 답은 남기지 않습니다', () => {
    expect(shouldReport('/rest/v1/orders', { status: 200 })).toBe(false);
    expect(shouldReport('/rest/v1/orders', { status: 406 })).toBe(false);
    expect(shouldReport('/rest/v1/orders', { status: 409 })).toBe(false);
    expect(shouldReport('/auth/v1/token', { status: 400 })).toBe(false);
    expect(shouldReport('/auth/v1/user', { status: 401 })).toBe(false);
  });
});

describe('reportLine', () => {
  it('경로까지만 적습니다', () => {
    expect(reportLine('GET', '/rest/v1/production_option_groups', { status: 503 }, true)).toBe(
      '[db] GET /rest/v1/production_option_groups → 503 (한 번 더 물은 뒤)',
    );
    expect(reportLine(undefined, '/rest/v1/orders', {}, false)).toBe('[db] GET /rest/v1/orders → 닿지 못함');
  });
});
