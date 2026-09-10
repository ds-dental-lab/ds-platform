// =========================================================
// 놓을 위치: src/server/actions/exocad.ts
//
// "exocad 로 보내기" 버튼 뒤. (2026-09-09)
//
// ★ 버튼은 런처를 여는 **주소**만 받아 갑니다. 파일·환자 정보는 여기서
//   안 나갑니다 — 런처가 토큰으로 API 를 불러야 나옵니다.
// ★ 센터 사람만. 관리자·사용자를 안 가립니다 — 실제로 exocad 앞에 앉는
//   사람은 작업대의 사용자입니다 (기공의뢰서와 같은 결정 2026-08-15).
// ★ 주문을 볼 수 있는지는 RLS 가 답합니다. 못 보는 주문이면 0줄이 오고
//   여기서 끝납니다.
// ★ 보냈다는 줄을 남깁니다 (exocad_exports). 런처가 끝나면 그 줄에 결과를
//   적습니다. 안 적히면 "런처가 안 떴다" 는 뜻이라 사람이 알 수 있습니다.
// =========================================================

'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { exocadLaunchUrl } from '@/server/domain/exocad';
import { issueExocadToken } from '@/server/exocad/token';

export type ExocadLaunchResult = { ok: true; url: string } | { ok: false; error: string };

/*
  ★ 둘로 나눴습니다 (2026-09-10 — 첫 실전에서 런처가 안 떴음).
    브라우저(Chrome)는 denflow:// 같은 바깥 프로토콜을 **클릭 그 순간**에만
    엽니다. 서버에 토큰을 받으러 갔다 오면 그 순간이 지나 있어 조용히
    막힙니다 — 오류도 안 보여 줍니다. 그래서 주소는 **미리** 받아 두고
    (issue), 클릭에서는 그 주소로 바로 가고, 기록(record)은 그 뒤에 남깁니다.
*/

/** 주소만 만듭니다 — 기록은 안 남깁니다. 화면이 뜰 때 미리 부릅니다 */
export async function issueExocadLaunch(orderId: string): Promise<ExocadLaunchResult> {
  const session = await getSession();
  if (!session?.orgId || session.orgType !== 'design_center') {
    return { ok: false, error: '디자인센터만 보낼 수 있습니다' };
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!order) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const token = issueExocadToken(orderId);
  if (!token) return { ok: false, error: '서버에 열쇠가 없어 토큰을 못 만듭니다' };
  return { ok: true, url: exocadLaunchUrl(orderId, token) };
}

/** 눌렀다는 기록. 런처가 결과를 적을 줄이 됩니다 */
export async function recordExocadSend(orderId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session?.orgId || session.orgType !== 'design_center') return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from('exocad_exports').insert({
    order_id: orderId,
    requested_by: session.user.id,
  });
  return { ok: !error };
}

/** 예전 한 방 (미리 못 받았을 때의 마지막 길) */
export async function requestExocadLaunch(orderId: string): Promise<ExocadLaunchResult> {
  const issued = await issueExocadLaunch(orderId);
  if (!issued.ok) return issued;
  await recordExocadSend(orderId);
  return issued;
}
