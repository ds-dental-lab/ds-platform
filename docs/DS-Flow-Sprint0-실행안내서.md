# Den Flow — Sprint 0 실행 안내서

**대상** 개발 경험이 없는 상태에서 직접 진행하시는 분
**기간** 5영업일 (하루 3~4시간 기준)
**기준 문서** Den Flow Architecture v1.0, Sprint 0 Foundation v1.1
**끝나면 얻는 것** 인터넷 주소로 접속되는 빈 화면 3개(치과·디자인센터·기공소)와, 앞으로 기능을 얹을 수 있는 뼈대

---

## 시작하기 전에

### 이 문서를 읽는 법

명령어는 **한 줄씩 복사해서 붙여넣기**하시면 됩니다. 각 단계마다 **"이렇게 나오면 성공"**을 적어뒀으니 그것과 다르면 멈추고 §7 문제 해결을 보세요.

모르는 단어가 나와도 괜찮습니다. 지금은 **정확히 따라 하는 것**이 이해보다 중요합니다.

### 용어 최소한만

| 용어 | 쉽게 말하면 |
|---|---|
| 터미널 | 컴퓨터에 글자로 명령하는 창 |
| Node.js | 우리 프로그램을 돌리는 엔진 |
| npm | 부품을 자동으로 받아오는 도구 |
| Git / GitHub | 코드 저장소. 실수해도 되돌릴 수 있게 해줌 |
| Supabase | 데이터베이스 + 로그인 + 파일 보관을 대신해주는 서비스 |
| Vercel | 만든 걸 인터넷에 올려주는 서비스 |
| 배포 | 인터넷 주소로 접속되게 만드는 일 |

### AI 도구를 곁에 두세요

막히면 에러 메시지 전체를 복사해서 AI에게 그대로 물어보세요. 이 안내서로 뼈대를 만든 뒤에는 **Claude Code** 같은 코딩 도구를 쓰면 훨씬 빠릅니다. 다만 Sprint 0만큼은 직접 손으로 해보시길 권합니다. 뼈대를 이해해야 이후에 AI가 만든 것을 검토할 수 있습니다.

---

## Day 1 — 계정과 도구 준비

### 1-1. 계정 3개 만들기

| 서비스 | 주소 | 요금 | 비고 |
|---|---|---|---|
| GitHub | github.com | 무료 | 코드 저장소 |
| Supabase | supabase.com | 무료로 시작 | DB·로그인·파일 |
| Vercel | vercel.com | 무료로 시작 | 배포 |

**GitHub은 조직(Organization) 계정으로 만드세요.** 개인 계정으로 시작하면 나중에 사람을 들이거나 회사로 넘길 때 주소가 바뀌고 배포 설정을 다시 잡아야 합니다. 무료이고 5분 걸립니다.

1. github.com 가입 (개인 계정)
2. 우측 상단 프로필 → **Your organizations** → **New organization** → Free
3. 조직 이름은 `dsflow` 처럼 짧고 영문으로

Supabase와 Vercel은 **GitHub 계정으로 로그인**을 선택하세요. 나중에 연결이 쉬워집니다.

### 1-2. 개발 도구 설치

**① Node.js 22 LTS** — nodejs.org 에서 **LTS** 버튼을 눌러 받고 설치합니다. 설치 중 옵션은 모두 기본값으로 두세요.

**② Visual Studio Code** — code.visualstudio.com 에서 받아 설치합니다. 코드를 쓰는 프로그램입니다.

**③ Git** — git-scm.com 에서 받아 설치합니다. Mac은 이미 있을 수 있습니다.

### 1-3. 설치 확인

VS Code를 열고 상단 메뉴 **Terminal → New Terminal**을 누르면 아래쪽에 검은 창이 뜹니다. 여기에 한 줄씩 입력하세요.

```bash
node -v
npm -v
git --version
```

**이렇게 나오면 성공**
```
v22.x.x
10.x.x
git version 2.x.x
```

`command not found`가 나오면 설치가 안 된 것입니다. 프로그램을 다시 설치하고 **VS Code를 완전히 껐다 켜세요.**

### 1-4. Git에 이름 알려주기

누가 코드를 바꿨는지 기록하기 위해 한 번만 설정합니다.

```bash
git config --global user.name "본인이름"
git config --global user.email "GitHub에 가입한 이메일"
```

