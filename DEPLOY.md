# 배포 안내

DS Flow 를 실제 웹에 올리는 순서입니다. **Supabase 는 이미 떠 있고**
(`ap-northeast-2` 서울), 앞단만 올리면 됩니다.

프로덕션 빌드는 통과합니다 — `npm run build`.

---

## 1. GitHub 에 올리기

```bash
git push origin master
```

저장소는 이미 연결돼 있습니다 (`ds-dental-lab/ds-platform`).

> **저장소가 공개(public)인지 확인하세요.** 코드에 열쇠는 없지만,
> 공개 저장소면 사업 로직이 그대로 보입니다.

## 2. Vercel 연결

1. [vercel.com](https://vercel.com) 에 GitHub 계정으로 로그인
2. **Add New → Project** → `ds-platform` 선택
3. 설정은 **건드리지 않습니다** — Next.js 를 알아서 알아봅니다

## 3. ★ 환경변수 3개

Vercel 의 **Settings → Environment Variables** 에 넣습니다.
값은 `.env.local` 에 있는 것과 같습니다.

| 이름 | 어디서 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 곳의 **anon** 값 |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 곳의 **service_role** 값 |

> ★ **`SUPABASE_SERVICE_ROLE_KEY` 에 `NEXT_PUBLIC_` 을 붙이면 안 됩니다.**
> 그 접두어가 붙는 순간 브라우저로 내려갑니다. 이 열쇠는 RLS 를 통째로
> 무시하므로, 새는 순간 모든 환자 정보가 열립니다.

세 개 모두 Production · Preview · Development 에 체크합니다.

## 4. ★ Supabase 인증 주소 (제일 잘 빠뜨립니다)

Supabase → **Authentication → URL Configuration**

| 칸 | 값 |
|---|---|
| **Site URL** | 배포된 주소 (예: `https://ds-platform.vercel.app`) |
| **Redirect URLs** | 위 주소 + `/reset` 을 추가 |

**이걸 안 하면 비밀번호 찾기가 통째로 안 됩니다.** 메일의 링크가 허용
목록에 없는 주소로 가려 해서 Supabase 가 막습니다. 화면은 멀쩡한데
링크만 죽어서, 원인을 찾기가 아주 어렵습니다.

나중에 회사 도메인을 붙이면 **여기도 같이 바꿔야 합니다.**

## 5. 올린 뒤 확인 (10분)

실제 기기(휴대폰 포함)에서 해 보세요. 개발 환경에서만 되던 것이 여기서 드러납니다.

- [ ] `/login` 이 열린다
- [ ] 로그인이 된다 (쿠키가 https 에서도 붙는지)
- [ ] `/privacy` 가 **로그인 없이** 열리고 보관기간 표가 채워져 있다
- [ ] `/playground/tooth-chart` 가 **404 다** (시연 화면은 배포에서 막힙니다)
- [ ] 주문을 하나 넣고 **스캔 파일 업로드**가 된다 ← 제일 잘 깨지는 곳
- [ ] 올린 파일이 **내려받아진다** (서명 URL)
- [ ] 비밀번호 찾기 메일이 오고, **링크를 누르면 새 비밀번호 칸**이 뜬다
- [ ] 휴대폰에서 화면이 안 깨진다

## 6. 아직 남은 것

| | 왜 막혀 있나 |
|---|---|
| **메일 발송 한도** | Supabase 기본 발송함이라 **시간당 몇 통**입니다. 가입 확인·비밀번호 찾기가 막힙니다. 도메인 + 발송 서비스(Resend 등)를 붙여야 풀립니다 |
| **청구서 이메일** | 위와 같은 이유. 지금 '재발송' 은 사람이 보내고 눌러 두는 기록입니다 |
| **처리방침 시행** | 사업자등록 전이라 **초안**으로 두는 중입니다 |
| **PDF 자동 저장** | 한글 글꼴 라이선스 확인이 필요합니다. 지금은 인쇄창까지 |

## 7. 도메인 붙이기 — `denflow.kr` (가비아에서 구입)

**순서가 중요합니다.** Vercel 에서 값을 먼저 받고 → 가비아에 넣고 →
마지막에 Supabase. 거꾸로 하면 중간에 몇 시간 동안 주소가 죽습니다.

### 7-1. Vercel 에 도메인 등록하고 값 받기

Vercel → 프로젝트 `ds-platform` → **Settings → Domains → Add**

- `denflow.kr` 추가
- `www.denflow.kr` 도 추가하고 **`denflow.kr` 로 Redirect** 를 고릅니다

> ★ 둘 다 살려 두지 마세요. 같은 화면이 두 주소로 열리면 검색 결과가
>   갈리고, 거래처마다 다른 주소를 외웁니다. **하나를 정본으로.**

추가하면 Vercel 이 **넣어야 할 DNS 값을 화면에 그대로 띄웁니다.**

> ★★ **그 화면의 값을 옮기세요. 아래 예시를 믿지 마세요.**
>    Vercel 은 apex 용 IP 를 바꾼 적이 있습니다. 여기 적어 둔 숫자가
>    낡았을 수 있고, 틀린 IP 를 넣으면 남의 서버로 갑니다.

대개 이렇게 나옵니다:

| 호스트 | 타입 | 값 |
|---|---|---|
| `@` | A | `76.76.21.21` (프로젝트에 따라 `216.198.79.1`) |
| `www` | CNAME | `cname.vercel-dns.com` |

### 7-2. 가비아에 DNS 넣기

My가비아 → **서비스관리 → 도메인** → `denflow.kr` →
**DNS 정보 → DNS 관리툴** → 해당 도메인 **설정** → 레코드 추가

| 타입 | 호스트 | 값/위치 | TTL |
|---|---|---|---|
| A | `@` | (Vercel 이 준 IP) | 3600 |
| CNAME | `www` | `cname.vercel-dns.com.` | 3600 |

- ★ 가비아는 CNAME 값 **끝에 점(`.`)** 을 붙여야 합니다. 빠뜨리면
  `cname.vercel-dns.com.denflow.kr` 을 찾으러 갑니다
- ★ **네임서버는 가비아 것 그대로 둡니다.** Vercel 로 넘기면 나중에
  메일 발송(Resend 등)의 SPF·DKIM 까지 전부 Vercel 에서 관리하게 됩니다
- 보통 10분~1시간, 길면 하루. Vercel 의 도메인 표시가 **Valid** 로
  바뀌면 끝입니다. **https 인증서는 자동**입니다

### 7-3. ★ Supabase 인증 주소 — 빠뜨리면 비밀번호 찾기가 죽습니다

Authentication → **URL Configuration**

| 칸 | 값 |
|---|---|
| Site URL | `https://denflow.kr` |
| Redirect URLs | `https://denflow.kr/**` 추가 |

- `http://localhost:3000/**` 는 개발용이라 그대로 둡니다
- **기존 `...vercel.app` 줄은 당분간 남겨 두세요.** 도메인이 퍼지는
  동안 두 주소가 다 살아 있어야 합니다. 몇 주 뒤에 지우면 됩니다

> 비밀번호 찾기는 **메일 안의 링크**로 들어옵니다 (메일 템플릿에 토큰을
> 못 넣어서 링크 쪽으로 열어 뒀습니다). 그래서 이 목록이 곧 생명줄입니다.
> 화면은 멀쩡한데 링크만 죽는 종류의 고장이라 원인 찾기가 아주 어렵습니다.

### 7-4. 붙인 뒤 확인

- [ ] `https://denflow.kr` 이 열리고 자물쇠가 보인다
- [ ] `https://www.denflow.kr` 이 `denflow.kr` 로 넘어간다
- [ ] 로그인이 된다 (도메인이 바뀌었으니 **기존 로그인은 풀립니다** — 정상입니다)
- [ ] 스캔 파일 업로드·다운로드가 된다
- [ ] **비밀번호 찾기 메일의 링크**를 눌러 새 비밀번호 칸이 뜬다 ← 제일 중요

### 코드는 안 고쳐도 됩니다

주소를 박아 둔 곳이 저장소에 없습니다 (확인함). 비밀번호 찾기의 돌아올
주소도 `window.location.origin` 이라 **열린 주소를 그대로 따라갑니다.**
그래서 도메인을 붙여도 재배포가 필요 없습니다.

---

## 데이터베이스를 고칠 때

스키마는 마이그레이션 파일로만 바꿉니다.

```bash
npx supabase db push --linked
```

`.env.local` 이 깨지면 로그인이 통째로 막히는데 화면에는 "비밀번호가
올바르지 않습니다" 만 뜹니다. 의심되면:

```bash
npm run check-env
```

> ★ `.env.local` 에 **PowerShell 로 `>>` 하지 마세요.** 줄바꿈 없이 앞
> 줄에 붙고 UTF-16 이라 NUL 이 낍니다. 실제로 그래서 한 번 막혔습니다.
