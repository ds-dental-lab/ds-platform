// =========================================================
// 놓을 위치: src/server/actions/pulse.ts
//
// "뭔가 바뀌었나?" 만 묻는 아주 가벼운 질문. (사용자 요청 2026-08-13 —
//   "접수가 들어올때 새로고침 안해도 자동으로 떴으면 좋겠다",
//   "기공소도 제작대기가 갱신됬으면 해")
//
// ★ 목록을 다시 그리지 않고 **자국(stamp)만** 가져옵니다.
//   화면 전체를 15초마다 새로 그리면, 애써 줄여 놓은 왕복이 도로
//   늘어납니다 (주문목록은 한 번에 2000건을 읽습니다). 여기서는
//   '가장 최근에 바뀐 시각' 과 '몇 건인가' 두 개만 봅니다.
//   그 둘이 그대로면 화면도 그대로입니다 — 아무것도 안 합니다.
//
// ★ 누구의 주문인지는 RLS 가 정합니다.
//   치과는 자기 것, 디자인센터는 거래 치과 것, 기공소는 배정받은 것.
//   그래서 이 자국은 **보는 사람마다 다릅니다** — 남의 조직에 주문이
//   들어왔다고 내 화면이 깜빡이지 않습니다.
//
// ★ 건수도 함께 셉니다.
//   지워진 주문은 updated_at 이 밀리지만 목록에서 빠지므로, 가장 최근
//   자국이 오히려 과거로 되돌아갑니다. 문자열이 달라지기만 하면 되니
//   되돌아가도 잡히지만, 삭제·복구가 겹치면 같은 값으로 돌아올 수
//   있어 건수를 함께 봅니다.
// =========================================================

'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

/**
 * 지금 이 사람 화면이 바뀌어야 하는지를 한 줄로 요약합니다.
 * 값 자체에는 뜻이 없습니다 — **달라졌는가**만 봅니다.
 *
 * ★ 알림도 함께 봅니다 (2026-08-13).
 *   대화가 알림을 만들기 시작했는데, 알림은 orders 를 건드리지 않습니다.
 *   주문만 보고 있으면 새 글이 와도 종에 숫자가 안 붙습니다 —
 *   그 사람이 어디로든 옮겨 갈 때까지요. 그러면 알림을 만든 보람이
 *   없습니다. 종은 상단바(레이아웃)에 있고, refresh 는 레이아웃까지
 *   다시 그립니다.
 */
export async function sectorPulse(): Promise<string> {
  const session = await getSession();
  if (!session?.orgId) return '';

  const supabase = await createClient();

  const [latest, counted, unread] = await Promise.all([
    supabase
      .from('orders')
      .select('updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    // 안 읽은 알림 수 — 종에 붙는 바로 그 숫자입니다
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null),
  ]);

  const at = (latest.data as { updated_at: string }[] | null)?.[0]?.updated_at ?? '';

  return `${at}|${counted.count ?? 0}|${unread.count ?? 0}`;
}