**Day 1 완료 기준**
- [ ] GitHub 조직 계정 생성
- [ ] Supabase · Vercel 가입
- [ ] `node -v` `npm -v` `git --version` 모두 정상 출력

---

## Day 2 — 프로젝트 만들고 인터넷에 올리기

오늘 끝나면 **인터넷 주소로 접속되는 화면**이 생깁니다. 가장 뿌듯한 날입니다.

### 2-1. 작업 폴더 만들기

바탕화면에 `dev` 폴더를 만들고, 터미널에서 그 안으로 들어갑니다.

```bash
cd ~/Desktop/dev
```

Windows에서 안 되면 `cd C:\Users\사용자명\Desktop\dev` 를 쓰세요.

### 2-2. Next.js 프로젝트 생성

```bash
npx create-next-app@latest ds-flow
```

질문이 여러 개 나옵니다. **아래처럼 답하세요.**

| 질문 | 답 |
|---|---|
| TypeScript? | **Yes** |
| ESLint? | **Yes** |
| Tailwind CSS? | **Yes** |
| `src/` directory? | **No** |
| App Router? | **Yes** |
| Turbopack? | **Yes** |
| import alias 변경? | **No** |

**이렇게 나오면 성공** — `Success! Created ds-flow at ...`

### 2-3. 첫 실행

```bash
cd ds-flow
npm run dev
```

터미널에 `http://localhost:3000` 이 뜹니다. 브라우저 주소창에 그대로 입력하면 Next.js 기본 화면이 보입니다.

> **알아두기** — `localhost`는 내 컴퓨터에서만 보이는 주소입니다. 아직 인터넷에 올라간 게 아닙니다.
> 개발 중에는 이 창을 계속 켜둡니다. 멈추려면 터미널에서 **Ctrl + C**.

### 2-4. GitHub에 올리기

새 터미널을 하나 더 여세요 (Terminal → New Terminal). 기존 창은 계속 돌아가야 합니다.

먼저 GitHub 웹사이트에서 저장소를 만듭니다.

1. 조직 페이지 → **New repository**
2. 이름 `ds-flow`, **Private** 선택
3. 나머지는 체크하지 말고 **Create repository**

터미널에서 (아래 주소는 방금 만든 저장소 주소로 바꾸세요):

```bash
git init
git add .
git commit -m "chore: 프로젝트 초기 생성"
git branch -M main
git remote add origin https://github.com/조직명/ds-flow.git
git push -u origin main
```

로그인 창이 뜨면 GitHub 계정으로 승인하세요.

**이렇게 나오면 성공** — GitHub 저장소 페이지를 새로고침하면 파일들이 보입니다.

### 2-5. 개발용 브랜치 만들기

`main`은 실제 서비스용이라 직접 건드리지 않습니다. 작업은 `develop`에서 합니다.

```bash
git checkout -b develop
git push -u origin develop
```

### 2-6. main 브랜치 보호하기

실수로 운영 코드를 망가뜨리지 않게 잠급니다.

GitHub 저장소 → **Settings** → **Branches** → **Add branch protection rule**
- Branch name pattern: `main`
- **Require a pull request before merging** 체크
- Save

### 2-7. Vercel로 배포

1. vercel.com 로그인 → **Add New** → **Project**
2. GitHub 조직 연결을 허용하고 `ds-flow` 선택
3. 설정은 모두 기본값으로 두고 **Deploy**
4. 1~2분 뒤 `https://ds-flow-xxx.vercel.app` 주소가 나옵니다

**이 주소를 휴대폰에서도 열어보세요.** 인터넷에 올라간 겁니다.

> 앞으로 `develop`에 올린 변경은 **미리보기 주소**로, `main`에 합친 것만 **운영 주소**로 나갑니다.

**Day 2 완료 기준**
- [ ] `npm run dev` 로 로컬 화면 확인
- [ ] GitHub에 코드 올라감 (main, develop 두 브랜치)
- [ ] main 브랜치 보호 설정
- [ ] Vercel 주소로 접속 성공

---

## Day 3 — Supabase 연결

### 3-1. 프로젝트 2개 만들기

**연습용과 실제용을 반드시 나눕니다.** 개발하다 실수로 진짜 데이터를 지우는 사고를 구조적으로 막습니다.

