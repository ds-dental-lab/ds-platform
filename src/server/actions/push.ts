// =========================================================
// 놓을 위치: src/server/actions/push.ts
//
// 웹푸시 구독을 넣고 뺍니다. 자기 브라우저 것만 — RLS(push_sub_own)가
// 마지막으로 막습니다.
// =========================================================

'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export type PushResult = { ok: true } | { ok: false; error: string };

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function savePushSubscription(
  input: PushSubscriptionInput,
): Promise<PushResult> {
  const session = await getSession();
  if (!session?.orgId) {
    return { ok: false, error: '소속 조직이 있어야 알림을 받을 수 있습니다' };
  }

  if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
    return { ok: false, error: '구독 정보가 온전하지 않습니다' };
  }

  const supabase = await createClient();

  /*
    ★ upsert 입니다. 같은 브라우저에서 껐다 켜면 endpoint 가 같을 수도,
      새로 발급될 수도 있습니다. 같으면 덮고, 다르면 새 줄이 됩니다 —
      옛 줄은 발송이 404 를 받는 순간 지워집니다 (events/push).
  */
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: session.user.id,
      org_id: session.orgId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      user_agent: null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) return { ok: false, error: `켜지 못했습니다: ${error.message}` };
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string): Promise<PushResult> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: '로그인이 필요합니다' };

  const supabase = await createClient();

  // RLS 가 내 것으로 좁힙니다 — 남의 endpoint 를 넣어도 0행입니다
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) return { ok: false, error: `끄지 못했습니다: ${error.message}` };
  return { ok: true };
}
