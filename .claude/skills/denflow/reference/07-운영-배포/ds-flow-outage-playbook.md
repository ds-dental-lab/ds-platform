---
name: ds-flow-outage-playbook
description: 2026-10-10 전면 로그인 불능 사건(PGRST303)과 다시 났을 때의 손 순서
type: project
---

**2026-10-08 17:11(마지막 정상) ~ 2026-10-10 11:00. 약 41시간 아무도 못 들어감.**

## 무슨 일이었나

Supabase 쪽 **시계가 틀어져** DB가 로그인 토큰을 `PGRST303 JWT issued at future`
로 거절했습니다. 두 달 전 발급된 service role 열쇠는 "과거"라 통과 →
**에이전트·알림톡·크론은 멀쩡히 돌고 사람 로그인만** 막혔습니다.

- 화면은 전부 **200**, Supabase 대시보드는 끝까지 **Healthy**, Vercel 오류 **0건**
- 바깥 감시로는 절대 못 잡습니다 — 로그인한 사람에게만 보이는 고장
- 자료·DB·도메인·우리 코드 전부 무관. **Postgres 시계는 정확**했음(pg_cron 실행시각으로 확인)
- 같은 시각 가비아 사칭 피싱메일(`contact@mrmeadow.com`)이 와서 혼선 — 무관

## 다시 나면 (순서대로)

1. 화면 구석 **흐린 회색 코드**를 봅니다 (`PGRST303` 이면 같은 고장)
2. Supabase → Settings → General → 맨 아래 **Restart project** (2분, 자료 안전)
3. 안 들으면 **Pause → Resume** (호스트 시계까지 새로 받음)
4. 그래도면 지원에: *PostgREST rejects fresh user JWTs with PGRST303 while
   service-role JWTs pass; Postgres clock correct; Auth/PostgREST service
   versions blank in dashboard*

★ **자동 재시작은 일부러 안 만들었습니다** — 관리 API 토큰이 계정 전체
권한이고, 오판하면 진료 중에 내려갑니다. 알림 받고 사람이 누릅니다.

## 그때 넣은 안전장치 (커밋 65f97e8 · eb71a69 · 13ce998)

- `getSession` 이 조회 **오류를 안 버립니다** — `lookupFailed`·`troubleCode`.
  전에는 실패와 '소속 없음'이 같은 화면("소속된 조직이 없습니다")으로 떨어져,
  **사장님이 자기 가입을 의심하며 초대 메일을 뒤졌습니다**
- 화면 문구는 **부드럽게**("잠시만 기다려 주세요 … 자료와 계정은 아무 이상
  없습니다"). 본문에 '서버·소속·오류' 금지 — 시험이 막습니다. 코드만 11px 회색
- `events/server-trouble.ts` — 메일(hep789@naver.com, `ALERT_EMAIL` 로 덮어쓰기)
  + 웹푸시, **30분에 한 번**. 재시작 화면 링크가 단추로 맨 위에.
  **service role 로 보내서 막힌 와중에도 나갑니다**

관련: [[ds-flow-deploy]] [[ds-flow-db-guards]]