Supabase → **New project** 를 두 번 하세요.

| 이름 | Region | 용도 |
|---|---|---|
| `dsflow-staging` | **Northeast Asia (Seoul)** | 연습·테스트 |
| `dsflow-prod` | **Northeast Asia (Seoul)** | 실제 운영 |

- Database Password는 **길고 복잡하게** 만들고 반드시 따로 적어두세요. 잃어버리면 재설정이 번거롭습니다.
- 서울 리전은 필수입니다. 환자 정보를 다루므로 데이터가 국내에 있어야 나중에 문제가 없습니다.

### 3-2. 연결 정보 확인

`dsflow-staging` 프로젝트 → 좌측 **Settings** → **API** 에서 세 가지를 확인합니다.

| 항목 | 성격 |
|---|---|
| Project URL | 공개해도 됨 |
| `anon` `public` key | 공개해도 됨 |
| `service_role` key | **절대 공개 금지** |

> **service_role 키는 모든 데이터를 열 수 있는 마스터 키입니다.** 채팅·이메일·화면 캡처 어디에도 올리지 마세요.

### 3-3. 부품 설치

터미널에서 (개발 서버가 아닌 두 번째 창):

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install zod
```

### 3-4. 환경변수 파일 만들기

VS Code에서 `ds-flow` 폴더 최상단에 파일 두 개를 만듭니다.

**`.env.example`** — 값 없이 이름만. 저장소에 올라갑니다.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENV=local
STORAGE_BUCKET_ORDER_FILES=order-files
UPLOAD_MAX_SIZE_MB=100
SIGNED_URL_TTL_SECONDS=300
FILE_RETENTION_MONTHS=36
```

**`.env.local`** — 실제 값. **절대 저장소에 올리지 않습니다.**
`.env.example` 내용을 복사한 뒤 staging 프로젝트의 값을 채우세요.

`.gitignore` 파일을 열어 `.env*.local` 이 들어 있는지 확인하세요. Next.js가 기본으로 넣어줍니다.

> **왜 나누나요?** `.env.example`은 "이런 값이 필요하다"는 목록이고, `.env.local`은 실제 비밀번호입니다. 나중에 다른 사람이 합류하면 example만 보고 자기 값을 채우면 됩니다.

### 3-5. 파일 보관함 만들기

Supabase → **Storage** → **New bucket**

| 이름 | Public |
|---|---|
| `order-files` | **끄기(비공개)** |

staging과 prod 양쪽 모두에 만드세요. 스캔·디자인 파일이 여기 들어갑니다.

**Day 3 완료 기준**
- [ ] Supabase 프로젝트 2개 (서울 리전)
- [ ] `.env.example` 과 `.env.local` 생성
- [ ] `.env.local` 이 GitHub에 올라가지 않음 (`git status` 에서 안 보여야 함)
- [ ] `order-files` 버킷 생성

---

## Day 4 — 폴더 구조와 화면 뼈대

### 4-1. 폴더 만들기

VS Code 좌측 탐색기에서 마우스 우클릭 → New Folder 로 아래 구조를 만드세요. 지금은 **빈 폴더만** 만들면 됩니다.

```
app/
  (auth)/
  (clinic)/
  (design)/
  (lab)/
  (admin)/
  api/v1/
server/
  domain/
  services/
  repositories/
  policies/
lib/
  supabase/
  validation/
components/
  ui/
  common/
  dental/
types/
docs/
```

> **괄호가 붙은 폴더**는 주소에 나타나지 않는 그룹입니다. `(clinic)/home` 은 `/home` 으로 접속됩니다. 섹터별로 화면을 나누되 주소는 깔끔하게 유지하는 방법입니다.

`docs/` 폴더에는 지금까지 만든 문서 3개(기능명세서·시스템설계서·구현계획서)를 넣어두세요.

### 4-2. shadcn/ui 설치

화면 부품(버튼·입력창·표 등)을 가져오는 도구입니다.

```bash
npx shadcn@latest init
```

질문에는 기본값으로 답하시면 됩니다. 이어서 자주 쓰는 부품을 받습니다.

```bash
npx shadcn@latest add button input select checkbox switch label dialog table tabs badge card
```

**이렇게 나오면 성공** — `components/ui/` 폴더에 파일들이 생깁니다.

