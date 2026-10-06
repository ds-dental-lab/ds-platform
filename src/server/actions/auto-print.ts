// =========================================================
// 놓을 위치: src/server/actions/auto-print.ts
//
// 자동 템포러리 — 치과가 누르는 것 (사용자 요청 2026-10-06).
//
// ★ 지금은 한 가지뿐입니다 — **「출력판을 비웠습니다」**.
//   치과에는 기공사가 없습니다. 전 출력물이 남아 있으면 그 위에 뽑습니다.
//   기계는 베드가 비었는지 모릅니다. 사람이 한 번 봐 주는 자리입니다.
//
// ★ 누를 수 있는 사람은 **그 치과**뿐입니다. 디자인센터가 대신 눌러 주지
//   않습니다 — 눌러 주는 순간 아무도 베드를 안 봅니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { clearBed, jobOfOrder } from '@/server/repositories/auto-print';
import { autoProgress, autoNotice, type AutoJob } from '@/server/domain/auto-print';
import { autoPrintLaunchUrl } from '@/server/domain/exocad';
import { issueExocadToken } from '@/server/exocad/token';

export type ClearBedResult = { ok: true } | { ok: false; error: string };

export async function submitClearBed(orderId: string): Promise<ClearBedResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다' };
  if (session.orgType !== 'clinic') {
    return { ok: false, error: '출력판은 치과에서 확인해 주셔야 합니다' };
  }

  // 자기 주문인지 — RLS 가 한 번 더 봅니다
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('id').eq('id', orderId).maybeSingle();
  if (!data) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const result = await clearBed(orderId, session.user.id);
  if (result.ok) {
    revalidatePath(`/clinic/orders/${orderId}`);
    revalidatePath(`/design/orders/${orderId}`);
  }
  return result;
}

export interface AutoView {
  job: AutoJob;
  steps: ReturnType<typeof autoProgress>;
  notice: string;
  /** 치과가 지금 눌러야 하는가 */
  needsBed: boolean;
}

/** 주문 화면이 쓸 모양. 자동 진행 중이 아니면 null */
export async function getAutoView(orderId: string): Promise<AutoView | null> {
  const job = await jobOfOrder(orderId);
  if (!job) return null;

  return {
    job,
    steps: autoProgress(job),
    notice: autoNotice(job),
    needsBed: job.step === 'queued' && job.bedClearedAt === null,
  };
}

// ---------------------------------------------------------------- 보내기 버튼

export type LaunchResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * 기공소 PC 를 여는 주소를 만듭니다.
 *
 * ★ **주소를 미리 받아 둡니다.** 크롬은 denflow:// 같은 바깥 프로토콜을
 *   **클릭 그 순간**에만 엽니다. 눌러 놓고 서버에 토큰을 받으러 갔다 오면
 *   그 순간이 지나 조용히 막힙니다 — 오류도 안 보여 줍니다.
 *   exocad 보내기가 첫 실전에서 그렇게 안 떴습니다 (2026-09-10).
 * ★ 센터 사람만. 실제로 덴트버드 앞에 앉는 사람입니다.
 */
export async function issueAutoPrintLaunch(orderId: string): Promise<LaunchResult> {
  const session = await getSession();
  if (!session?.orgId || session.orgType !== 'design_center') {
    return { ok: false, error: '디자인센터만 보낼 수 있습니다' };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return { ok: false, error: '주문을 찾을 수 없습니다' };

  const token = issueExocadToken(orderId);
  if (!token) return { ok: false, error: '서버에 열쇠가 없어 토큰을 못 만듭니다' };

  return { ok: true, url: autoPrintLaunchUrl(orderId, token) };
}
