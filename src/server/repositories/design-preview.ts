// =========================================================
// 놓을 위치: src/server/repositories/design-preview.ts
//
// 하루치 '크라운 찾기' 종이에 실릴 줄들 (2026-09-28, 사용자 요청).
//
// ★ 디자인 STL 의 여섯 방향 미리보기 + 그 주문의 **환자·치식·치과**.
//   런처의 STL→이미지 종이와 다른 점이 이것입니다 — 이름을 맞출 필요가 없습니다.
// ★ 치과는 부를 일이 없습니다(그 종이는 작업대용). 센터·기공소만.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { formatTeeth } from '@/server/domain/alimtalk';

const BUCKET = 'order-files';
const TTL_SECONDS = 60 * 60;

export interface PreviewSheetRow {
  fileId: string;
  orderId: string;
  orderNo: string;
  patient: string;
  clinicName: string;
  teeth: string;
  dueDate: string | null;
  fileName: string;
  previewUrl: string;
  uploadedAt: string;
}

export type SheetBasis = 'uploaded' | 'due';

interface Raw {
  id: string;
  file_name: string;
  preview_path: string | null;
  created_at: string;
  order: {
    id: string;
    order_no: string;
    patient_label: string;
    due_date: string | null;
    design_org_id: string | null;
    lab_org_id: string | null;
    clinic: { name: string } | null;
    order_items: { tooth_number: number }[] | null;
  } | null;
}

/**
 * 그 날짜의 줄들. basis 가 'uploaded' 면 **디자인 파일을 올린 날**,
 * 'due' 면 요청시한입니다. 신터링을 찾을 때는 올린 날이 맞습니다.
 */
export async function getPreviewSheet(date: string, basis: SheetBasis = 'uploaded'): Promise<PreviewSheetRow[]> {
  const session = await getSession();
  if (!session?.orgId || session.orgType === 'clinic') return [];

  const supabase = await createClient();

  let query = supabase
    .from('order_files')
    .select(
      'id, file_name, preview_path, created_at, ' +
        'order:orders!inner(id, order_no, patient_label, due_date, design_org_id, lab_org_id, deleted_at, ' +
        'clinic:organizations!orders_clinic_org_id_fkey(name), order_items(tooth_number))',
    )
    .eq('kind', 'design')
    .eq('upload_status', 'uploaded')
    .not('preview_path', 'is', null)
    .is('order.deleted_at', null);

  query =
    basis === 'due'
      ? query.eq('order.due_date', date)
      : query.gte('created_at', `${date}T00:00:00+09:00`).lte('created_at', `${date}T23:59:59+09:00`);

  const { data } = await query.order('created_at');
  const rows = (data ?? []) as unknown as Raw[];

  const paths = rows.map((r) => r.preview_path).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length
    ? await supabase.storage.from(BUCKET).createSignedUrls(paths, TTL_SECONDS)
    : { data: [] };
  const byPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl]));

  return rows
    .map((r) => {
      const url = r.preview_path ? byPath.get(r.preview_path) : null;
      if (!r.order || !url) return null;

      return {
        fileId: r.id,
        orderId: r.order.id,
        orderNo: r.order.order_no,
        patient: r.order.patient_label,
        clinicName: r.order.clinic?.name ?? '-',
        teeth: formatTeeth((r.order.order_items ?? []).map((i) => i.tooth_number)),
        dueDate: r.order.due_date,
        fileName: r.file_name,
        previewUrl: url,
        uploadedAt: r.created_at,
      } satisfies PreviewSheetRow;
    })
    .filter((r): r is PreviewSheetRow => r !== null);
}
