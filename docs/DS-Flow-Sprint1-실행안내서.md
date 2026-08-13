# Den Flow — Sprint 1 실행 안내서

**주제** 인증과 데이터 모델
**기간** 5영업일 (하루 3~4시간 기준)
**선행** Sprint 0 완료 (GitHub · Vercel · Next.js · Supabase 연결)
**기준 문서** Den Flow 시스템설계서 v0.7 §4, 구현계획서 v1.6 Sprint 1

**끝나면 얻는 것** 치과 · 디자인센터 · 기공소 계정으로 각각 로그인해 자기 화면에 들어가고, 다른 섹터 화면은 막히는 상태

---

## 시작 전 확인

### 지금 DB 상태부터 정리합니다

연결 테스트로 만드신 `test`, `users`, `cases` 같은 임시 테이블이 있다면 **먼저 지웁니다.** 실제 구조와 이름이 겹치면 나중에 헷갈립니다.

Supabase → **SQL Editor** → New query 에서:

```sql
-- 연결 테스트용 임시 테이블 정리
drop table if exists cases cascade;
drop table if exists test cascade;
-- users 는 auth.users 와 헷갈리므로 직접 만든 것만 지웁니다
drop table if exists public.users cascade;
```

> `auth.users` 는 Supabase가 관리하는 인증 테이블입니다. **절대 건드리지 마세요.** 우리는 `public` 스키마에만 테이블을 만듭니다.

### 오늘의 원칙

**이름보다 구조가 중요합니다.** 이번 주에 만드는 테이블은 앞으로 6개월간 바꾸기 어렵습니다. 화면은 하루면 고치지만 테이블은 재작업입니다. 설계서 §4를 그대로 따라가세요.

---

## Day 1 — 마이그레이션 체계와 조직 테이블

### 1-1. 마이그레이션이란

지금까지는 Supabase 화면에서 직접 테이블을 만드셨을 겁니다. 그러면 **연습용과 실제용 프로젝트에 같은 작업을 두 번** 해야 하고, 무엇을 언제 바꿨는지 기록이 남지 않습니다.

마이그레이션은 "테이블을 이렇게 바꿔라"를 파일로 적어두고 명령 한 줄로 적용하는 방식입니다.

### 1-2. Supabase CLI 설치

터미널에서:

```bash
npm install -D supabase
npx supabase --version
```

**이렇게 나오면 성공** — 버전 번호가 출력됩니다.

### 1-3. 프로젝트 연결

Supabase 대시보드 → 프로젝트 → **Settings** → **General** 에서 `Reference ID`를 복사합니다.

```bash
npx supabase login
npx supabase link --project-ref 복사한_ID
```

`login`을 실행하면 브라우저가 열리며 승인을 요청합니다. 승인하세요.

> **staging 프로젝트를 먼저 연결하세요.** 운영(prod)은 Day 5에 연결합니다.

### 1-4. 첫 마이그레이션 파일 만들기

```bash
npx supabase migration new create_organizations
```

`supabase/migrations/` 폴더에 파일이 하나 생깁니다. VS Code에서 열어 아래를 붙여넣으세요.

```sql
-- 조직 : 치과 · 디자인센터 · 기공소를 한 테이블에서 구분합니다
create type org_type as enum ('clinic', 'design_center', 'lab');
create type org_status as enum ('pending', 'active', 'suspended');

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  org_type    org_type   not null,
  name        text       not null,
  code        text       unique,
  biz_no      text,
  tel         text,
  zip_code    text,
  address     text,
  status      org_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index organizations_type_status_idx on organizations (org_type, status);
create unique index organizations_bizno_idx on organizations (biz_no)
  where deleted_at is null and biz_no is not null;

-- 조직 간 거래 관계 (1:1 전속)
create type partner_relation as enum ('clinic_design', 'design_lab');
create type partner_status   as enum ('pending', 'active', 'terminated');

create table partnerships (
  id          uuid primary key default gen_random_uuid(),
  from_org_id uuid not null references organizations(id) on delete cascade,
  to_org_id   uuid not null references organizations(id) on delete cascade,
  relation    partner_relation not null,
  status      partner_status   not null default 'pending',
  is_default  boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 1:1 전속 강제 : 한 조직은 활성 거래처를 하나만 가집니다
create unique index partnerships_one_active_idx
  on partnerships (from_org_id, relation) where status = 'active';
create index partnerships_to_idx on partnerships (to_org_id, relation, status);
```

