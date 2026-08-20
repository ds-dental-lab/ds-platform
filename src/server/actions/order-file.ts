// =========================================================
// 놓을 위치: src/server/actions/order-file.ts
//
// 올라온 파일 내려받기.
//
// ★ storage_path 를 화면에 내려보내지 않습니다.
//   경로를 알면 정책이 허술한 순간 바로 긁어갈 수 있습니다.
//   화면은 파일 id 만 들고, 서버가 확인한 뒤 짧게 사는 주소를 만들어 줍니다.
//
// ★ "볼 수 있는가" 를 여기서 다시 묻지 않습니다.
//   order_files 의 RLS 가 이미 그 주문을 볼 수 있는 사람에게만 행을 줍니다.
//   조건을 두 곳에 적으면 어긋날 때 구멍이 납니다. (설계서 §5.3 결정 2)
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { fileBlockedFor } from '@/server/domain/file-access';
import { recordAccess } from '@/server/audit';
import { changeOrderStatus } from '@/server/services/order-status';
import {
  canDeleteFile,
  type OrderStatus,
  type Sector,
} from '@/server/domain/order-status';

const BUCKET = 'order-files';

/** 주소가 살아 있는 시간. 눌러서 받는 데 넉넉하고, 흘러도 곧 죽습니다 */
const TTL_SECONDS = 60;

export type FileUrlResult =
  | { ok: true; url: string; fileName: string; /** 상태가 함께 넘어갔으면 true */ advanced?: boolean }
  | { ok: false; error: string };

