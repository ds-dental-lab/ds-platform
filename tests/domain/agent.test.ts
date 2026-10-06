// =========================================================
// 놓을 위치: tests/domain/agent.test.ts
// 기준: 사용자 요청 2026-10-06 — 치과마다 어느 판이 깔렸는지 알아야 함
//
// ★ 여기서 못 박는 것은 "새 판을 알린다" 가 아니라 **잘못 알리지 않는다**
//   입니다. 멀쩡한 치과에 "새 판이 있습니다" 가 계속 뜨면 그 알림을
//   아무도 안 믿게 되고, 진짜 올려야 할 날에도 안 누릅니다.
// =========================================================

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  AGENT_VERSION,
  agentUpdate,
  cleanVersion,
  olderThan,
} from '@/server/domain/agent';

describe('판 번호 견주기', () => {
  it('뒤면 뒤라고 합니다', () => {
    expect(olderThan('1.0.0', '1.1.0')).toBe(true);
    expect(olderThan('1.0.9', '1.1.0')).toBe(true);
    expect(olderThan('0.9.0', '1.0.0')).toBe(true);
  });

  it('같거나 앞서면 안 알립니다', () => {
    expect(olderThan('1.1.0', '1.1.0')).toBe(false);
    expect(olderThan('1.2.0', '1.1.0')).toBe(false);
    // ★ 시험판을 깔아 둔 PC 가 있을 수 있습니다. 되돌리라고 하지 않습니다
    expect(olderThan('2.0.0', '1.1.0')).toBe(false);
  });

  it('글자가 아니라 숫자로 견줍니다', () => {
    // ★ 글자로 비교하면 '1.10.0' 이 '1.9.0' 보다 작아집니다
    expect(olderThan('1.9.0', '1.10.0')).toBe(true);
    expect(olderThan('1.10.0', '1.9.0')).toBe(false);
  });

  it('자리 수가 달라도 됩니다', () => {
    expect(olderThan('1.1', '1.1.1')).toBe(true);
    expect(olderThan('1.1.0', '1.1')).toBe(false);
  });

  it('모양이 이상하면 **알리지 않습니다**', () => {
    for (const bad of ['', '어제판', '1', 'v1.1.0', '1.1.0-beta', '-1.0', '1.1.1.1.1']) {
      expect(olderThan(bad, '1.1.0')).toBe(false);
    }
  });
});

describe('에이전트에 내려보내는 답', () => {
  it('늘 최신 판과 받는 곳을 함께 줍니다', () => {
    const got = agentUpdate('1.0.0');
    expect(got.latest).toBe(AGENT_VERSION);
    expect(got.url).toMatch(/^https:\/\//);
    expect(got.note.length).toBeGreaterThan(0);
    expect(got.outdated).toBe(true);
  });

  it('판 번호를 안 보내도 죽지 않습니다', () => {
    for (const v of [undefined, null, 3, {}]) {
      expect(agentUpdate(v).outdated).toBe(false);
    }
  });
});

describe('표에 적을 판 번호', () => {
  it('모양이 맞는 것만 적습니다', () => {
    expect(cleanVersion('1.1.0')).toBe('1.1.0');
    expect(cleanVersion(' 1.1 ')).toBe('1.1');
    expect(cleanVersion('v1.1.0')).toBeNull();
    expect(cleanVersion('아무거나')).toBeNull();
    expect(cleanVersion(null)).toBeNull();
    expect(cleanVersion('1'.repeat(40))).toBeNull();
  });
});

describe('에이전트와 서버의 판 번호가 같아야 합니다', () => {
  /*
    ★★ 둘이 어긋나면 **모든 치과에 "새 판이 있습니다" 가 영원히 뜹니다**
      (또는 새 판을 내놓고도 아무도 모릅니다). 사람이 두 군데를 같이
      고치는 일이라 꼭 틀립니다 — 그래서 시험이 봅니다.
  */
  it('scan_agent.py 의 AGENT_VERSION 과 같습니다', () => {
    const py = fs.readFileSync(
      path.join(process.cwd(), 'tools/exocad-launcher/scan_agent.py'),
      'utf8',
    );
    const m = py.match(/^AGENT_VERSION\s*=\s*["']([\d.]+)["']/m);
    expect(m, 'scan_agent.py 에 AGENT_VERSION 이 없습니다').not.toBeNull();
    expect(m?.[1]).toBe(AGENT_VERSION);
  });
});