### 1-5. 적용하기

```bash
npx supabase db push
```

Supabase 대시보드 → **Table Editor** 에서 `organizations` 와 `partnerships` 가 보이면 성공입니다.

**Day 1 완료 기준**
- [ ] 임시 테이블 정리
- [ ] Supabase CLI 연결
- [ ] 마이그레이션 파일로 조직 테이블 생성
- [ ] Table Editor 에서 확인

---

## Day 2 — 사용자와 권한

### 2-1. 사용자 프로필

```bash
npx supabase migration new create_users
```

```sql
-- Supabase 인증(auth.users)을 확장하는 프로필
create table user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  phone_cc    text default '+82',
  phone       text,
  email       text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- 소속과 권한
create type member_role as enum ('owner','admin','staff','designer','technician');

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references user_profiles(id) on delete cascade,
  role       member_role not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- 사용자는 하나의 조직에만 속합니다
create unique index memberships_one_org_idx on memberships (user_id) where is_active;
create index memberships_org_idx on memberships (org_id, role);
```

### 2-2. 가입하면 프로필이 자동으로 생기게

Supabase Auth 로 가입하면 `auth.users` 에만 들어갑니다. 우리 `user_profiles` 에도 자동으로 넣어줍니다.

```bash
npx supabase migration new profile_trigger
```

```sql
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into user_profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### 2-3. RLS 켜기 ★

**이 단계를 건너뛰면 누구나 남의 데이터를 볼 수 있습니다.**

```bash
npx supabase migration new enable_rls
```

```sql
alter table organizations  enable row level security;
alter table partnerships   enable row level security;
alter table user_profiles  enable row level security;
alter table memberships    enable row level security;

-- 내 조직 id 를 꺼내는 함수
create or replace function my_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid() and is_active limit 1;
$$;

-- 내 권한
create or replace function my_role()
returns member_role language sql stable security definer set search_path = public as $$
  select role from memberships where user_id = auth.uid() and is_active limit 1;
$$;

-- 자기 조직만 조회
create policy org_select on organizations
  for select using (id = my_org_id());

-- 자기 프로필
create policy profile_select on user_profiles
  for select using (id = auth.uid());
create policy profile_update on user_profiles
  for update using (id = auth.uid());

-- 같은 조직 구성원만
create policy membership_select on memberships
  for select using (org_id = my_org_id());

-- 거래 관계
create policy partnership_select on partnerships
  for select using (from_org_id = my_org_id() or to_org_id = my_org_id());
```

```bash
npx supabase db push
```

**Day 2 완료 기준**
- [ ] `user_profiles`, `memberships` 생성
- [ ] 가입 트리거 동작
- [ ] 네 테이블 모두 RLS 켜짐 (Table Editor 에서 자물쇠 표시 확인)

---

## Day 3 — 로그인 붙이기

### 3-1. Supabase 클라이언트 3종

`lib/supabase/` 폴더에 파일 세 개를 만듭니다.

**`lib/supabase/client.ts`** — 브라우저용

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

**`lib/supabase/server.ts`** — 서버용

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없어 무시합니다
          }
        },
      },
    },
  );
}
```

**`lib/supabase/admin.ts`** — 배치·관리자용

```ts
import { createClient } from '@supabase/supabase-js';

// service_role 키는 모든 데이터를 열 수 있습니다.
// server/ 안에서만 import 하세요. 브라우저로 새면 전체 데이터가 열립니다.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
```

### 3-2. 세션 유지 미들웨어

프로젝트 최상단 `middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 로그인하지 않았으면 로그인 화면으로
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)'],
};
```

### 3-3. 로그인 화면

