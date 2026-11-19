import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deviceRefusal } from '@/server/domain/device-link';

describe('deviceRefusal', () => {
  it('없는 기기는 401 — 에이전트가 다시 보내지 않습니다', () => {
    expect(deviceRefusal('unknown')).toEqual({ status: 401, error: '연결되지 않은 기기입니다' });
  });

  it('확인을 못 한 것은 503 — 없는 기기와 다른 말입니다', () => {
    const r = deviceRefusal('failed');
    expect(r.status).toBe(503);
    expect(r.error).not.toBe(deviceRefusal('unknown').error);
  });

  it('확인 실패 문구는 프린터 쪽이 거절로 읽는 말을 담지 않습니다', () => {
    // print_loop.py 의 REJECTED 를 그대로 읽습니다 — 목록이 늘어도 이 시험이 따라갑니다
    const src = readFileSync('tools/exocad-launcher/print_loop.py', 'utf8');
    const line = src.split('\n').find((l) => l.startsWith('REJECTED = '));
    expect(line).toBeTruthy();
    const words = [...line!.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(words.length).toBeGreaterThan(3);

    const failed = deviceRefusal('failed').error;
    for (const w of words) expect(failed).not.toContain(w);
    // 거꾸로, 없는 기기는 거절로 읽혀야 합니다
    expect(words.some((w) => deviceRefusal('unknown').error.includes(w))).toBe(true);
  });
});

describe('열쇠 읽기', () => {
  it('길목이 Bearer 를 떼어 내는 식이 옛 길목과 같습니다', () => {
    // 패치가 `\s` 를 잃어 'Bearers+' 가 된 적이 있습니다 (2026-11-19) — 그러면 모든 기기가 거절당합니다
    const src = readFileSync('src/server/repositories/device-link.ts', 'utf8');
    expect(src).toContain(String.raw`replace(/^Bearer\s+/i, '')`);
  });
});
