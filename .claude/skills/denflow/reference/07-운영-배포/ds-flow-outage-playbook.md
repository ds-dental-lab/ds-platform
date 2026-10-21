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

## 주문완료 누르자 로그인 화면으로 (2026-10-21, 치ㅣ 시험 주문 셋 중 둘)
- 증상: 브라우저 창에서 주문등록 폼을 채우고 **주문완료를 누른 직후** `/login` 으로 떨어짐 (13:08, 13:27 KST). 주문은 만들어졌음. 몇 분 뒤 같은 쿠키로 주문등록 화면이 다시 열림 → 세션이 죽은 게 아니라 **그 한 번의 검증이 실패**한 것.
- 주소가 단서: 문 앞(proxy.ts)이 보내면 `/login?next=…` 가 붙음. 단순 `/login` 은 `requireSession` 의 `redirect('/login')` — 즉 **화면을 그리는 쪽의 getSession 이 빈손**이었음. 주문이 생기면 20초 자국 묻기(AutoRefresh)가 바뀐 걸 보고 `router.refresh()` 를 부르는데, 그 다시 그리기에서 getClaims 가 실패했다고 봄 (만료 90초 전 갱신이 두 요청에 겹침, 또는 공개키 받기 실패 — 확정은 못 함).
- 10:36 로그인 → 12:31 (GET 이동) 때는 `?next=` 붙은 쪽이었음 — 그건 토큰 만료 뒤 갱신 실패(쿠키 없이 1시간 55분 방치).
- 고침: `policies/session.ts` getSession — claims 가 비어도 인증 쿠키가 있으면 **getUser 로 한 번 더 확인**(proxy 와 같은 길), 결과를 `[session] 토큰 검증 실패 → 인증 서버에 재확인` 으로 console.error → Vercel 로그에서 찾을 수 있음.
- 못 본 것(사용자 손): Supabase 대시보드 Authentication 로그에서 10/21 13:08·13:27 KST 치ㅣ 계정의 token refresh 오류, 그리고 Sessions 설정의 **JWT 만료 시간·refresh token reuse interval**. 대시보드·Vercel 로그는 내 브라우저 창에서 로그인이 풀려 못 들어감.
