// =========================================================
// 놓을 위치: scripts/backup.mjs
// 쓰는 법:  npm run backup
//
// 운영 DB 를 통째로 파일로 받아 둡니다.
//
// ★★ **만든 이유 — 지금 백업이 한 벌도 없습니다.**
//   Supabase 무료 요금제는 자동 백업을 안 해 줍니다(Pro 부터입니다).
//   실수로 지운 것도, 잘못 돌린 마이그레이션도 되돌릴 방법이 없습니다.
//   거래처를 받기 시작하면 그건 남의 환자 자료입니다.
//   Pro 로 올리기 전까지는 이 스크립트가 유일한 안전망입니다.
//
// ★ 환자 실명이 들어 있습니다.
//   받아 둔 폴더는 개인정보 파일입니다 — 아무 데나 두거나 메일로
//   보내면 안 됩니다. git 에도 안 올라가게 .gitignore 에 넣어 뒀습니다.
//
// ★ 저장소 파일(스캔)은 **안 받습니다.**
//   용량이 크고, 받아 두면 그 폴더가 그대로 환자 스캔 더미가 됩니다.
//   파일까지 필요하면 Supabase 대시보드 → Storage 에서 내려받으세요.
//   (여기서 받는 order_files 표에는 '어떤 파일이 있었는가' 가 남습니다)
// =========================================================

import { mkdir, writeFile, readFile } from 'node:fs/promises';

const TABLES = [
  // 조직·사람
  'organizations', 'partnerships', 'user_profiles', 'memberships', 'org_invites',
  'signup_requests',
  // 주문
  'orders', 'order_items', 'order_files', 'order_options', 'order_memos',
  'order_messages', 'order_issues', 'order_status_history', 'order_bridges',
  'order_bridge_members', 'order_no_counters', 'patients', 'pickup_requests',
  'remake_reasons',
  // 제품·단가
  'prosthesis_types', 'prosthesis_materials', 'price_lists', 'surcharge_prices',
  'clinic_product_prices', 'lab_product_costs',
  'production_option_groups', 'production_option_values', 'clinic_option_presets',
  'implant_makers', 'implant_types', 'implant_sizes', 'implant_screws',
  'implant_options', 'clinic_implant_favorites',
  // 정산 — 돈. 제일 먼저 챙길 것들입니다
  'billing_periods', 'billing_lines', 'billing_adjustments', 'billing_payments',
  'credit_notes',
  // 설정·기록
  'holidays', 'notices', 'contact_requests', 'clinic_fit_values',
  'fit_value_changes', 'retention_settings', 'retention_runs', 'audit_logs',
  'notifications', 'domain_events', 'push_subscriptions', 'alimtalk_queue',
];

// ---------- 환경 ----------

const env = Object.fromEntries(
  (await readFile(new URL('../.env.local', import.meta.url), 'utf8'))
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !KEY) {
  console.error('.env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 있어야 합니다');
  process.exit(1);
}

// ★ 어느 DB 를 받는지 먼저 찍습니다. 시험 서버를 받아 두고 운영을
//   받았다고 믿는 것이 제일 나쁩니다 ([[ds-flow-staging]] 와 같은 이유)
const ref = URL_.replace('https://', '').split('.')[0];
console.log('대상 DB :', ref);

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const dir = new URL(`../backup/${stamp}/`, import.meta.url);
await mkdir(dir, { recursive: true });

// ---------- 받기 ----------

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const PAGE = 1000;

let totalRows = 0;
const summary = [];

for (const table of TABLES) {
  const rows = [];

  // 한 번에 1000줄씩 — 큰 표도 빠짐없이 받습니다
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${from}`, {
      headers,
    });

    if (!res.ok) {
      console.log(`  ${table.padEnd(28)} 건너뜀 (${res.status})`);
      rows.length = 0;
      break;
    }

    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  await writeFile(new URL(`${table}.json`, dir), JSON.stringify(rows, null, 1), 'utf8');

  totalRows += rows.length;
  summary.push({ table, rows: rows.length });
  console.log(`  ${table.padEnd(28)} ${String(rows.length).padStart(6)}줄`);
}

await writeFile(
  new URL('_요약.json', dir),
  JSON.stringify({ 대상: ref, 받은때: new Date().toISOString(), 표: summary, 합계: totalRows }, null, 1),
  'utf8',
);

console.log(`\n표 ${TABLES.length}개 · ${totalRows}줄 받았습니다`);
console.log(`폴더: backup/${stamp}/`);
console.log('\n★ 환자 실명이 들어 있는 폴더입니다. 아무 데나 두지 마세요.');
