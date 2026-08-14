// =========================================================
// 놓을 위치: src/server/repositories/remake-reason.ts
//
// 리메이크 사유를 읽고 씁니다. (사용자 요청 2026-08-14)
//
// ★ 문지기는 DB 입니다. 여기서 권한을 다시 따지지 않습니다 —
//   remake_reasons 의 정책이 '디자인센터의 자기 주문' 만 열어 둡니다.
//   화면에서 한 번 더 막는 것은 **말을 걸어 주기 위한 것**이지
//   그것이 자물쇠는 아닙니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { normalizeSelection, type ReasonSelection } from '@/server/domain/remake-reason';

export interface StoredReason {
  code: string;
  note: string | null;
}

/** 이 주문에 적힌 사유들 */
export async function getOrderReasons(orderId: string): Promise<StoredReason[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('remake_reasons')
    .select('code, note')
    .eq('order_id', orderId);

  return (data ?? []) as StoredReason[];
}

/**
 * 고른 것 전체로 바꿉니다.
 *
 * ★ **지우고 다시 넣습니다.** 무엇이 빠지고 무엇이 늘었는지 셈하지
 *   않습니다. 화면이 늘 '지금 고른 것 전부' 를 보내므로, 셈해 봐야
 *   같은 결과에 길만 둘로 늘어납니다.
 *
 * ★ 하나도 안 고르면 **다 지웁니다.** 그것이 '사유를 뺀다' 는 뜻입니다.
 *   선택 사항이라 뺄 수 있어야 합니다.
 *
 * ★ 지우기가 실패하면 넣지 않습니다. 반만 되면 옛 사유와 새 사유가
 *   섞인 채로 남는데, 그건 어느 쪽도 아닌 상태입니다.
 */
export async function replaceOrderReasons(
  orderId: string,
  codes: string[],
  note: string | null,
): Promise<{ ok: true; saved: ReasonSelection } | { ok: false; error: string }> {
  const selection = normalizeSelection(codes, note);
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from('remake_reasons')
    .delete()
    .eq('order_id', orderId);

  if (clearError) return { ok: false, error: '사유를 지우지 못했습니다.' };

  if (selection.codes.length === 0) return { ok: true, saved: selection };

  const { error: insertError } = await supabase.from('remake_reasons').insert(
    selection.codes.map((code) => ({
      order_id: orderId,
      code,
      // 글은 기타 줄에만 답니다
      note: code === 'ET-01' ? selection.note : null,
    })),
  );

  if (insertError) return { ok: false, error: '사유를 저장하지 못했습니다.' };

  return { ok: true, saved: selection };
}

/**
 * 기간 안의 사유들. 통계가 씁니다.
 *
 * ★ **주문의 접수일**이 아니라 사유를 적은 날로 자릅니다.
 *   사유는 나중에 적기도 하고 고치기도 합니다. 접수일로 자르면
 *   지난달 건에 오늘 사유를 달았을 때 이번달 표에서 사라집니다 —
 *   적어 놓고 안 보이면 아무도 다시 안 적습니다.
 */
export async function getReasonRows(
  from: string,
  to: string,
): Promise<{ orderId: string; code: string }[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('remake_reasons')
    .select('order_id, code, created_at')
    .gte('created_at', from)
    .lt('created_at', to);

  return (data ?? []).map((row) => ({
    orderId: row.order_id as string,
    code: row.code as string,
  }));
}
