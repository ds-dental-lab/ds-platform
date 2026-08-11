// =========================================================
// 놓을 위치: src/server/services/rescan.ts
//
// 스캔 파일 재등록. (시안 #rsDlg, 설계서 §2.1 C-4)
//
// 재스캔은 디자인센터가 "스캔이 이상하니 다시 올려 달라" 고 부른 상태입니다.
// 치과가 파일을 다시 넣으면 접수로 돌아가 디자인센터가 다시 봅니다.
//
// ★ 파일 등록과 상태 복귀를 한 동작으로 묶습니다.
//   따로 두면 파일 없이 '재업로드 완료' 만 눌러 넘길 수 있습니다.
//   그러면 디자인센터는 다시 열어 보고 또 재스캔을 겁니다.
//
// ★ 이전 스캔을 그대로 쓸 수도 있습니다 (시안 '이전 스캔 데이터 그대로 사용').
//   파일이 아니라 각도·정합이 문제였던 경우, 같은 파일로 다시 봐 달라고
//   할 때가 있습니다. 둘 다 비면 막습니다 — 볼 것이 없는 주문이 됩니다.
//
// ★ 새로 올리면서 재사용을 안 골랐으면 이전 스캔은 치웁니다.
//   섞여 있으면 디자인센터가 어느 것이 최신인지 알 수 없습니다.
//   지우지 않고 deleted_at 만 채워 되찾을 수 있게 둡니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { type OrderStatus } from '@/server/domain/order-status';
import { publishOrderStatusChanged } from '@/server/events';

export interface ResubmitScanInput {
  orderId: string;
  /** 이전 스캔을 그대로 쓸 것인가 */
  reuse: boolean;
  /**
   * 치울 이전 스캔 파일. 재사용을 안 골랐을 때 화면이 보내 줍니다.
   * 새로 올린 파일은 여기 들어 있지 않아 살아남습니다.
   */
  replaceFileIds: string[];
  /** 새로 올린 파일 수. 안내 문구를 만드는 데만 씁니다 */
  uploadedCount: number;
}

export type ResubmitScanResult = { ok: true } | { ok: false; error: string };

export async function resubmitScan(input: ResubmitScanInput): Promise<ResubmitScanResult> {
  const session = await getSession();
  if (!session?.orgId || session.orgType !== 'clinic') {
    return { ok: false, error: '치과 계정만 스캔을 다시 올릴 수 있습니다' };
  }

  if (!input.reuse && input.uploadedCount === 0) {
    return {
      ok: false,
      error: '이전 스캔을 사용하거나 새 파일을 올려주세요',
    };
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', input.orderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!order) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const status = order.status as OrderStatus;

  // ★ 화면이 막아도 여기서 다시 봅니다 (설계서 §5.3 결정 2)
  if (status !== 'rescan') {
    return { ok: false, error: '재스캔 상태에서만 다시 올릴 수 있습니다' };
  }

  // 재사용을 안 골랐으면 이전 스캔을 치웁니다
  if (!input.reuse && input.replaceFileIds.length > 0) {
    await supabase
      .from('order_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('order_id', input.orderId)
      .in('id', input.replaceFileIds);
  }

  // 재사용만 골랐는데 남은 스캔이 하나도 없으면 헛걸음입니다
  if (input.reuse && input.uploadedCount === 0) {
    const { count } = await supabase
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', input.orderId)
      .is('deleted_at', null)
      .neq('kind', 'design');

    if (!count) {
      return { ok: false, error: '다시 쓸 이전 스캔이 없습니다. 새로 올려 주세요' };
    }
  }

  const { error: statusError } = await supabase
    .from('orders')
    .update({ status: 'received' })
    .eq('id', input.orderId);

  if (statusError) {
    return { ok: false, error: `상태를 바꾸지 못했습니다: ${statusError.message}` };
  }

  const note =
    input.uploadedCount > 0
      ? `스캔 파일 ${input.uploadedCount}개 재등록`
      : '이전 스캔 데이터로 재등록';

  await supabase.from('order_status_history').insert({
    order_id: input.orderId,
    from_status: 'rescan',
    to_status: 'received',
    actor_org_id: session.orgId,
    actor_user_id: session.user.id,
    reason: note,
  });

  // 열려 있던 재스캔 이슈를 닫습니다
  await supabase
    .from('order_issues')
    .update({ resolved_at: new Date().toISOString() })
    .eq('order_id', input.orderId)
    .eq('issue_type', 'rescan')
    .is('resolved_at', null);

  // 시안대로 대화에도 한 줄 남깁니다 — 디자인센터가 목록에서 바로 봅니다
  await supabase.from('order_messages').insert({
    order_id: input.orderId,
    author_org_id: session.orgId,
    author_user_id: session.user.id,
    author_name: session.orgName ?? '',
    author_sector: 'clinic',
    body: note,
  });

  // 접수로 돌아왔으니 디자인센터에 알립니다 (설계서 Q-7 ①)
  await publishOrderStatusChanged({
    orderId: input.orderId,
    from: 'rescan',
    to: 'received',
    actorSector: 'clinic',
    actorOrgId: session.orgId,
    actorUserId: session.user.id,
    reason: note,
  });

  return { ok: true };
}
