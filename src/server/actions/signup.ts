// =========================================================
// 놓을 위치: src/server/actions/signup.ts
//
// 가입 신청 승인·반려. (사용자 결정 2026-08-12)
//
// ★ 실제 일은 DB 함수가 합니다 (approve_signup · reject_signup).
//   조직을 만들고 거래관계를 잇고 자리를 붙이는 세 가지가 **한 트랜잭션**
//   이어야 합니다. 여기서 세 번 나눠 부르면, 가운데서 끊겼을 때
//   조직만 덩그러니 남고 아무도 못 들어가는 상태가 됩니다.
//
// ★ 그래서 여기서는 자격만 한 번 더 보고 넘깁니다.
//   DB 함수도 같은 것을 다시 봅니다 — 화면을 거치지 않고 부를 수 있으니까요.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { seedClinicPrices } from '@/server/repositories/clinic-price-seed';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { canReview, checkRejectReason } from '@/server/domain/signup';
import { canManageMembers, type MemberRole } from '@/server/domain/member';
import { queueAlimtalkToPhone } from '@/server/events/alimtalk';

export type ReviewResult = { ok: true } | { ok: false; error: string };

async function guard(): Promise<string | null> {
  const session = await getSession();

  const allowed = canReview({
    orgType: session?.orgType ?? null,
    isManager: canManageMembers(session?.role as MemberRole | null),
  });

  return allowed ? null : '디자인센터 관리자만 처리할 수 있습니다';
}

export async function submitApproveSignup(requestId: string): Promise<ReviewResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_signup', { p_request_id: requestId });

  if (error) return { ok: false, error: clean(error.message) };

  /*
    ★ 승인됐다고 신청자에게 알림톡 (사용자 요청 2026-09-08). 승인은 DB 함수가
      끝냈고 이건 곁다리라, 여기서 실패해도 승인은 그대로입니다.
  */
  const { data: approved } = await supabase
    .from('signup_requests')
    .select('org_name, tel, org_id, org_type')
    .eq('id', requestId)
    .maybeSingle();
  const who = approved as {
    org_name: string | null;
    tel: string | null;
    org_id: string | null;
    org_type: string | null;
  } | null;

  /*
    ★★ 새 치과에 **수가표 기본값**을 단가로 깔아 둡니다 (사용자 지적 2026-10-07).
      전에는 수가표가 상담용 종이일 뿐이어서, 센터가 48,000 을 적어 보내도
      가입하면 제품표의 50,000 으로 주문이 들어갔습니다 — 종이와 청구서가
      달랐습니다.
    ★ 곁다리라 실패해도 승인은 그대로입니다. 단가는 거래처 화면에서 고칠 수
      있고, 승인이 막히는 쪽이 훨씬 나쁩니다.
  */
  if (who?.org_id && who.org_type === 'clinic') {
    const session = await getSession();
    if (session?.orgId) {
      try {
        await seedClinicPrices(who.org_id, session.orgId);
      } catch {
        /* 단가를 못 깔아도 승인은 끝났습니다 */
      }
    }
  }
  if (who) {
    await queueAlimtalkToPhone({
      event: 'signup_approved',
      phone: who.tel,
      title: '[DenFlow] 가입 승인',
      vars: { 상호: who.org_name ?? '' },
      body:
        `${who.org_name ?? ''} 님, 덴플로우 가입이 승인되었습니다.\n` +
        '이제 로그인하면 주문을 넣을 수 있습니다. https://denflow.kr/login',
    });
  }

  revalidatePath('/design/signups');
  // 거래처가 하나 늘었습니다 — 사용자탭과 주문등록의 치과 목록이 바뀝니다
  revalidatePath('/design/users');
  revalidatePath('/design', 'layout');

  return { ok: true };
}

export async function submitRejectSignup(
  requestId: string,
  reason: string,
): Promise<ReviewResult> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };

  const verdict = checkRejectReason(reason);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_signup', {
    p_request_id: requestId,
    p_reason: reason.trim(),
  });

  if (error) return { ok: false, error: clean(error.message) };

  revalidatePath('/design/signups');

  return { ok: true };
}

/**
 * ★ DB 가 뱉는 앞머리를 떼어 냅니다.
 *   'P0001: 이미 처리됐거나...' 처럼 코드가 붙어 오면 화면에 그대로
 *   찍힙니다. 사람에게 보일 말은 우리가 함수 안에 한글로 적어 뒀습니다.
 */
function clean(message: string): string {
  return message.replace(/^[A-Z0-9]{5}:\s*/, '') || '처리하지 못했습니다';
}