`app/(auth)/login/page.tsx` 를 만들고, **프로토타입 `dental-auth.html` 의 로그인 화면을 그대로 옮기세요.** 디자인은 이미 정해져 있으니 구조만 React로 바꾸면 됩니다.

핵심 동작은 이것뿐입니다.

```ts
const supabase = createClient();
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) { /* 안내 표시 */ } else { router.push('/home'); }
```

### 3-4. 테스트 계정 만들기

Supabase → **Authentication** → **Users** → Add user 로 세 개를 만듭니다.

| 이메일 | 용도 |
|---|---|
| clinic@test.kr | 치과 |
| design@test.kr | 디자인센터 |
| lab@test.kr | 기공소 |

그다음 SQL Editor 에서 조직과 소속을 넣습니다.

```sql
insert into organizations (org_type, name, status) values
  ('clinic',        '최성호치과',      'active'),
  ('design_center', '넥스 디자인센터', 'active'),
  ('lab',           '케이덴탈랩',      'active');

-- 이메일로 사용자를 찾아 조직에 붙입니다
insert into memberships (org_id, user_id, role)
select o.id, u.id, 'owner'
from organizations o
join user_profiles u on
  (o.org_type = 'clinic'        and u.email = 'clinic@test.kr') or
  (o.org_type = 'design_center' and u.email = 'design@test.kr') or
  (o.org_type = 'lab'           and u.email = 'lab@test.kr');
```

**Day 3 완료 기준**
- [ ] 세 계정으로 로그인 성공
- [ ] 로그아웃 후 주소를 직접 입력하면 로그인 화면으로 되돌아감
- [ ] 새로고침해도 로그인이 유지됨

---

## Day 4 — 권한에 따른 화면 분기

### 4-1. 내 정보 가져오기

`server/policies/session.ts`:

```ts
import { createClient } from '@/lib/supabase/server';

export async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('memberships')
    .select('role, organizations(id, name, org_type)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!data) return null;
  return {
    userId: user.id,
    email: user.email,
    role: data.role,
    org: data.organizations,
  };
}
```

### 4-2. 섹터별 레이아웃 가드

`app/(clinic)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/server/policies/session';

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/login');
  // 다른 섹터가 들어오면 404 로 처리합니다 (존재 여부를 알리지 않기 위해)
  if (me.org.org_type !== 'clinic') redirect('/404');

  return (
    <div data-sector="clinic">
      {/* 사이드바 · 상단바 */}
      {children}
    </div>
  );
}
```

`(design)`, `(lab)` 레이아웃도 같은 방식으로 `org_type` 만 바꿔 만듭니다.

### 4-3. 로그인 후 자기 섹터로 보내기

`app/page.tsx` (루트):

```tsx
import { redirect } from 'next/navigation';
import { getMe } from '@/server/policies/session';

export default async function Root() {
  const me = await getMe();
  if (!me) redirect('/login');

  const home = {
    clinic: '/home',
    design_center: '/design/home',
    lab: '/lab/home',
  }[me.org.org_type];

  redirect(home);
}
```

**Day 4 완료 기준**
- [ ] 치과 계정으로 로그인하면 치과 화면으로 이동
- [ ] 치과 계정으로 `/design/home` 을 열면 404
- [ ] 상단에 조직명과 사용자 이름이 표시됨
- [ ] `data-sector` 에 따라 색이 바뀜

---

## Day 5 — 환자 테이블과 마무리

### 5-1. 환자 정보 분리 보관

```bash
npx supabase migration new create_patients
```

```sql
-- 환자 정보는 주문에서 분리해 접근 권한을 따로 통제합니다
create table patients (
  id             uuid primary key default gen_random_uuid(),
  clinic_org_id  uuid not null references organizations(id) on delete cascade,
  chart_no       text,
  name           text,          -- 실명 (치과 · 디자인센터만 열람)
  name_masked    text,          -- 김*수 (기공소 노출용)
  birth_date     date,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index patients_chart_idx
  on patients (clinic_org_id, chart_no) where deleted_at is null;

alter table patients enable row level security;

-- 자기 치과의 환자만
create policy patient_select on patients
  for select using (clinic_org_id = my_org_id());
create policy patient_insert on patients
  for insert with check (clinic_org_id = my_org_id());
```

