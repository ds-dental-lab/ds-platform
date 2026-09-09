// =========================================================
// 놓을 위치: src/app/api/exocad/orders/[orderId]/route.ts
//
// PC 런처가 부르는 곳 — 주문 정보 + 스캔 파일 주소. (2026-09-09)
//
// ★ 문은 토큰입니다. 버튼이 10분짜리 토큰을 만들어 denflow:// 주소에
//   실었고, 런처는 그것만 들고 옵니다. 세션·쿠키 없음.
// ★ 관리자 열쇠(service role)로 읽습니다 — 런처에는 로그인이 없습니다.
//   그래서 **토큰이 곧 권한**이고, 토큰은 주문 하나에만 묶여 있습니다.
// ★ 파일 주소는 10분 삽니다. 스캔은 수십 MB 라 화면의 60초보다 길어야
//   하고, 흘러도 곧 죽습니다.
// ★ 받아 갔다는 시각을 exocad_exports 에 찍습니다 — 환자 이름과 스캔이
//   회사 PC 로 나가는 순간입니다. 누가 눌렀는지는 그 줄의 requested_by.
// =========================================================

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyExocadToken } from '@/server/exocad/token';
import { buildExocadPayload, isExocadScanFile } from '@/server/domain/exocad';

export const dynamic = 'force-dynamic';

const BUCKET = 'order-files';
const URL_TTL_SECONDS = 10 * 60;

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const token = new URL(request.url).searchParams.get('t');
  const check = verifyExocadToken(orderId, token);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 401 });

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('orders')
    .select(
      'id, order_no, created_at, patient_label, patient:patients(name), ' +
        'order_items(id, tooth_number, type_code, is_pontic), ' +
        'order_bridges(id, order_bridge_members(order_item_id)), ' +
        'order_files(id, kind, file_name, file_size, storage_path, upload_status, deleted_at)',
    )
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!row) return Response.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });

  const order = row as unknown as {
    id: string;
    order_no: string;
    created_at: string;
    patient_label: string;
    patient: { name: string } | null;
    order_items: { id: string; tooth_number: number; type_code: string; is_pontic: boolean }[];
    order_bridges: { id: string; order_bridge_members: { order_item_id: string }[] }[];
    order_files: {
      id: string;
      kind: string;
      file_name: string;
      file_size: number | null;
      storage_path: string;
      upload_status: string;
      deleted_at: string | null;
    }[];
  };

  const scans = order.order_files.filter(
    (f) => !f.deleted_at && isExocadScanFile({ kind: f.kind, uploadStatus: f.upload_status }),
  );

  const signed = await Promise.all(
    scans.map(async (f) => {
      const { data } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(f.storage_path, URL_TTL_SECONDS, { download: f.file_name });
      return data ? { name: f.file_name, url: data.signedUrl, size: f.file_size } : null;
    }),
  );

  const { payload, unknownTypes } = buildExocadPayload({
    orderId: order.id,
    orderNo: order.order_no,
    patientName: order.patient?.name ?? order.patient_label,
    orderDate: order.created_at.slice(0, 10),
    items: order.order_items.map((it) => ({
      id: it.id,
      toothNumber: it.tooth_number,
      typeCode: it.type_code,
      isPontic: it.is_pontic,
    })),
    bridges: order.order_bridges.map((b) => ({
      memberItemIds: b.order_bridge_members.map((m) => m.order_item_id),
    })),
    files: signed.filter((f): f is NonNullable<typeof f> => f !== null),
  });

  after(async () => {
    await admin
      .from('exocad_exports')
      .update({ fetched_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .is('fetched_at', null);
  });

  return Response.json({ ...payload, unknownTypes }, { headers: { 'cache-control': 'no-store' } });
}
