// =========================================================
// 놓을 위치: src/server/repositories/device-link.ts
//
// 치과 스캐너 PC — 코드 발급·열쇠 검사·스캔 받기 (2026-10-02).
//
// ★ 기기 열쇠는 **해시로만** 저장합니다. 표가 새어도 그대로 못 씁니다.
// ★ 파일은 우리 서버를 거치지 않습니다. 저장소가 내주는 **서명 업로드 주소**로
//   PC 가 바로 올립니다 — 150MB 짜리를 화면 서버로 지나가게 하면 막힙니다.
// ★ 올린 것은 'incoming' 아래에 둡니다. 주문에 붙을 때 주문 폴더로 옮깁니다.
// =========================================================

import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanScanMeta, type ScanMeta } from '@/server/domain/device-link';

const BUCKET = 'order-files';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface LinkedDevice {
  id: string;
  clinicOrgId: string;
  name: string;
}

/** 코드를 열쇠로 바꿉니다. 코드는 그 자리에서 소모됩니다 */
export async function linkDevice(
  code: string,
  deviceName: string,
): Promise<{ ok: true; token: string; deviceId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('device_link_codes')
    .select('code, clinic_org_id, expires_at, used_at')
    .eq('code', code)
    .maybeSingle();

  const row = data as { clinic_org_id: string; expires_at: string; used_at: string | null } | null;
  if (!row) return { ok: false, error: '코드가 올바르지 않습니다' };
  if (row.used_at) return { ok: false, error: '이미 사용한 코드입니다' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: '코드가 만료됐습니다' };

  const token = randomBytes(32).toString('base64url');

  const { data: device, error } = await admin
    .from('clinic_devices')
    .insert({
      clinic_org_id: row.clinic_org_id,
      name: deviceName.trim().slice(0, 60) || '스캐너 PC',
      token_hash: hashToken(token),
    })
    .select('id')
    .single();

  if (error || !device) return { ok: false, error: '기기를 등록하지 못했습니다' };

  await admin
    .from('device_link_codes')
    .update({ used_at: new Date().toISOString(), device_id: device.id })
    .eq('code', code);

  return { ok: true, token, deviceId: device.id };
}

