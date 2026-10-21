// 기기 상태판 판정 (2026-10-16)
import { describe, it, expect } from 'vitest';
import {
  deviceState,
  sanitizeEvents,
  sanitizeStatus,
  staleWatchers,
  versionBehind,
  deviceRole,
  splitEvents,
  deviceGroup,
} from '@/server/domain/device-health';

const now = Date.parse('2026-10-16T05:00:00Z');

describe('기기 상태', () => {
  it('상태를 안 보낸 옛 판은 꺼졌다고 단정하지 않는다', () => {
    expect(deviceState({ heartbeatAt: null, lastSeenAt: '2026-10-13T00:00:00Z', lastErrorAt: null }, now)).toBe('legacy');
  });
  it('3분 넘게 소식이 없으면 꺼짐', () => {
    expect(deviceState({ heartbeatAt: '2026-10-16T04:56:00Z', lastSeenAt: null, lastErrorAt: null }, now)).toBe('offline');
  });
  it('켜져 있고 한 시간 안에 오류가 있으면 확인 필요', () => {
    expect(deviceState({ heartbeatAt: '2026-10-16T04:59:30Z', lastSeenAt: null, lastErrorAt: '2026-10-16T04:30:00Z' }, now)).toBe('warn');
    expect(deviceState({ heartbeatAt: '2026-10-16T04:59:30Z', lastSeenAt: null, lastErrorAt: '2026-10-16T03:00:00Z' }, now)).toBe('ok');
  });
  it('★ 빠진 것이 있으면 오류가 없어도 확인 필요 (2026-10-16 런처 설정이 조용히 빠짐)', () => {
    const on = { heartbeatAt: '2026-10-16T04:59:30Z', lastSeenAt: null, lastErrorAt: null };
    expect(deviceState({ ...on, status: { missing: ['런처 설정(config.json)'] } }, now)).toBe('warn');
    expect(deviceState({ ...on, status: { missing: [] } }, now)).toBe('ok');
    // 꺼진 것이 먼저입니다
    expect(deviceState({ ...on, heartbeatAt: '2026-10-16T04:50:00Z', status: { missing: ['x'] } }, now)).toBe('offline');
  });
  it('판이 뒤처졌는지', () => {
    expect(versionBehind('1.3.1', '1.3.2')).toBe(true);
    expect(versionBehind('1.3.2', '1.3.2')).toBe(false);
    expect(versionBehind(null, '1.3.2')).toBe(false);
  });
});

describe('기기가 보낸 것을 거른다', () => {
  it('정한 칸만 받고 길이를 자른다', () => {
    const s = sanitizeStatus({ kind: 'clinic', host: 'PC', folderOk: true, patientName: '홍길동', printer: { kind: 'bambu', ok: false, secret: 'x' } });
    expect(s).toEqual({ kind: 'clinic', host: 'PC', folderOk: true, printer: { kind: 'bambu', ip: undefined, ok: false } });
    expect(JSON.stringify(s)).not.toContain('홍길동');
  });
  it('지켜보기 이름은 정한 꼴만', () => {
    expect(sanitizeStatus({ watchers: { temp_watch: 12.4, 'bad name!': 3 } }).watchers).toEqual({ temp_watch: 12 });
  });
  it('오류는 20개·300자까지, 빈 것은 버린다', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ message: `오류 ${i}` }));
    expect(sanitizeEvents(many)).toHaveLength(20);
    expect(sanitizeEvents([{ message: 'x'.repeat(500) }])[0].message).toHaveLength(300);
    expect(sanitizeEvents([{ message: '  ' }, null, 'str'])).toEqual([]);
  });
  it('빠진 것 목록은 10개·120자까지, 글자만', () => {
    const s = sanitizeStatus({ missing: ['설계 열쇠', 3, '', 'y'.repeat(200), ...Array(20).fill('z')] });
    expect(s.missing).toHaveLength(8); // 앞 10개 중 숫자·빈칸 둘 빼고
    expect(s.missing![1]).toHaveLength(120);
    expect(sanitizeStatus({ missing: 'x' }).missing).toBeUndefined();
  });
  it('멈춘 지켜보기', () => {
    expect(staleWatchers({ temp_watch: 20, exocad_watch: 400 })).toEqual(['exocad_watch']);
  });
});

describe('서버 PC / 디자인 PC / 치과 PC (사용자 2026-10-21)', () => {
  it('exocad 지켜보기를 맡은 설계 기기가 디자인 PC, 나머지 설계 기기는 서버 PC', () => {
    expect(deviceRole({ orgType: 'design_center', status: { kind: 'design', watchers: { exocad_watch: 3 }, doing: 'exocad 대기' } })).toBe('design');
    expect(deviceRole({ orgType: 'design_center', status: { kind: 'design', watchers: { temp_watch: 2 }, doing: '대기' } })).toBe('server');
    expect(deviceRole({ orgType: 'clinic', status: { kind: 'clinic' } })).toBe('clinic');
  });

  it('정상 기기는 한 시간 안의 기록 하나만, 문제 기기는 제일 최근 것 하나만 보이고 나머지는 접힘', () => {
    const now = Date.parse('2026-10-21T03:30:00Z');
    const ev = (min: number) => ({ at: new Date(now - min * 60_000).toISOString(), level: 'error' as const, message: 'x' });
    const old = [ev(120), ev(200)];
    expect(splitEvents(old, 'ok', now)).toEqual({ shown: [], folded: old });
    const mixed = [ev(200), ev(10)];
    const r = splitEvents(mixed, 'ok', now);
    expect(r.shown.map((e) => e.at)).toEqual([ev(10).at]);
    expect(r.folded).toHaveLength(1);
    expect(splitEvents(old, 'warn', now).shown).toHaveLength(1);
    expect(splitEvents([], 'offline', now)).toEqual({ shown: [], folded: [] });
  });

  it('묶음 — 꺼짐·확인 필요는 문제, 정상은 정상, 옛 판은 따로', () => {
    expect(deviceGroup('offline')).toBe('trouble');
    expect(deviceGroup('warn')).toBe('trouble');
    expect(deviceGroup('ok')).toBe('fine');
    expect(deviceGroup('legacy')).toBe('legacy');
  });
});