### 4-3. 섹터별 색 정하기

`app/globals.css` 파일을 열어 맨 아래에 아래 내용을 붙여넣으세요. 섹터마다 대표색만 바꾸는 구조입니다.

```css
:root {
  --brand: #1279E8;        /* 기본(치과) */
  --brand-soft: #EDF3FE;
}
[data-sector="design"] {
  --brand: #5546C8;        /* 디자인센터 */
  --brand-soft: #EFEDFB;
}
[data-sector="lab"] {
  --brand: #A9711C;        /* 기공소 */
  --brand-soft: #FBF1DF;
}
```

> 이렇게 해두면 같은 버튼이 섹터마다 다른 색으로 나옵니다. 부품은 섹터를 몰라도 됩니다.

### 4-4. 빈 화면 만들기

각 그룹 폴더 안에 `home/page.tsx` 파일을 만들고, 안에는 섹터 이름만 보이게 아주 간단히 두세요. 지금은 **주소가 열리는지 확인하는 것**이 목적입니다.

만들 파일:
- `app/(clinic)/home/page.tsx`
- `app/(design)/home/page.tsx` → 주소 충돌을 피하려면 `app/(design)/design/home/page.tsx`
- `app/(lab)/lab/home/page.tsx`

> **주의** — 괄호 폴더는 주소에 안 나오므로, 세 곳 모두 `home` 이면 주소가 겹쳐 오류가 납니다. 치과만 `/home`, 나머지는 `/design/home`, `/lab/home` 처럼 구분하세요.

`npm run dev` 를 켜고 아래 주소를 차례로 열어보세요.

```
http://localhost:3000/home
http://localhost:3000/design/home
http://localhost:3000/lab/home
```

**Day 4 완료 기준**
- [ ] 폴더 구조 생성
- [ ] shadcn/ui 부품 설치
- [ ] 섹터 색 정의
- [ ] 세 주소가 각각 다른 화면으로 열림

---

## Day 5 — 규칙 잠그고 마무리

오늘 하는 일은 눈에 보이지 않지만 **가장 중요합니다.** 나중에 실수를 자동으로 막아주는 장치를 답니다.

### 5-1. 코드 정리 도구

```bash
npm install -D prettier prettier-plugin-tailwindcss
```

프로젝트 최상단에 `.prettierrc` 파일을 만들고:

```json
{
  "printWidth": 100,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 5-2. 커밋 전 자동 검사

```bash
npm install -D husky lint-staged
npx husky init
```

`package.json` 파일을 열어 맨 아래 `}` 앞에 추가:

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md}": ["prettier --write"]
}
```

`.husky/pre-commit` 파일 내용을 아래로 바꿉니다:

```
npx lint-staged
```

> 이제 코드를 저장소에 올릴 때마다 자동으로 정리·검사가 돌아갑니다.

### 5-3. 경계 규칙 잠그기 ★

**이 항목이 Sprint 0에서 가장 중요합니다.** 두 가지 사고를 막습니다.

1. **비밀 키가 브라우저로 새는 것** — 모든 데이터가 열립니다
2. **업무 규칙이 데이터베이스에 묶이는 것** — 치식 규칙을 테스트할 수 없게 됩니다

`eslint.config.mjs` 파일에 아래 규칙을 추가하세요.

```js
{
  files: ['server/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/lib/supabase*', '@/server/repositories*'],
          message: '도메인 규칙은 데이터베이스를 몰라야 합니다. 순수 함수로 유지하세요.' },
      ],
    }],
  },
},
{
  files: ['components/**/*.tsx', 'app/**/*.tsx'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@/lib/supabase/admin*'],
          message: 'service_role 키는 서버에서만 씁니다. 브라우저로 새면 전체 데이터가 열립니다.' },
      ],
    }],
  },
},
```

**반드시 시험해 보세요.** `server/domain/` 안에 아무 파일이나 만들고 첫 줄에 다음을 쓰면:

```ts
import { createClient } from '@/lib/supabase/server';
```

빨간 줄이 그어지고 에러 메시지가 떠야 합니다. **뜨지 않으면 규칙이 적용되지 않은 것이니 멈추고 확인하세요.** 뜬 걸 확인했으면 그 파일은 지웁니다.

### 5-4. 마지막 확인

```bash
npx tsc --noEmit
npm run lint
npm run build
```