/** 헤더의 열쇠가 살아 있는 기기인가 */
export async function deviceFromToken(token: string | null): Promise<LinkedDevice | null> {
  if (!token) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('clinic_devices')
    .select('id, clinic_org_id, name, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  const row = data as { id: string; clinic_org_id: string; name: string; revoked_at: string | null } | null;
  if (!row || row.revoked_at) return null;

  await admin.from('clinic_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', row.id);

  return { id: row.id, clinicOrgId: row.clinic_org_id, name: row.name };
}

export interface ScanUpload {
  name: string;
  path: string;
  /** 저장소가 내준 업로드 열쇠 (이 주소로 PUT 하면 끝) */
  token: string;
}

export interface ScanSlot {
  scanId: string;
  /** 파일마다 한 자리씩 (2026-10-05 — Medit 은 한 케이스가 obj 여럿) */
  uploads: ScanUpload[];
  /** 먼저 나간 올리미를 위해 첫 파일을 그대로도 적어 둡니다 */
  path: string;
  token: string;
}

/**
 * 스캔 한 건을 받을 자리를 엽니다.
 *
 * ★ 같은 케이스를 다시 내보내면 **새로 만들지 않고** 이미 있는 줄을 돌려줍니다
 *   (case_guid 에 건 유일 색인). 치과가 두 번 올려도 목록이 더러워지지 않습니다.
 */
export async function openScanSlot(
  device: LinkedDevice,
  raw: Partial<ScanMeta>,
): Promise<{ ok: true; slot: ScanSlot; already: boolean } | { ok: false; error: string }> {
  const meta = cleanScanMeta(raw);
  if (!meta) return { ok: false, error: 'dxd 파일 정보가 아닙니다' };

  const admin = createAdminClient();

  if (meta.caseGuid) {
    const { data: existing } = await admin
      .from('incoming_scans')
      .select('id, storage_path, upload_status')
      .eq('clinic_org_id', device.clinicOrgId)
      .eq('case_guid', meta.caseGuid)
      .is('deleted_at', null)
      .maybeSingle();

    const found = existing as { id: string; storage_path: string; upload_status: string } | null;
    if (found && found.upload_status === 'uploaded') {
      return {
        ok: true,
        already: true,
        slot: { scanId: found.id, uploads: [], path: found.storage_path, token: '' },
      };
    }
  }

  // ★ 파일마다 자리를 하나씩 엽니다. 확장자는 지켜 둡니다 — 뒤에 주문 폴더로
  //   옮길 때도, exocad 런처가 부위를 가릴 때도 이름이 일입니다.
  const placed = meta.files.map((f) => {
    const dot = f.name.lastIndexOf('.');
    const ext = dot > 0 ? f.name.slice(dot).toLowerCase() : '';
    return { ...f, path: `incoming/${device.clinicOrgId}/${crypto.randomUUID()}${ext}` };
  });

  const { data: row, error } = await admin
    .from('incoming_scans')
    .insert({
      clinic_org_id: device.clinicOrgId,
      device_id: device.id,
      patient_name: meta.patientName,
      chart_no: meta.chartNo,
      clinic_name_in_file: meta.clinicNameInFile,
      case_guid: meta.caseGuid,
      scanned_at: meta.scannedAt,
      teeth: meta.teeth,
      file_name: meta.fileName,
      file_size: meta.fileSize,
      storage_path: placed[0].path,
      files: placed.map((f) => ({ name: f.name, path: f.path, size: f.size })),
      upload_status: 'pending',
    })
    .select('id')
    .single();

  if (error || !row) return { ok: false, error: `자리를 열지 못했습니다: ${error?.message ?? ''}` };

  const uploads: ScanUpload[] = [];
  for (const f of placed) {
    const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(f.path);
    if (signed.error || !signed.data) {
      return { ok: false, error: '업로드 주소를 못 받았습니다' };
    }
    uploads.push({ name: f.name, path: f.path, token: signed.data.token });
  }

  return {
    ok: true,
    already: false,
    slot: { scanId: row.id, uploads, path: uploads[0].path, token: uploads[0].token },
  };
}

/** 다 올렸다고 표시합니다. 저장소에 실제로 있는지 확인한 뒤에만 */
export async function finishScan(
  device: LinkedDevice,
  scanId: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('incoming_scans')
    .select('id, storage_path, clinic_org_id, files')
    .eq('id', scanId)
    .maybeSingle();

  const row = data as {
    id: string;
    storage_path: string;
    clinic_org_id: string;
    files: ScanFileRow[] | null;
  } | null;
  if (!row || row.clinic_org_id !== device.clinicOrgId) return { ok: false, error: '없는 스캔입니다' };

  const wanted = scanFilesOf(row);

  /*
    ★ **하나라도 없으면 '올라옴' 으로 안 바꿉니다** (2026-10-05).
      Medit 은 한 케이스가 obj 여럿입니다. 셋 중 둘만 올라간 채로 목록에 뜨면
      치과는 멀쩡한 줄 알고 주문서를 쓰고, 디자인센터는 교합이 없는 케이스를 받습니다.
  */
  let total = 0;
  for (const file of wanted) {
    const cut = file.path.lastIndexOf('/');
    const { data: listed } = await admin.storage
      .from(BUCKET)
      .list(file.path.slice(0, cut), { search: file.path.slice(cut + 1) });

    const found = (listed ?? []).find((f) => f.name === file.path.slice(cut + 1));
    if (!found) return { ok: false, error: `저장소에 ${file.name} 이(가) 없습니다` };

    total += (found.metadata as { size?: number } | null)?.size ?? 0;
  }

  await admin
    .from('incoming_scans')
    .update({ upload_status: 'uploaded', file_size: total })
    .eq('id', scanId);

  return { ok: true };
}

export interface ScanFileRow {
  name: string;
  path: string;
  size?: number;
}

/**
 * 이 스캔의 파일들.
 *
 * ★ 예전 줄(dxd)은 files 가 비어 있습니다. 그때는 storage_path 하나로 봅니다 —
 *   지난 줄을 건드려 고치지 않습니다 (migration 20261005120000).
 */
export function scanFilesOf(row: {
  storage_path: string;
  file_name?: string | null;
  files?: ScanFileRow[] | null;
}): ScanFileRow[] {
  const listed = (row.files ?? []).filter((f) => f?.path);
  if (listed.length > 0) return listed;
  return [{ name: row.file_name ?? '스캔', path: row.storage_path }];
}


export interface ScannerDeviceRow {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
}

/** 내 치과에 연결된 PC 들 (화면용). RLS 가 자기 것만 돌려줍니다 */
export async function listScannerDevices(): Promise<ScannerDeviceRow[]> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data } = await supabase
    .from('clinic_devices')
    .select('id, name, created_at, last_seen_at, revoked_at')
    .is('revoked_at', null)
    .order('created_at');

  return ((data ?? []) as { id: string; name: string; created_at: string; last_seen_at: string | null }[]).map(
    (d) => ({ id: d.id, name: d.name, createdAt: d.created_at, lastSeenAt: d.last_seen_at }),
  );
}


