// =========================================================
// 놓을 위치: src/server/audit.ts
//
// 개인정보를 열어 볼 때 기록을 남깁니다. (설계서 §3.5)
//
// ★ 데이터가 실제로 나가는 자리에서 부릅니다.
//   화면이 아니라 저장소(repository)에서 남깁니다 — 화면은 여러 개인데
//   데이터가 나가는 문은 하나이기 때문입니다. 화면마다 붙이면 언젠가
//   하나를 빠뜨리고, 빠뜨린 줄도 모릅니다.
//
// ★ 절대 던지지 않습니다.
//   기록을 못 남겼다고 주문 화면이 안 열리면 안 됩니다.
//   못 남기면 서버 로그에만 적고 넘어갑니다.
//
// ★ 이름을 담지 않습니다.
//   무엇을 봤는지는 id 로 가리킵니다. 로그에 환자 이름을 또 쌓으면
//   개인정보를 한 벌 더 만드는 셈입니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export type AuditAction = 'order.view' | 'order.list' | 'patient.search' | 'file.download';

export interface AuditEntry {
  action: AuditAction;
  /** 주문·파일 id. 검색처럼 대상이 없으면 비웁니다 */
  targetId?: string | null;
  /** 이번 열람에 실린 환자 수. 목록은 한 번에 여럿입니다 */
  subjectCount?: number;
  /** 짧은 맥락 (검색어 길이 등). 환자 이름은 넣지 않습니다 */
  detail?: string | null;
}

/**
 * 열람 한 건을 남깁니다.
 *
 * ★ 아무것도 안 나갔으면 안 남깁니다.
 *   목록을 열었는데 0건이면 개인정보가 나간 것이 없습니다.
 *   빈 조회까지 쌓으면 정작 봐야 할 줄이 묻힙니다.
 */
export async function recordAccess(entry: AuditEntry): Promise<void> {
  try {
    if (entry.subjectCount === 0) return;

    const session = await getSession();
    if (!session?.orgId) return;

    const supabase = await createClient();

    /*
      ★ 표에 바로 넣지 않고 함수를 부릅니다 (record_access).
        같은 사람이 같은 대상을 5분 안에 다시 열면 한 줄로 봅니다.

        서버 컴포넌트는 화면을 다시 그릴 때마다 다시 실행됩니다 —
        파일 저장(HMR), 링크 미리 읽기, 뒤로가기 모두요.
        그대로 두면 사람이 한 번 연 것이 기록에 백 번으로 남습니다.
        실제로 3분 만에 155줄이 쌓였고, 대상은 2건이었습니다.

        '읽고 나서 쓰면' 두 요청이 겹칠 때 둘 다 씁니다.
        한 문장으로 넣어야 그 틈이 없습니다.
    */
    await supabase.rpc('record_access', {
      p_actor_user_id: session.user.id,
      p_actor_org_id: session.orgId,
      p_action: entry.action,
      p_target_id: entry.targetId ?? null,
      p_subject_count: entry.subjectCount ?? 1,
      p_detail: entry.detail ?? null,
    });
  } catch (error) {
    // ★ 기록 실패가 화면을 막지 않습니다. 대신 서버 로그에는 남깁니다
    console.error('[audit] 열람 기록을 남기지 못했습니다', entry.action, error);
  }
}