세 명령 모두 오류 없이 끝나야 합니다.

### 5-5. 저장소에 올리기

```bash
git add .
git commit -m "chore: Sprint 0 프로젝트 기반 구성"
git push
```

### 5-6. README 남기기

`README.md` 파일에 아래를 적어두세요. 6개월 뒤의 본인을 위한 것입니다.

```markdown
# Den Flow

치과 보철 거래 플랫폼

## 시작하기
1. `.env.example` 을 복사해 `.env.local` 을 만들고 값을 채웁니다
2. `npm install`
3. `npm run dev`

## 구조
- app/(clinic) (design) (lab) : 섹터별 화면
- server/domain : 치식·보철 업무 규칙 (DB를 몰라야 함)
- components/dental : 치식도 등 도메인 부품

## 문서
docs/ 폴더 참조
```

**Day 5 완료 기준**
- [ ] Prettier · husky 동작
- [ ] **경계 규칙이 실제로 위반을 잡아냄 (직접 시험 완료)**
- [ ] `tsc` `lint` `build` 모두 통과
- [ ] README 작성

---

## Sprint 0 최종 점검

아래를 모두 만족하면 Sprint 1로 넘어가셔도 됩니다.

- [ ] Vercel 주소로 세 섹터 화면이 열린다
- [ ] `data-sector` 값을 바꾸면 색이 바뀐다
- [ ] Supabase staging · prod 프로젝트가 서울 리전에 있다
- [ ] `.env.local` 이 저장소에 올라가지 않았다
- [ ] `server/domain` 에서 Supabase를 부르면 에러가 난다
- [ ] `git push` 하면 Vercel이 자동으로 다시 배포한다
- [ ] 컴퓨터를 껐다 켜도 `npm run dev` 로 다시 실행된다

---

## §7 문제 해결

| 증상 | 원인과 해결 |
|---|---|
| `command not found: node` | Node 설치 후 VS Code를 완전히 종료했다 다시 여세요 |
| `npm ERR! code EACCES` | Mac/Linux 권한 문제. 명령 앞에 `sudo` 를 붙이거나 폴더 위치를 바꾸세요 |
| `Port 3000 is already in use` | 이미 실행 중입니다. 기존 터미널에서 Ctrl+C 로 멈추세요 |
| `git push` 시 인증 실패 | GitHub에서 Personal Access Token을 발급해 비밀번호 대신 쓰세요 |
| Vercel 배포 실패 | 로그의 빨간 줄을 복사해 AI에게 물어보세요. 대부분 환경변수 누락입니다 |
| 화면이 하얗게만 나옴 | 브라우저에서 F12 → Console 탭의 빨간 글씨를 확인하세요 |
| Supabase 연결 오류 | `.env.local` 의 URL과 키에 공백이나 따옴표가 섞였는지 보세요 |

**어디서 막히든 이렇게 하세요**
1. 에러 메시지 **전체**를 복사
2. "지금 뭘 하려다가" 를 한 줄 덧붙임
3. AI에게 그대로 물어보기

에러를 무시하고 다음 단계로 넘어가지 마세요. 뒤에서 반드시 더 큰 문제로 돌아옵니다.

---

## 마음가짐

**첫 주는 원래 답답합니다.** 화면에 보이는 결과가 거의 없고 설정만 계속합니다. 그런데 이 5일이 이후 4개월을 좌우합니다. 특히 §5-3 경계 규칙은 건너뛰고 싶어지지만, 그게 나중에 "왜 이 코드를 못 고치지"를 막아줍니다.

**하루에 한 챕터씩** 하세요. 몰아서 하면 어디서 틀렸는지 못 찾습니다.

**막히면 하루 이틀 미뤄도 괜찮습니다.** 다만 며칠 이상 막히면 그 부분만 프리랜서에게 물어보는 것도 방법입니다. 시간당으로 짧게 도움받는 개발자를 구할 수 있습니다.

---

## 다음 단계

Sprint 0이 끝나면 **Sprint 1 (인증과 데이터 모델)** 입니다. 여기서 조직·사용자·환자 테이블을 만들고 로그인을 붙입니다. 구현계획서의 Sprint 1 항목을 그대로 따르시면 되고, 필요하시면 같은 형식의 실행 안내서를 만들어 드리겠습니다.