export async function getOrderFileUrl(fileId: string): Promise<FileUrlResult> {
  const supabase = await createClient();

  const { data: file } = await supabase
    .from('order_files')
    .select('kind, storage_path, file_name, order:orders!inner(id, status, lab_org_id)')
    .eq('id', fileId)
    .is('deleted_at', null)
    .maybeSingle();

  const found = file as unknown as {
    kind: string;
    storage_path: string;
    file_name: string;
    order: { id: string; status: OrderStatus; lab_org_id: string | null };
  } | null;

  if (!found) return { ok: false, error: '파일을 찾을 수 없습니다' };

  /*
    ★★ **여기가 진짜 문입니다** (사용자 결정 2026-08-20 —
      "기공소는 쉐이드 파일만 봐야 하고 스캔 파일을 열어 봐서는 안 된다").

      목록에서 감추는 것만으로는 못 막습니다. 파일 id 만 있으면 이
      함수를 그대로 부를 수 있고, 그러면 서명 주소가 나갑니다.
      **주소를 만들기 전에** 막아야 실제로 막힙니다 (설계서 §8.5 —
      "화면에서 숨기는 것이 아니라 응답에 아예 담기지 않아야 한다").

    ★ 보는 사람의 **소속**으로 가릅니다. 주문의 역할로 가르면 자사
      제작에서 센터가 자기 주문의 스캔을 못 봅니다 — 통합 모델이라
      센터가 기공소 자리를 겸하기 때문입니다.
  */
  const viewer = await getSession();
  const blocked = fileBlockedFor(viewer?.orgType, {
    kind: found.kind,
    fileName: found.file_name,
  });

  if (blocked) {
    /*
      ★ 막힌 것도 기록에 남깁니다. '누가 무엇을 받았나' 만큼
        '누가 무엇을 받으려 했나' 도 알아야 합니다.
    */
    await recordAccess({ action: 'file.blocked', targetId: fileId });
    return { ok: false, error: blocked };
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(found.storage_path, TTL_SECONDS, { download: found.file_name });

  if (error || !data) {
    return { ok: false, error: `내려받지 못했습니다: ${error?.message ?? '알 수 없는 오류'}` };
  }

  /*
    ★ 파일 이름에 환자 이름이 들어 있는 일이 흔합니다
      ('2026-08-11-박나래-26.obj'). 내려받기는 개인정보가 조직 밖으로
      나가는 순간이라 반드시 남깁니다.
  */
  await recordAccess({ action: 'file.download', targetId: fileId });

  const advanced = await startProductionOnDownload(found);

  return { ok: true, url: data.signedUrl, fileName: found.file_name, advanced };
}

/**
 * 기공소가 디자인 파일을 받으면 그대로 '제작' 으로 넘어갑니다. (사용자 결정 2026-08-12)
 *
 * ★ 받았다는 사실이 곧 시작했다는 신호입니다.
 *   기공소에 '제작 시작' 버튼을 따로 두면 아무도 안 누릅니다 —
 *   파일을 받아 일을 시작하고는 화면을 닫습니다. 그러면 디자인센터와
 *   치과는 물건이 만들어지고 있는지 알 수 없습니다.
 *
 * ★ 스캔 파일은 해당 없습니다.
 *   기공소가 참고로 열어 보는 것뿐입니다. 만드는 근거는 디자인 파일입니다.
 *
 * ★ 못 넘어가도 내려받기는 성공입니다.
 *   수거가 안 끝난 리페어처럼 막히는 사정이 있습니다. 그때 파일까지
 *   못 받게 하면 일이 멈춥니다. 상태만 그대로 두고 조용히 지나갑니다.
 */
async function startProductionOnDownload(file: {
  kind: string;
  order: { id: string; status: OrderStatus; lab_org_id: string | null };
}): Promise<boolean> {
  if (file.kind !== 'design') return false;
  if (file.order.status !== 'production_wait') return false;

  const session = await getSession();
  // 내려받는 사람이 그 주문을 맡은 기공소일 때만입니다
  if (!session?.orgId || session.orgId !== file.order.lab_org_id) return false;

  const result = await changeOrderStatus(file.order.id, 'production');
  if (!result.ok) return false;

  revalidatePath(`/lab/orders/${file.order.id}`);
  revalidatePath('/lab/orders', 'layout');
  revalidatePath('/design/orders', 'layout');
  revalidatePath('/clinic/orders', 'layout');

  return true;
}

// ---------- 지우기 ----------

export type DeleteFileResult = { ok: true } | { ok: false; error: string };

/**
 * 올라온 파일을 지웁니다.
 *
 * ★ 저장소와 표를 함께 비웁니다.
 *   표만 지우면 저장소에 덩어리가 남아 아무도 모르게 쌓입니다.
 *   저장소만 지우면 목록에 이름이 남아 눌렀을 때 없는 파일을 찾습니다.
 *
 * ★ 저장소가 먼저입니다.
 *   표를 먼저 지우면 경로를 잃어 저장소를 못 치웁니다.
 *   반대로 저장소를 먼저 지우고 표가 실패하면, 그 줄은 'pending' 과 같은
 *   모양이 되어 화면이 '안 올라감' 으로 보여 줍니다 — 고칠 수 있는 상태입니다.
 */
export async function submitDeleteOrderFile(fileId: string): Promise<DeleteFileResult> {
  const session = await getSession();
  if (!session?.orgId) return { ok: false, error: '로그인이 필요합니다' };

  const supabase = await createClient();

  const { data: file } = await supabase
    .from('order_files')
    .select(
      'id, kind, storage_path, upload_status, ' +
        'order:orders!inner(id, status, clinic_org_id, design_org_id, lab_org_id)',
    )
    .eq('id', fileId)
    .maybeSingle();

  const found = file as unknown as {
    kind: string;
    storage_path: string;
    upload_status: string;
    order: {
      id: string;
      status: OrderStatus;
      clinic_org_id: string;
      design_org_id: string | null;
      lab_org_id: string | null;
    };
  } | null;

  // RLS 는 남의 주문 파일을 0행으로 막습니다
  if (!found) return { ok: false, error: '파일을 찾을 수 없습니다' };

  // 한 조직이 두 자리를 겸할 수 있습니다 (자사 제작)
  const roles: Sector[] = [];
  if (found.order.clinic_org_id === session.orgId) roles.push('clinic');
  if (found.order.design_org_id === session.orgId) roles.push('design_center');
  if (found.order.lab_org_id === session.orgId) roles.push('lab');

  if (!canDeleteFile(found.kind, found.order.status, roles)) {
    return { ok: false, error: '이 파일을 지울 수 없습니다' };
  }

  // 안 올라간 줄은 저장소에 덩어리가 없습니다
  if (found.upload_status === 'uploaded') {
    const { error } = await supabase.storage.from(BUCKET).remove([found.storage_path]);
    if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  }

  const { data, error } = await supabase
    .from('order_files')
    .delete()
    .eq('id', fileId)
    .select('id');

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: '지울 수 있는 파일이 아닙니다' };

  revalidatePath(`/clinic/orders/${found.order.id}`);
  revalidatePath(`/design/orders/${found.order.id}`);
  revalidatePath(`/lab/orders/${found.order.id}`);

  return { ok: true };
}
