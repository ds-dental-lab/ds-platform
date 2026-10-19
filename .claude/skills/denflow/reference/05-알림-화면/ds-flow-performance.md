---
name: ds-flow-performance
description: 느림의 정체는 Vercel 콜드 스타트(7분 쉬면 첫 화면 3.7초). 서버·DB·코드 왕복은 이미 빠름. 잰 방법과 넣은 대책
type: project
---

# 반응속도 (사용자 지적 2026-09-06 "전체적으로 반응속도가 너무 느려")

**측정 (운영 denflow.kr, 치과 테스트 계정, 브라우저 판에서 RSC fetch 로 잼)**
- Vercel icn1(서울, vercel.json 이 대시보드 iad1 을 덮어씀) · Supabase 왕복 55ms · Fluid Compute 켜져 있음 · **Hobby 플랜**(지역 1개, cron 하루 1회).
- 계속 쓰는 중 탭 = 서버 130~320ms, 내용 표시 0.5초. 주문상세도 같음.
- **7분 쉬었다 첫 화면 = 3.7초** (콜드 스타트). 함수 19MB 중 10MB 가 sharp.
- 열린 탭은 AutoRefresh 가 20초마다 서버를 두드려 **탭이 열려 있으면 안 잠듦** — 5분 대기 측정이 헛돈 이유.

**넣은 대책 (커밋 82667d4)**
- `outputFileTracingExcludes` 로 sharp·@img 제외 → 추적 16MB→6MB.
- **깨우기 = Supabase pg_cron + pg_net, 1분마다** /clinic /design /lab /m (헤더 `x-denflow-warm: 1`, proxy 가 그 요청만 통과 → 화면 함수가 돌고 /login 으로 redirect) + /api/warm. job 이름 warm-denflow (migrations 20260906120000~130000). 끄려면 `select cron.unschedule('warm-denflow')`. 도는지 보기: `warm_ping_status()` RPC (service_role 전용, scripts_warm_status.mjs).
- **배운 것**: `/` 나 /api/warm 을 깨워도 /clinic 은 안 깸 — Vercel 은 화면 묶음마다 프로세스가 다름. 4분 핑은 3분 만에 다시 잠듦 → 1분. 화면 직접 핑 뒤 9분 idle 첫 화면 **3.7s → 1.2s**, 이어지는 화면 0.3s. 남은 0.8s 는 미해결(첫 실제 요청의 모듈 적재·JWKS 추정).
- 탭(SectorShell)·주문 줄(OrderTableRow)에 `router.prefetch(href, { kind: 'full' })` on hover, `staleTimes.static: 30`. **Next 16 은 기본 kind 가 auto(뼈대만)** — 처음엔 안 먹혀 운영에서 잡음. 고친 뒤 hover→click 에 서버 요청 0건 확인.
- 사이드바 Link 는 `prefetch={false}` — 화면 옮길 때마다 탭 7개×2회 자동 미리 받기가 돌고 있었음(각각 레이아웃 세션·알림 조회 실행). 배포 후 0회 확인.
- 배포 함수 크기 18.97MB → 2.96MB (vercel inspect).

**Why:** 코드 왕복은 이미 다 줄여 둔 상태라 더 짜낼 게 없었고, 사용자가 느끼는 건 콜드 스타트였음.
**How to apply:** 느리다는 말이 또 나오면 먼저 "얼마나 쉬었다가 눌렀는지" 를 묻고, 핑이 살아 있는지 /api/warm 로그를 볼 것. 로컬 dev 브라우저 판은 스트리밍 조각을 못 펼쳐 체감 측정에 못 씀 — RSC fetch 시간으로 잼. 관련: [[ds-flow-deploy]] [[ds-flow-backlog]]
