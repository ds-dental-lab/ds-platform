// =========================================================
// 놓을 위치: scripts/seed-staging-data.mjs
// 쓰는 법:  node scripts/seed-staging-data.mjs
//
// 시험 서버에 **굴려 볼 자료**를 심습니다.
//   ① 단가 — 치과 판매가 · 기공 원가
//   ② 주문 — 상태별로 골고루, 배송된 것 몇 건(정산 대상)
//   ③ 수거요청 한 건
//
// ★ 조직·계정·제품은 seed-staging.mjs 와 supabase/seed.sql 이 먼저입니다.
//   그것부터 돌린 뒤에 이걸 돌리세요.
//
// ★ **운영에서는 절대 안 돕니다.** ref 를 먼저 보고 운영이면 멈춥니다.
//   가짜 주문을 운영에 넣는 것이 이 스크립트의 최악의 사고입니다.
//
// ★ 여러 번 돌려도 안 불어납니다. 이미 주문이 있으면 그냥 끝냅니다 —
//   '한 번 더 돌렸더니 스무 건이 됐다' 를 막습니다.
// =========================================================

import { readFileSync } from 'node:fs';

const PRODUCTION_REF = 'dzliwedyqkondvcwnvbh';

const env = Object.fromEntries(
  readFileSync('.env.staging.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const U = env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;

if (!U || !K) {
  console.error('.env.staging.local 이 비어 있습니다');
  process.exit(1);
}
if (U.includes(PRODUCTION_REF)) {
  console.error('★ 운영 프로젝트입니다. 이 스크립트는 시험 서버에만 돕니다.');
  process.exit(1);
}

const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (q) => (await fetch(`${U}/rest/v1/${q}`, { headers: H })).json();
/**
 * @param upsert 이미 있으면 덮어씁니다.
 *   ★ 단가는 이걸 켭니다. 처음 돌리다 뒤에서 실패하면 앞부분만 들어간
 *     채로 남는데, 그대로 다시 돌리면 중복키로 또 막힙니다.
 *     한 번 겪었습니다.
 */
const post = async (t, body, upsert = false) => {
  const r = await fetch(`${U}/rest/v1/${t}`, {
    method: 'POST',
    headers: {
      ...H,
      Prefer: upsert ? 'return=representation,resolution=merge-duplicates' : 'return=representation',
    },
    body: JSON.stringify(body),
  });
  const out = await r.json();
  if (r.status >= 300) throw new Error(`${t}: ${r.status} ${JSON.stringify(out).slice(0, 200)}`);
  return out;
};

console.log('대상:', U, '\n');

// ---------- 준비물 ----------
const orgs = await get('organizations?select=id,code,org_type');
const by = Object.fromEntries(orgs.map((o) => [o.code, o]));
const clinic = by['DC-001'];
const design = by['DD-001'];
const lab = by['DL-001'];

if (!clinic || !design || !lab) {
  console.error('조직이 없습니다. 먼저 supabase db push --include-seed 를 돌리세요.');
  process.exit(1);
}

const already = await get('orders?select=id&limit=1');
if (already.length > 0) {
  console.log('이미 주문이 있습니다. 아무것도 안 하고 끝냅니다.');
  process.exit(0);
}

const materials = await get(
  'prosthesis_materials?select=id,code,price,pontic_price,type:prosthesis_types(code)',
);
const zir = materials.find((m) => m.code === 'zirconia') ?? materials[0];

// ---------- ① 단가 ----------
//
// ★ 치과 판매가만 넣습니다. 제품 기본가가 있으면 그것도 쓰이지만,
//   거래처별 값이 있어야 '치과마다 다른 단가' 를 시험할 수 있습니다.
{
  /*
    ★ 이미 있으면 건드리지 않습니다.
      처음에 upsert(merge-duplicates)로 하려다 막혔습니다 — PostgREST 는
      기본키로만 충돌을 봅니다. 여기 유일키는 (clinic_org_id, material_id)
      라 안 걸립니다. 있으면 넘어가는 편이 짧고 뜻도 분명합니다.
  */
  const has = await get(`clinic_product_prices?select=id&clinic_org_id=eq.${clinic.id}&limit=1`);

  if (has.length > 0) {
    console.log('① 치과 판매가 — 이미 있습니다');
  } else {
    const rows = materials.slice(0, 4).map((m, i) => ({
      owner_org_id: design.id,
      clinic_org_id: clinic.id,
      material_id: m.id,
      price: 50000 + i * 10000,
      pontic_price: 40000 + i * 10000,
    }));

    await post('clinic_product_prices', rows);
    console.log(`① 치과 판매가 ${rows.length}줄`);
  }
}

// ---------- ② 주문 ----------
//
// ★ 상태를 골고루 깝니다. 한 상태만 있으면 목록·필터·HOME 을
//   제대로 못 봅니다.
// ★ 배송된 건에는 shipped_at 을 넣습니다 — 정산이 그걸로 가릅니다.

const today = new Date();
const day = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const PLAN = [
  { no: 1, status: 'received', due: 4, ship: null, patient: '김O수 (M/54)' },
  { no: 2, status: 'rescan', due: 3, ship: null, patient: '박O영 (F/38)' },
  { no: 3, status: 'designing', due: 5, ship: null, patient: '이O민 (M/29)' },
  { no: 4, status: 'production_wait', due: 2, ship: null, patient: '최O아 (F/41)' },
  { no: 5, status: 'production', due: 1, ship: null, patient: '정O호 (M/62)' },
  { no: 6, status: 'shipping', due: 0, ship: -1, patient: '강O린 (F/33)' },
  { no: 7, status: 'completed', due: -6, ship: -6, patient: '윤O재 (M/47)' },
  { no: 8, status: 'completed', due: -10, ship: -10, patient: '한O설 (F/25)' },
];

const stamp = today.toISOString().slice(2, 10).replace(/-/g, '');
const made = [];

for (const p of PLAN) {
  const [order] = await post('orders', [
    {
      order_no: `ORD-${stamp}-${String(p.no).padStart(3, '0')}`,
      clinic_org_id: clinic.id,
      design_org_id: design.id,
      // ★ 제작 단계부터 기공소가 붙습니다. 그 앞은 아직 배정 전입니다
      lab_org_id: ['production_wait', 'production', 'shipping', 'completed'].includes(p.status)
        ? lab.id
        : null,
      patient_label: p.patient,
      /*
        ★ 기공소에 내려가는 마스킹 이름입니다 (설계서 §8.5).
          NOT NULL 이라 안 넣으면 주문 자체가 안 들어갑니다 —
          여기서 한 번 걸려 봤습니다.
      */
      patient_label_masked: p.patient.replace(/^(.)(.*?)(\s|$)/, '$1O$3'),
      status: p.status,
      due_date: day(p.due),
      received_at: day(p.due - 4) + 'T09:00:00+09:00',
      shipped_at: p.ship === null ? null : day(p.ship) + 'T14:00:00+09:00',
      is_billable: true,
    },
  ]);

  await post('order_items', [
    {
      order_id: order.id,
      tooth_number: 11 + (p.no % 6),
      type_code: zir.type?.code ?? 'crown',
      material_code: zir.code,
    },
  ]);

  made.push(`${order.order_no} ${p.status}`);
}

console.log(`② 주문 ${made.length}건`);
for (const m of made) console.log('   ', m);

// ---------- ③ 수거요청 ----------
{
  const target = await get(`orders?select=id&status=eq.production_wait&limit=1`);

  if (target[0]) {
    /* 표 이름은 pickup_requests 입니다. due_date 칸은 없습니다 —
       요청시한은 주문의 것을 씁니다 */
    await post('pickup_requests', [
      {
        order_id: target[0].id,
        clinic_org_id: clinic.id,
        lab_org_id: lab.id,
        kind: 'model',
        status: 'open',
        memo: '상악 모델',
      },
    ]);
    console.log('③ 수거요청 1건');
  }
}

console.log('\n끝났습니다. design@test.kr / test1234 로 들어가 보세요.');