export interface IncomingScanRow {
  id: string;
  patientName: string;
  chartNo: string;
  clinicNameInFile: string;
  scannedAt: string;
  teeth: number[];
  fileName: string;
  fileSize: number | null;
  /** 한 케이스의 파일 수 (Medit 은 상악·하악·교합으로 여럿) */
  fileCount: number;
  uploadStatus: string;
  createdAt: string;
}

/** 아직 주문에 안 붙은 스캔들 (치과 화면). RLS 가 자기 것만 돌려줍니다 */
export async function listIncomingScans(): Promise<IncomingScanRow[]> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data } = await supabase
    .from('incoming_scans')
    .select(
      'id, patient_name, chart_no, clinic_name_in_file, scanned_at, teeth, file_name, file_size, files, storage_path, upload_status, created_at',
    )
    .is('order_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    patientName: (r.patient_name as string) ?? '',
    chartNo: (r.chart_no as string) ?? '',
    clinicNameInFile: (r.clinic_name_in_file as string) ?? '',
    scannedAt: (r.scanned_at as string) ?? '',
    teeth: ((r.teeth as number[]) ?? []).slice(),
    fileName: (r.file_name as string) ?? '',
    fileSize: (r.file_size as number) ?? null,
    fileCount: scanFilesOf(r as unknown as { storage_path: string; files?: ScanFileRow[] }).length,
    uploadStatus: (r.upload_status as string) ?? 'pending',
    createdAt: r.created_at as string,
  }));
}

/** 주문 등록 화면에서 쓸 스캔 하나 */
export async function getIncomingScan(scanId: string): Promise<IncomingScanRow | null> {
  const rows = await listIncomingScans();
  return rows.find((r) => r.id === scanId) ?? null;
}


export interface RescanWaitingOrder {
  id: string;
  orderNo: string;
  patientName: string;
  dueDate: string | null;
}

/**
 * 지금 **재스캔으로 걸려 있는** 내 치과 주문들 (사용자 요청 2026-10-02).
 *
 * ★ 스캔이 올라왔을 때 "새 주문을 쓸까, 걸려 있던 주문에 붙일까" 를 치과가
 *   고르게 하려고 씁니다. 같은 환자 이름이면 새 주문보다 이쪽이 맞습니다 —
 *   재스캔을 그대로 두고 주문을 또 쓰면 같은 환자가 두 줄이 됩니다.
 * ★ RLS 가 자기 치과 것만 돌려줍니다.
 */
export async function listRescanWaitingOrders(): Promise<RescanWaitingOrder[]> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select('id, order_no, patient_label, due_date')
    .eq('status', 'rescan')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    orderNo: (r.order_no as string) ?? '',
    patientName: (r.patient_label as string) ?? '',
    dueDate: (r.due_date as string) ?? null,
  }));
}


/**
 * 사이드바가 쓸 두 가지 — 스캐너를 연결했는가, 기다리는 스캔이 몇 건인가.
 *
 * ★ 메뉴는 **연결한 치과에만** 보입니다 (사용자 지적 2026-10-02).
 *   안 쓰는 치과에는 평생 빈 화면입니다.
 * ★ 숫자는 머릿수만 셉니다(head) — 줄 내용을 안 끌어옵니다. 레이아웃은
 *   모든 화면에서 돌아서, 여기서 한 번만 느려도 치과 전체가 느려집니다.
 */
export async function scannerNavState(): Promise<{ linked: boolean; waiting: number }> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const [devices, scans] = await Promise.all([
    supabase
      .from('clinic_devices')
      .select('id', { count: 'exact', head: true })
      .is('revoked_at', null),
    supabase
      .from('incoming_scans')
      .select('id', { count: 'exact', head: true })
      .is('order_id', null)
      .is('deleted_at', null),
  ]);

  return { linked: (devices.count ?? 0) > 0, waiting: scans.count ?? 0 };
}
