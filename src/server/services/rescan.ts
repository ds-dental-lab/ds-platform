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
import { planResubmit } from '@/server/domain/rescan';

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

export type ResubmitScanResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

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

  // 표에 살아 있는 파일을 직접 봅니다 — 화면이 보낸 숫자·목록을 믿지 않습니다
  const { data: living, error: livingError } = await supabase
    .from('order_files')
    .select('id, kind, upload_status')
    .eq('order_id', input.orderId)
    .is('deleted_at', null);

  if (livingError || !living) {
    return { ok: false, error: '파일 목록을 읽지 못했습니다. 다시 눌러 주세요' };
  }

  const plan = planResubmit(
    living.map((f) => ({ id: f.id, kind: f.kind, uploaded: f.upload_status === 'uploaded' })),
    input.replaceFileIds,
    input.reuse,
  );

  if (!plan.ok) return { ok: false, error: plan.error };

  // 재사용을 안 골랐으면 이전 스캔을 치웁니다 (스캔만 — 사진·대화 첨부는 둡니다)
  if (plan.remove.length > 0) {
    const { error: removeError } = await supabase
      .from('order_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('order_id', input.orderId)
      .eq('kind', 'scan')
      .in('id', plan.remove);

    if (removeError) {
      return { ok: false, error: `이전 스캔을 치우지 못했습니다: ${removeError.message}` };
    }

    // ★ 권한에 막히면 오류 없이 0줄이 고쳐집니다. 남은 것을 다시 셉니다.
    //   안 세면 옛 스캔과 새 스캔이 섞인 채 접수로 돌아갑니다.
    const { count: left, error: leftError } = await supabase
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', input.orderId)
      .is('deleted_at', null)
      .in('id', plan.remove);

    if (leftError || left === null) {
      return { ok: false, error: '이전 스캔이 치워졌는지 확인하지 못했습니다. 다시 눌러 주세요' };
    }
    if (left > 0) {
      return { ok: false, error: `이전 스캔 ${left}개가 남아 있어 멈췄습니다. 다시 눌러 주세요` };
    }
  }

  // ★ 재스캔인 줄만 고치고, 고쳐진 줄을 돌려받습니다.
  //   두 번 눌렸거나 권한에 막히면 0줄입니다 — 그때 '됐다' 고 하지 않습니다.
  const { data: moved, error: statusError } = await supabase
    .from('orders')
    .update({ status: 'received' })
    .eq('id', input.orderId)
    .eq('status', 'rescan')
    .select('id');

  if (statusError) {
    return { ok: false, error: `상태를 바꾸지 못했습니다: ${statusError.message}` };
  }
  if (!moved || moved.length === 0) {
    return { ok: false, error: '상태가 바뀌지 않았습니다. 화면을 새로 고친 뒤 다시 확인해 주세요' };
  }

  const note =
    input.uploadedCount > 0
      ? `스캔 파일 ${input.uploadedCount}개 재등록`
      : '이전 스캔 데이터로 재등록';

  // 여기부터는 주문이 이미 접수로 돌아간 뒤입니다. 무르지 않고, 빠진 것을 알립니다.
  const missed: string[] = [];

  const { error: historyError } = await supabase.from('order_status_history').insert({
    order_id: input.orderId,
    from_status: 'rescan',
    to_status: 'received',
    actor_org_id: session.orgId,
    actor_user_id: session.user.id,
    reason: note,
  });
  if (historyError) missed.push('상태 기록');

  // 열려 있던 재스캔 이슈를 닫습니다
  const { error: issueError } = await supabase
    .from('order_issues')
    .update({ resolved_at: new Date().toISOString() })
    .eq('order_id', input.orderId)
    .eq('issue_type', 'rescan')
    .is('resolved_at', null);
  if (issueError) missed.push('재스캔 표시 지우기');

  // 시안대로 대화에도 한 줄 남깁니다 — 디자인센터가 목록에서 바로 봅니다
  const { error: messageError } = await supabase.from('order_messages').insert({
    order_id: input.orderId,
    author_org_id: session.orgId,
    author_user_id: session.user.id,
    author_name: session.orgName ?? '',
    author_sector: 'clinic',
    body: note,
  });
  if (messageError) missed.push('대화 한 줄');

  if (missed.length > 0) {
    console.error('[rescan] 접수로 돌렸지만 못 남긴 것', input.orderId, {
      history: historyError?.message,
      issue: issueError?.message,
      message: messageError?.message,
    });
  }

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

  return missed.length > 0
    ? { ok: true, warning: `접수로 돌아갔지만 ${missed.join('·')}을(를) 남기지 못했습니다` }
    : { ok: true };
}
