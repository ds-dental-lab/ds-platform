// =========================================================
// 놓을 위치: src/server/repositories/shade-photo.ts
//
// 진료실 모바일 화면이 읽는 것. (명세서 SPEC_shade-photo S1·S2)
//
// ★ 치과 자기 주문만 옵니다 — RLS 가 고릅니다. 여기서 조직을 다시
//   적지 않습니다. 두 곳에 조건을 적으면 어긋날 때 구멍이 납니다.
// =========================================================

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  canShoot,
  shadeStatusOf,
  isAnterior,
  isPhoto,
  thumbTransform,
  HOME_DAYS,
  THUMB_TTL,
  type ShadeStatus,
} from '@/server/domain/shade-photo';
import type { OrderStatus } from '@/server/domain/order-status';

export interface ShadeCase {
  id: string;
  orderNo: string;
  patientLabel: string;
  /** 'Zir-Cr · #26' 처럼 한 줄로 */
  workLabel: string;
  status: OrderStatus;
  shade: ShadeStatus;
  createdAt: string;
  photoCount: number;
}

interface RawItem {
  tooth_number: number;
  type_code: string;
  material_code: string;
}

interface RawCase {
  id: string;
  order_no: string;
  patient_label: string;
  status: OrderStatus;
  created_at: string;
  order_items: RawItem[] | null;
  order_files: { file_name: string; kind: string }[] | null;
}

/**
 * 의뢰 내용을 한 줄로. 'Zirconia Crown · #26'
 *
 * ★ 코드를 그대로 보여 주지 않습니다. 진료실 스태프가 읽는 화면이라
 *   `zirconia` 보다 `지르코니아` 가 맞습니다. 다만 제품 이름은 마스터에
 *   있고 여기서 조인하면 무거워지므로, 치식과 개수를 앞세웁니다.
 */
function workLabelOf(items: RawItem[]): string {
  if (items.length === 0) return '항목 없음';

  const teeth = [...new Set(items.map((i) => i.tooth_number))].sort((a, b) => a - b);
  const shown = teeth.slice(0, 3).map((t) => `#${t}`).join(' ');
  const more = teeth.length > 3 ? ` 외 ${teeth.length - 3}` : '';

  return `${shown}${more} · ${items.length}개`;
}

/**
 * 진료실 홈 목록. 최근 7일, 최신 작성 순. (명세서 S1)
 *
 * ★ 찍을 수 있는 단계만 세웁니다. 배송 나간 뒤에 쉐이드를 찍는 일은
 *   없습니다 — 있다면 그건 리메이크입니다.
 */
export async function listShadeCases(keyword?: string): Promise<ShadeCase[]> {
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - HOME_DAYS);

  let query = supabase
    .from('orders')
    .select(
      'id, order_no, patient_label, status, created_at, ' +
        'order_items(tooth_number, type_code, material_code), ' +
        'order_files(file_name, kind)',
    )
    .is('deleted_at', null)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  const k = keyword?.trim();
  if (k) query = query.or(`order_no.ilike.%${k}%,patient_label.ilike.%${k}%`);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as RawCase[])
    .filter((row) => canShoot(row.status))
    .map((row) => {
      const files = row.order_files ?? [];

      return {
        id: row.id,
        orderNo: row.order_no,
        patientLabel: row.patient_label,
        workLabel: workLabelOf(row.order_items ?? []),
        status: row.status,
        shade: shadeStatusOf(files),
        createdAt: row.created_at,
        photoCount: files.filter((f) => f.kind !== 'design' && isPhoto(f.file_name)).length,
      };
    });
}

export interface ShadePhotoView {
  id: string;
  fileName: string;
  createdAt: string;
  /**
   * 목록 칸에 걸 줄인 사진. 못 만들면 빈 값입니다.
   *
   * ★ 원본 주소가 아닙니다. 진료실이 자기가 찍은 것을 **확인만**
   *   하면 되고, 원본은 한 장이 수 MB 라 목록에 걸 수 없습니다.
   */
  thumbUrl: string;
  /** 눌러서 크게 볼 때 */
  viewUrl: string;
}

