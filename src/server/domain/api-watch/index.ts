// =========================================================
// 놓을 위치: src/server/domain/api-watch/index.ts
//
// "자료를 꺼내 주는 서버가 죽었다" 알림의 규칙. (2026-11-12)
//
// ★ 기준 사건: 2026-11-12 새벽 ~ 11:39. Supabase 의 API 서버만 503(PGRST002)으로
//   죽었고, 화면·로그인·DB 는 전부 멀쩡했습니다. 로그인은 되는데 안에서 아무것도
//   못 읽는 상태가 10시간쯤 이어졌고 **아무 알림도 없었습니다** —
//   감시 핑(/api/warm)은 DB 를 안 읽고 "ok" 만 답했고, 기존 장애 알림은
//   죽은 그 API 서버를 거쳐야 나갈 수 있었습니다.
//
// ★ 그래서 지켜보는 쪽을 **DB 안**에 둡니다 (pg_cron · api_watch_tick).
//   DB 는 그날도 살아 있었습니다. DB 가 API 서버를 직접 찔러 보고,
//   연달아 실패하면 /api/jobs/api-watch 로 알립니다.
//   이 길은 **Supabase 를 한 번도 거치지 않습니다** — 메일만 보냅니다.
// =========================================================

/** 사람이 눌러야 하는 곳 — Supabase 재시작 화면 */
export const RESTART_URL =
  'https://supabase.com/dashboard/project/dzliwedyqkondvcwnvbh/settings/general';

export interface ApiAlert {
  /** down — 죽었다 · up — 돌아왔다 */
  kind: 'down' | 'up';
  /** api — DB 가 API 서버를 직접 찔렀을 때 · site — 화면 서버가 자료를 못 읽을 때 */
  where: 'api' | 'site';
  /** API 서버가 답한 코드 (503 …). 답이 없었으면 null */
  status: number | null;
  /** 답의 앞머리 (PGRST002 …) */
  detail: string;
  /** 처음 실패를 본 시각 (ISO) */
  since: string | null;
}

/** DB 가 보낸 몸통을 믿을 만한 모양으로. 모양이 다르면 null — 보내지 않습니다 */
export function readApiAlert(body: unknown): ApiAlert | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  if (b.kind !== 'down' && b.kind !== 'up') return null;
  const where = b.where === 'site' ? 'site' : 'api';
  const status = typeof b.status === 'number' && Number.isFinite(b.status) ? b.status : null;
  // ★ 메일에 그대로 들어가는 글자입니다 — 길이를 자르고 꺾쇠를 뺍니다
  const detail = typeof b.detail === 'string' ? b.detail.replace(/[<>]/g, ' ').slice(0, 200) : '';
  const since = typeof b.since === 'string' && !Number.isNaN(Date.parse(b.since)) ? b.since : null;

  return { kind: b.kind, where, status, detail, since };
}

export function apiAlertSubject(alert: ApiAlert): string {
  return alert.kind === 'down'
    ? '[덴플로우] 접속은 되는데 자료를 못 읽고 있습니다 — 재시작이 필요합니다'
    : '[덴플로우] 다시 정상입니다';
}

/** 한국 시각으로 "11월 12일 03:10" */
export function koreanTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 3600_000);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${two(k.getUTCHours())}:${two(k.getUTCMinutes())}`;
}

/**
 * 새벽에 폰으로 읽는 글입니다 — **무엇을 눌러야 하는지**가 제일 위에 옵니다.
 */
export function apiAlertMail(alert: ApiAlert): string {
  const since = koreanTime(alert.since);

  if (alert.kind === 'up') {
    return `
<div style="font-family:-apple-system,'Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1A2130">
  <h2 style="margin:0 0 6px;font-size:17px">다시 정상입니다</h2>
  <p style="margin:0;font-size:14px;color:#4A5567">
    자료를 꺼내 주는 서버가 다시 답합니다.${since ? ` 멈춰 있던 것은 ${since} 부터였습니다.` : ''}
  </p>
</div>`.trim();
  }

  const what =
    alert.where === 'site'
      ? '화면 서버가 자료를 읽지 못하고 있습니다'
      : '자료를 꺼내 주는 서버(Supabase API)가 답하지 않습니다';
  const code = [alert.status ?? '답 없음', alert.detail].filter(Boolean).join(' · ');

  return `
<div style="font-family:-apple-system,'Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1A2130">
  <h2 style="margin:0 0 6px;font-size:17px">접속은 되는데 자료를 못 읽고 있습니다</h2>
  <p style="margin:0 0 18px;font-size:14px;color:#4A5567">
    ${what}. 로그인은 되지만 <b>치과를 포함해 모두</b>가 주문을 못 봅니다.${since ? ` ${since} 부터입니다.` : ''}
  </p>

  <a href="${RESTART_URL}"
     style="display:inline-block;background:#1279E8;color:#fff;text-decoration:none;
            font-weight:700;font-size:14px;padding:12px 20px;border-radius:8px">
    Supabase 에서 Restart project 누르기
  </a>

  <p style="margin:18px 0 6px;font-size:13.5px;color:#4A5567">
    눌러서 들어간 뒤 <b>Settings → General → 맨 아래 Restart project</b> 입니다.
    2분쯤 걸리고, 자료는 그대로입니다. 돌아오면 "다시 정상입니다" 메일이 한 번 더 옵니다.
  </p>

  <p style="margin:14px 0 0;font-size:12.5px;color:#98A2B3">
    <code>${code}</code>
  </p>
  <p style="margin:6px 0 0;font-size:12.5px;color:#98A2B3">
    멈춰 있는 동안 한 시간에 한 번 다시 보냅니다.
  </p>
</div>`.trim();
}

/**
 * 감시 핑(/api/warm)이 자료를 읽어 본 결과 → 답.
 *
 * ★ 실패하면 몸통이 `db-fail:` 로 시작합니다. DB 의 지켜보기(api_watch_tick)가
 *   이 글자를 찾으니 **바꾸면 그쪽도 같이** 바꿔야 합니다.
 */
export function warmAnswer(error: { code?: string; message?: string } | null): {
  status: number;
  body: string;
} {
  if (!error) return { status: 200, body: 'ok' };
  const code = (error.code || error.message || 'unknown').replace(/[^\w .:-]/g, ' ').slice(0, 60);
  return { status: 503, body: `db-fail:${code}` };
}
