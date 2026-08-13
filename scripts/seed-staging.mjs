// =========================================================
// 놓을 위치: scripts/seed-staging.mjs
// 쓰는 법:  node scripts/seed-staging.mjs
//
// 시험(staging) 프로젝트에 **처음 한 번** 심는 것들.
//   ① order-files 버킷 (마이그레이션에 없습니다 — 대시보드나 API 로 만듭니다)
//   ② 시험 계정 셋 (clinic / design / lab @test.kr)
//   ③ supabase/seed.sql 이 조직·거래관계·제품을 넣습니다 (이 스크립트 밖)
//
// ★ **운영에서는 절대 안 돕니다.**
//   .env.staging.local 만 읽고, 그 안의 ref 가 운영이면 멈춥니다.
//   시험용 계정을 운영에 만드는 것이 이 스크립트로 낼 수 있는 가장 큰
//   사고라, 그 길을 아예 막아 둡니다.
//
// ★ 여러 번 돌려도 같은 결과입니다. 이미 있으면 건너뜁니다.
// =========================================================

import { readFileSync } from 'node:fs';

const PRODUCTION_REF = 'dzliwedyqkondvcwnvbh';

const env = Object.fromEntries(
  readFileSync('.env.staging.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !KEY) {
  console.error('.env.staging.local 에 URL 이나 service_role 열쇠가 없습니다');
  process.exit(1);
}

if (URL_.includes(PRODUCTION_REF)) {
  console.error('★ 운영 프로젝트입니다. 이 스크립트는 시험 서버에만 돕니다.');
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
console.log('대상:', URL_, '\n');

// ---------- ① 저장소 버킷 ----------
//
// ★ 비공개입니다. 파일은 서명된 주소로만 나갑니다 —
//   공개로 두면 주소를 아는 누구나 환자 스캔을 내려받습니다.
{
  const r = await fetch(`${URL_}/storage/v1/bucket`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ id: 'order-files', name: 'order-files', public: false }),
  });

  const body = await r.text();
  console.log(
    '① 버킷 order-files :',
    r.status === 200 ? '만들었습니다' : body.includes('already exists') ? '이미 있습니다' : `실패 ${r.status} ${body.slice(0, 90)}`,
  );
}

// ---------- ② 시험 계정 ----------
//
// ★ 메일 확인을 건너뜁니다(email_confirm: true).
//   시험 서버에는 발송 서비스가 없어서, 안 그러면 아무도 못 들어옵니다.
const ACCOUNTS = [
  ['clinic@test.kr', '테스트치과 관리자'],
  ['design@test.kr', 'DS 덴탈랩 관리자'],
  ['lab@test.kr', 'DS 기공소 관리자'],
];

const PASSWORD = 'test1234';

for (const [email, name] of ACCOUNTS) {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    }),
  });

  const body = await r.text();
  console.log(
    `② ${email.padEnd(16)}:`,
    r.status === 200 ? '만들었습니다' : body.includes('already been registered') ? '이미 있습니다' : `실패 ${r.status} ${body.slice(0, 90)}`,
  );
}

console.log('\n비밀번호는 셋 다', PASSWORD);
console.log('\n다음: supabase/seed.sql 을 대시보드 SQL Editor 에 붙여 넣으면 조직·제품이 들어갑니다.');