> 디자인센터와 기공소의 열람 범위는 주문 테이블이 생기는 **Sprint 3**에서 정합니다. 지금은 치과만 접근합니다.

### 5-2. 마스킹 자동 생성

```sql
create or replace function mask_patient_name()
returns trigger language plpgsql as $$
begin
  if new.name is not null and length(new.name) >= 2 then
    new.name_masked := left(new.name, 1) || repeat('*', length(new.name) - 2)
                       || right(new.name, 1);
  else
    new.name_masked := new.name;
  end if;
  return new;
end;
$$;

create trigger patients_mask
  before insert or update of name on patients
  for each row execute function mask_patient_name();
```

### 5-3. 타입 생성

DB 구조를 TypeScript 타입으로 뽑습니다.

```bash
npx supabase gen types typescript --linked > types/database.ts
```

> 이 파일은 **직접 고치지 마세요.** 마이그레이션을 할 때마다 다시 뽑습니다.

### 5-4. 운영 프로젝트에도 적용

지금까지는 staging 에만 적용했습니다. 운영에도 같은 구조를 넣습니다.

```bash
npx supabase link --project-ref 운영_프로젝트_ID
npx supabase db push
npx supabase link --project-ref staging_프로젝트_ID   # 다시 staging 으로
```

### 5-5. 커밋

```bash
git add .
git commit -m "feat(auth): 조직 · 사용자 · 환자 테이블과 로그인 구성"
git push
```

**Day 5 완료 기준**
- [ ] `patients` 테이블 생성, 마스킹 자동 동작
- [ ] `types/database.ts` 생성
- [ ] 운영 프로젝트에도 같은 테이블 존재
- [ ] Vercel 배포본에서 로그인 동작

---

## Sprint 1 최종 점검

- [ ] 세 계정으로 각각 로그인해 서로 다른 화면을 본다
- [ ] 다른 섹터 주소로 접근하면 404
- [ ] 한 사용자를 두 조직에 넣으려 하면 DB가 거부한다
- [ ] 한 치과에 두 번째 디자인센터를 붙이려 하면 거부한다
- [ ] 환자 이름을 넣으면 마스킹 값이 자동으로 생긴다
- [ ] 로그아웃 상태로 아무 주소나 열면 로그인 화면으로 간다

---

## 자주 막히는 곳

| 증상 | 해결 |
|---|---|
| `db push` 시 권한 오류 | `npx supabase login` 을 다시 실행하세요 |
| 로그인은 되는데 바로 튕김 | `middleware.ts` 의 matcher 에서 `/login` 이 제외됐는지 확인 |
| RLS 켠 뒤 데이터가 안 보임 | 정상입니다. 정책을 만들지 않으면 아무것도 안 보입니다 |
| `my_org_id()` 가 null | 해당 사용자의 `memberships` 행이 있는지, `is_active` 가 true 인지 확인 |
| 타입 생성 실패 | `--linked` 대신 `--project-id 프로젝트ID` 를 써보세요 |
| 트리거가 동작 안 함 | Supabase 대시보드 → Database → Triggers 에서 존재 확인 |

**RLS 때문에 막히면 잠깐 꺼서 확인하고 반드시 다시 켜세요.**

```sql
alter table 테이블명 disable row level security;  -- 확인용
alter table 테이블명 enable  row level security;  -- 반드시 되돌리기
```

---

## 다음 단계

Sprint 2는 **도메인 코어**입니다. 치식·보철 규칙을 순수 함수로 만들고 치식도 컴포넌트를 옮깁니다. 화면이 실제로 보이기 시작하는 단계입니다.

이번 주에 만든 테이블 위에 Sprint 3에서 `orders` 와 `order_items` 가 올라갑니다. 그때 프로토타입의 주문등록 화면을 옮겨 담게 됩니다.