export interface ShadeCaseDetail extends ShadeCase {
  labName: string;
  photos: ShadePhotoView[];
  /**
   * 앞니가 섞여 있는가. 카메라 가이드를 **코까지** 넓힙니다
   * (사용자 요청 2026-08-23).
   */
  anterior: boolean;
}

export async function getShadeCase(orderId: string): Promise<ShadeCaseDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select(
      'id, order_no, patient_label, status, created_at, ' +
        'order_items(tooth_number, type_code, material_code), ' +
        'order_files(id, file_name, storage_path, kind, created_at, upload_status), ' +
        'lab:organizations!orders_lab_org_id_fkey(name), ' +
        'design:organizations!orders_design_org_id_fkey(name)',
    )
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return null;

  interface DetailFile {
    id: string;
    file_name: string;
    storage_path: string;
    kind: string;
    created_at: string;
    upload_status: string;
  }

  const row = data as unknown as Omit<RawCase, 'order_files'> & {
    order_files: DetailFile[] | null;
    lab: { name: string } | null;
    design: { name: string } | null;
  };

  const files: DetailFile[] = row.order_files ?? [];

  return {
    id: row.id,
    orderNo: row.order_no,
    patientLabel: row.patient_label,
    workLabel: workLabelOf(row.order_items ?? []),
    status: row.status,
    shade: shadeStatusOf(files),
    createdAt: row.created_at,
    photoCount: files.filter((f) => f.kind !== 'design' && isPhoto(f.file_name)).length,
    /*
      ★ 만드는 곳을 보여 줍니다. 진료실은 '어디서 만드나' 를 알고 싶은
        것이지 우리 조직도를 알고 싶은 것이 아닙니다.

      ★★ **치과 화면에서 lab 은 언제나 null 입니다** (2026-08-24 확인).
        RLS 가 하청 기공소를 가립니다 — 그게 맞습니다, 어디에 맡겼는지는
        우리 사정입니다. 그러니 여기서 나오는 것은 늘 센터 이름이고,
        '기공소가 정해지면 기공소를 보여 준다' 는 앞의 주석은 틀렸습니다.
        지우지 않고 남겨 둡니다 — 나중에 RLS 가 열리면 그때는 정말로
        기공소가 나와야 합니다.
    */
    labName: row.lab?.name ?? row.design?.name ?? '',
    /*
      ★ 치식으로 정합니다. 사람에게 "앞니인가요" 를 또 묻지 않습니다 —
        의뢰서에 이미 적혀 있는 것을 되묻는 것은 일을 늘리는 것입니다.
    */
    anterior: isAnterior((row.order_items ?? []).map((i) => i.tooth_number)),
    photos: await signPhotos(
      supabase,
      files
        .filter((f) => f.kind !== 'design' && isPhoto(f.file_name) && f.upload_status === 'uploaded')
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    ),
  };
}

/**
 * 줄인 사진의 주소를 만듭니다.
 *
 * ★★ **섬네일 파일을 따로 안 만듭니다.** 저장소가 줄여서 내줍니다.
 *   원본은 손 하나 안 대고 그대로 남습니다 (domain/shade-photo).
 *
 * ★ 한 장이 실패해도 나머지는 보여 줍니다. 사진 한 장 때문에 화면이
 *   통째로 비면 "안 올라갔나" 하고 또 찍습니다.
 */
async function signPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { id: string; file_name: string; storage_path: string; created_at: string }[],
): Promise<ShadePhotoView[]> {
  return Promise.all(
    rows.map(async (f) => {
      const [thumb, view] = await Promise.all([
        supabase.storage
          .from('order-files')
          .createSignedUrl(f.storage_path, THUMB_TTL, { transform: thumbTransform('grid') }),
        supabase.storage
          .from('order-files')
          .createSignedUrl(f.storage_path, THUMB_TTL, { transform: thumbTransform('view') }),
      ]);

      return {
        id: f.id,
        fileName: f.file_name,
        createdAt: f.created_at,
        thumbUrl: thumb.data?.signedUrl ?? '',
        viewUrl: view.data?.signedUrl ?? '',
      };
    }),
  );
}
