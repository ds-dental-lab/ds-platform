// =========================================================
// 놓을 위치: src/server/repositories/learn-cases.ts
//
// 밤 실행이 배울 덴플로우 주문 목록 (2026-11-06). 고르는 규칙은 domain/learn-cases.
//
// ★ 설계 PC(디자인센터 기기)만 받습니다. 치과 기기 열쇠로는 못 받습니다.
// ★ 주는 것: 주문번호·구치부 크라운 치식·스캔 파일 이름과 내려받을 주소(2시간). **환자 이름은 주지 않습니다**
//   — 밤 실행은 주문번호로만 파일 이름을 짓습니다.
// ★ 읽기만 합니다. 주문 상태·파일은 건드리지 않습니다.
// =========================================================
import { createAdminClient } from '@/lib/supabase/admin';
import { learnable, pickLearnFiles, type LearnItem } from '@/server/domain/learn-cases';

const BUCKET = 'order-files';
const TTL_SECONDS = 2 * 60 * 60;
/** 이만큼 지난 주문까지 봅니다 — 하루 모은 것 + 밤을 한 번 거른 날 */
const DEFAULT_HOURS = 48;
const MAX_CASES = 40;

export interface LearnCase {
  orderId: string;
  orderNo: string;
  teeth: number[];
  files: { name: string; url: string; size: number | null }[];
}

export async function listLearnCases(
  orgId: string,
  hours = DEFAULT_HOURS,
): Promise<{ ok: true; cases: LearnCase[]; skipped: number } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: org } = await admin.from('organizations').select('org_type').eq('id', orgId).maybeSingle();
  if ((org as { org_type?: string } | null)?.org_type !== 'design_center') {
    return { ok: false, error: '설계 PC 만 받을 수 있습니다' };
  }

  const since = new Date(Date.now() - Math.min(Math.max(hours, 1), 24 * 14) * 3_600_000).toISOString();
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, order_no')
    .eq('order_type', 'modelless')
    .is('deleted_at', null)
    .not('status', 'in', '(cancelled,uploading)')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return { ok: false, error: error.message };
  const rows = (orders ?? []) as { id: string; order_no: string }[];
  if (!rows.length) return { ok: true, cases: [], skipped: 0 };

  const ids = rows.map((r) => r.id);
  const [{ data: items }, { data: files }] = await Promise.all([
    admin.from('order_items').select('order_id, tooth_number, type_code, implant_manufacturer, implant_type').in('order_id', ids),
    admin
      .from('order_files')
      .select('order_id, file_name, file_size, storage_path')
      .in('order_id', ids)
      .eq('kind', 'scan')
      .eq('upload_status', 'uploaded')
      .is('deleted_at', null),
  ]);

  type ItemRow = { order_id: string; tooth_number: number; type_code: string; implant_manufacturer: string | null; implant_type: string | null };
  type FileRow = { order_id: string; file_name: string; file_size: number | null; storage_path: string };
  const itemsOf = new Map<string, LearnItem[]>();
  for (const i of (items ?? []) as ItemRow[]) {
    const list = itemsOf.get(i.order_id) ?? [];
    list.push({ tooth: i.tooth_number, type: i.type_code, implant: !!(i.implant_manufacturer || i.implant_type) });
    itemsOf.set(i.order_id, list);
  }
  const filesOf = new Map<string, FileRow[]>();
  for (const f of (files ?? []) as FileRow[]) {
    const list = filesOf.get(f.order_id) ?? [];
    list.push(f);
    filesOf.set(f.order_id, list);
  }

  const cases: LearnCase[] = [];
  let skipped = 0;
  for (const o of rows) {
    if (cases.length >= MAX_CASES) break;
    const ok = learnable(itemsOf.get(o.id) ?? []);
    const all = filesOf.get(o.id) ?? [];
    const chosen = ok.ok ? pickLearnFiles(all.map((f) => ({ name: f.file_name, size: f.file_size }))) : [];
    if (!ok.ok || !chosen.length) {
      skipped += 1;
      continue;
    }
    const picked = chosen.map((c) => all.find((f) => f.file_name === c.name)!).filter(Boolean);
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(picked.map((f) => f.storage_path), TTL_SECONDS);
    const urls = (signed ?? []) as { signedUrl: string | null; error: string | null }[];
    if (urls.length !== picked.length || urls.some((u) => !u.signedUrl)) {
      skipped += 1;
      continue;
    }
    cases.push({
      orderId: o.id,
      orderNo: o.order_no,
      teeth: ok.teeth,
      files: picked.map((f, i) => ({ name: f.file_name, url: urls[i].signedUrl!, size: f.file_size })),
    });
  }
  return { ok: true, cases, skipped };
}
