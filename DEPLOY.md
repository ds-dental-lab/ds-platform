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

## 7. 도메인을 붙일 때

1. Vercel → Settings → **Domains** 에 도메인 추가
2. 도메인 등록처에서 DNS 를 Vercel 이 알려 주는 값으로
3. **Supabase 의 Site URL · Redirect URLs 도 새 주소로 바꾸기** (4번 참고)

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
