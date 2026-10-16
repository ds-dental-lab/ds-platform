// 기기 상태판 판정 (2026-10-16)
import { describe, it, expect } from 'vitest';
import {
  deviceState,
  sanitizeEvents,
  sanitizeStatus,
  staleWatchers,
  versionBehind,
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
  it('멈춘 지켜보기', () => {
    expect(staleWatchers({ temp_watch: 20, exocad_watch: 400 })).toEqual(['exocad_watch']);
  });
});
