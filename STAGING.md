# 시험 서버 나누기

**왜 하나.** 지금은 `localhost` 도 배포된 사이트도 **같은 운영 DB** 를 봅니다.
2026-08-13 에 그걸 시험이라고 여기고 청구서를 발행했고, 번호가 진짜로
소모됐습니다(INV-26000011). **8월 26일에 실사용이 시작되면 그 실수는
진짜 거래처의 청구서 번호를 태웁니다.**

나뉘는 것은 **DB · 파일 · 계정**입니다. 코드와 배포는 이미 나뉘어 있습니다.

---

## 1. 사장님이 하실 것 — Supabase 프로젝트 만들기

제가 못 하는 부분입니다(대시보드 로그인이 필요합니다).

1. https://supabase.com/dashboard → **New project**
2. 이렇게 채웁니다.

   | 칸 | 값 |
   |---|---|
   | Name | `denflow-staging` |
   | Region | **Northeast Asia (Seoul)** ← 운영과 같게 |
   | Database Password | 새로 정하고 **어딘가 적어 두세요** |

   ★ 리전을 다르게 잡으면 느려집니다. 운영이 `ap-northeast-2` 입니다.

   ★ 무료 계정의 프로젝트 개수 제한에 걸릴 수 있습니다. 걸리면
     알려 주세요 — 다른 방법(로컬 Supabase)이 있습니다.

3. 만들어지면 **Settings → API** 에서 세 값을 복사해 주세요.

   - Project URL
   - `anon` `public` 키
   - `service_role` 키 ← **비밀입니다. 채팅에 붙이지 마시고 아래처럼
     파일에 직접 넣어 주세요.**

4. 저장소 폴더에 `.env.staging.local` 을 만들고 이렇게 적습니다.

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<새-프로젝트>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon 값>
   SUPABASE_SERVICE_ROLE_KEY=<service_role 값>
   NEXT_PUBLIC_ENV_LABEL=staging
   ```

   ★ **PowerShell 로 `>>` 하지 마세요.** 줄바꿈 없이 앞 줄에 붙고
     UTF-16 이라 NUL 이 낍니다. 실제로 그래서 로그인이 통째로 막힌 적이
     있습니다. 메모장이나 VS Code 로 만드세요.

---

## 2. 제가 이어받을 것

4번까지 되면 알려만 주세요.

- [ ] 마이그레이션 **66건** 을 staging 에 적용 (`supabase db push`)
- [ ] 저장소 버킷 `order-files` 만들기 (마이그레이션에 없습니다)
- [ ] 시험 계정 셋 만들기 — `clinic@test.kr` · `design@test.kr` · `lab@test.kr`
- [ ] `supabase/seed.sql` 로 조직·거래관계·제품·단가 심기
- [ ] `.env.local` 을 staging 으로 돌리기 → **제 localhost 가 운영을 못 건드림**
- [ ] 띠가 뜨는지 확인 (`NEXT_PUBLIC_ENV_LABEL=staging`)

---

## 3. Vercel 환경변수 가르기

대시보드 작업이라 사장님이 하셔야 합니다. **Settings → Environment Variables** 에서
같은 이름의 값을 환경별로 다르게 넣습니다.

| 변수 | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 운영 | staging |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 운영 | staging |
| `SUPABASE_SERVICE_ROLE_KEY` | 운영 | staging |
| `NEXT_PUBLIC_ENV_LABEL` | **비워 둠** | `preview` |

그러면 이렇게 굴러갑니다.

```
master 브랜치  →  운영 배포   →  운영 DB    (띠 없음)
다른 브랜치    →  미리보기    →  staging DB (주황 띠)
```

★ **Vercel 은 빌드할 때 값을 박습니다.** 바꾼 뒤 반드시 재배포하세요.
  "Use existing Build Cache" 를 켜면 또 안 먹습니다.

★ `SUPABASE_SERVICE_ROLE_KEY` 에 `NEXT_PUBLIC_` 을 붙이면 안 됩니다.
  브라우저로 새어 나갑니다.

---

## 4. 나눈 뒤에 달라지는 것

- **마이그레이션을 두 곳에 적용**해야 합니다. staging 에서 먼저 돌려 보고
  운영에 올리는 순서가 됩니다 — 이게 원래 맞는 순서입니다.
- staging 의 자료는 **운영에서 복사되지 않습니다.** 계정도 따로 만듭니다.
- 화면 오른쪽 위 **주황 띠**가 시험 환경의 표시입니다. 운영에는 안 뜹니다.

## 5. 지금 확인하는 법

```bash
npm run check-env
```

첫 줄에 지금 보는 DB 가 찍힙니다. 운영이면 그렇다고 크게 알립니다.
