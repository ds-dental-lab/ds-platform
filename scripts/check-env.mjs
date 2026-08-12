// =========================================================
// 놓을 위치: scripts/check-env.mjs
//
// .env.local 이 성한지 봅니다.  `npm run check-env`
//
// ★ 이걸 만든 이유.
//   PowerShell 로 `>> .env.local` 을 했더니 (1) 파일 끝에 줄바꿈이
//   없어서 **앞 줄 값 뒤에 그대로 붙고** (2) UTF-16 이라 글자 사이에
//   NUL 이 끼었습니다. 그 바람에 anon 열쇠가 망가져 **로그인이 통째로
//   막혔는데**, 화면에는 "이메일 또는 비밀번호가 올바르지 않습니다"
//   만 떴습니다. 진짜 원인과 보이는 증상이 아주 멀었습니다.
//
// ★ 값은 절대 안 찍습니다.
//   길이와 앞 몇 글자만 봅니다. 점검하려다 열쇠를 로그에 흘리면
//   점검이 사고가 됩니다.
//
// ★ 모양만 보지 않고 **실제로 두드려 봅니다.**
//   글자 수가 맞아도 죽은 열쇠일 수 있습니다.
// =========================================================

import fs from 'node:fs';

const FILE = '.env.local';

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const OPTIONAL = ['SUPABASE_SERVICE_ROLE_KEY'];
const KNOWN = [...REQUIRED, ...OPTIONAL];

const problems = [];
const notes = [];

function say(mark, text) {
  console.log(`${mark} ${text}`);
}

// ---------- 1. 파일 ----------

if (!fs.existsSync(FILE)) {
  say('✗', `${FILE} 이 없습니다.`);
  process.exit(1);
}

const raw = fs.readFileSync(FILE);

// ---------- 2. NUL 바이트 (PowerShell 이 UTF-16 으로 쓴 흔적) ----------

const nulCount = raw.filter((b) => b === 0).length;
if (nulCount > 0) {
  problems.push(
    `NUL 바이트가 ${nulCount}개 있습니다. PowerShell 로 >> 하면 생깁니다.\n` +
      `    고치기:  tr -d '\\000' < .env.local > tmp && mv tmp .env.local`,
  );
}

// ---------- 3. 줄 ----------

const text = raw.toString('utf8').replace(/\0/g, '');
const lines = text.split(/\r?\n/);
const found = new Map();

lines.forEach((line, i) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;

  const eq = trimmed.indexOf('=');
  if (eq < 0) {
    problems.push(`${i + 1}번째 줄에 = 가 없습니다: "${trimmed.slice(0, 20)}…"`);
    return;
  }

  const key = trimmed.slice(0, eq);
  const value = trimmed.slice(eq + 1);

  // ★ 값 안에 다른 열쇠 이름이 보이면 줄이 붙은 것입니다
  const glued = KNOWN.find((k) => value.includes(k));
  if (glued) {
    problems.push(
      `${key} 값 뒤에 ${glued} 가 **붙어 있습니다**. 줄바꿈 없이 이어 쓴 것입니다.\n` +
        `    ${FILE} 을 편집기로 열어 두 줄로 갈라 주세요.`,
    );
  }

  found.set(key, value);
});

// ---------- 4. 끝 줄바꿈 ----------

if (raw.length > 0 && raw[raw.length - 1] !== 0x0a) {
  problems.push(
    '파일 끝에 줄바꿈이 없습니다. 다음에 >> 로 뭘 더하면 앞 줄에 붙습니다.',
  );
}

// ---------- 5. 있어야 할 것 ----------

for (const key of REQUIRED) {
  const v = found.get(key);
  if (!v) problems.push(`${key} 가 없습니다.`);
  else notes.push(`${key} — ${v.length}자 (${v.slice(0, 12)}…)`);
}

const serviceKey = found.get('SUPABASE_SERVICE_ROLE_KEY');
if (!serviceKey) {
  notes.push(
    'SUPABASE_SERVICE_ROLE_KEY — 없음. 관리자가 사용자 계정을 못 만듭니다 (다른 기능은 멀쩡).',
  );
} else {
  notes.push(`SUPABASE_SERVICE_ROLE_KEY — ${serviceKey.length}자 (${serviceKey.slice(0, 12)}…)`);
}

// ---------- 6. 실제로 두드려 봅니다 ----------

const url = found.get('NEXT_PUBLIC_SUPABASE_URL');
const anon = found.get('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (url && anon && problems.length === 0) {
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } });
    if (r.ok) notes.push('anon 열쇠로 Supabase 에 닿았습니다 ✓');
    else problems.push(`anon 열쇠가 거절당했습니다 (${r.status}). 대시보드에서 다시 복사해 주세요.`);
  } catch (e) {
    problems.push(`Supabase 에 못 닿았습니다: ${e.message}`);
  }

  if (serviceKey) {
    try {
      const r = await fetch(`${url}/auth/v1/admin/users?per_page=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (r.ok) notes.push('service_role 열쇠가 살아 있습니다 ✓ — 사용자 계정을 만들 수 있습니다');
      else {
        problems.push(
          `service_role 열쇠가 거절당했습니다 (${r.status}).\n` +
            '    Settings → API 의 **service_role** 값인지 확인해 주세요 (anon 이 아닙니다).',
        );
      }
    } catch (e) {
      problems.push(`service_role 확인 중 오류: ${e.message}`);
    }
  }
}

// ---------- 결과 ----------

console.log(`\n${FILE}\n`);
for (const n of notes) say('·', n);

if (problems.length === 0) {
  console.log('\n성합니다.\n');
  process.exit(0);
}

console.log('');
for (const p of problems) say('✗', p);
console.log('');
process.exit(1);
