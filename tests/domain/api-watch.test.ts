import { describe, expect, it } from 'vitest';
import {
  apiAlertMail,
  apiAlertSubject,
  koreanTime,
  readApiAlert,
  warmAnswer,
} from '@/server/domain/api-watch';

describe('readApiAlert — DB 가 보낸 몸통', () => {
  it('죽었다는 알림을 읽습니다', () => {
    expect(
      readApiAlert({ kind: 'down', where: 'api', status: 503, detail: 'PGRST002', since: '2026-11-11T16:00:00Z' }),
    ).toEqual({ kind: 'down', where: 'api', status: 503, detail: 'PGRST002', since: '2026-11-11T16:00:00Z' });
  });

  it('모양이 다르면 보내지 않습니다', () => {
    expect(readApiAlert(null)).toBeNull();
    expect(readApiAlert('down')).toBeNull();
    expect(readApiAlert({ kind: 'maybe' })).toBeNull();
  });

  it('답이 없었던 경우 — status 는 null', () => {
    expect(readApiAlert({ kind: 'down', status: null, detail: 'timeout' })?.status).toBeNull();
  });

  it('메일에 들어갈 글자에서 꺾쇠를 빼고 길이를 자릅니다', () => {
    const alert = readApiAlert({ kind: 'down', detail: `<script>${'x'.repeat(500)}` });
    expect(alert?.detail).not.toMatch(/[<>]/);
    expect(alert?.detail.length).toBeLessThanOrEqual(200);
  });

  it('이상한 시각은 버립니다', () => {
    expect(readApiAlert({ kind: 'up', since: 'yesterday' })?.since).toBeNull();
  });
});

describe('알림 메일', () => {
  const down = { kind: 'down' as const, where: 'api' as const, status: 503, detail: 'PGRST002', since: '2026-11-11T18:10:00Z' };

  it('죽었을 때 — 눌러야 할 곳과 코드, 한국 시각이 들어갑니다', () => {
    const html = apiAlertMail(down);
    expect(html).toContain('Restart project');
    expect(html).toContain('supabase.com/dashboard/project');
    expect(html).toContain('503 · PGRST002');
    expect(html).toContain('11월 12일 03:10');
    expect(apiAlertSubject(down)).toContain('재시작');
  });

  it('돌아왔을 때 — 재시작 단추가 없습니다', () => {
    const up = { ...down, kind: 'up' as const };
    expect(apiAlertMail(up)).not.toContain('Restart project');
    expect(apiAlertSubject(up)).toContain('정상');
  });

  it('답이 없었으면 "답 없음" 이라고 적습니다', () => {
    expect(apiAlertMail({ ...down, status: null, detail: '' })).toContain('답 없음');
  });
});

describe('koreanTime', () => {
  it('UTC 를 한국 시각으로', () => {
    expect(koreanTime('2026-11-11T15:56:00Z')).toBe('11월 12일 00:56');
  });
  it('없으면 빈 글', () => {
    expect(koreanTime(null)).toBe('');
  });
});

describe('warmAnswer — 감시 핑의 답', () => {
  it('읽히면 200 ok', () => {
    expect(warmAnswer(null)).toEqual({ status: 200, body: 'ok' });
  });

  it('못 읽으면 503 db-fail:코드 — DB 의 지켜보기가 이 글자를 찾습니다', () => {
    expect(warmAnswer({ code: 'PGRST002', message: 'Could not query' })).toEqual({
      status: 503,
      body: 'db-fail:PGRST002',
    });
  });

  it('코드가 없으면 메시지를, 그것도 없으면 unknown', () => {
    expect(warmAnswer({ message: 'TimeoutError' }).body).toBe('db-fail:TimeoutError');
    expect(warmAnswer({}).body).toBe('db-fail:unknown');
  });
});
