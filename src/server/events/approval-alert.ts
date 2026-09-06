// =========================================================
// 놓을 위치: src/server/events/approval-alert.ts
//
// 가입 신청·홈페이지 문의 → 센터 관리자에게 **푸시 + 메일**.
// (사용자 지적 2026-09-05 — "실제로 해보니까 알림이 오는 게 없어")
//
// ★ 종(인앱)은 여기서 안 넣습니다. 표 트리거가 넣습니다
//   (20260905100000_approval_alerts.sql) — 화면이 죽어도 종은 남게.
//   여기는 Node 가 있어야 하는 둘(웹푸시·메일)만 합니다.
//
// ★ 실패해도 본래 일을 되돌리지 않습니다 (events 공통 원칙).
//   가입은 이미 됐고 문의는 이미 남았습니다. 알림이 안 갔다고 그걸
//   지우지 않습니다. 이유만 로그에 남깁니다.
//
// ★★ 가입 알림은 **한 번만**입니다. 화면이 부르는 액션은 누구나 부를
//   수 있어서, notified_at 표시 없이는 같은 신청으로 센터 폰을 계속
//   울릴 수 있습니다. 표시를 먼저 찍고(원자적 update) 그다음 보냅니다.
// =========================================================

import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToOrgs } from '@/server/events/push';
import { sendMail } from '@/server/mail/send';
import { getDesignCenterTargets } from '@/server/repositories/approval-alert';
import { SITE_URL } from '@/server/domain/site';
import {
  signupPush,
  signupMail,
  contactPush,
  contactMail,
  type SignupAlertInput,
  type ContactAlertInput,
} from '@/server/domain/approval-alert';
import type { PushPayload } from '@/server/domain/push';
import type { MailDraft } from '@/server/domain/approval-alert';

async function deliver(push: PushPayload, mail: MailDraft): Promise<void> {
  const targets = await getDesignCenterTargets();
  if (!targets) return;

  await sendPushToOrgs(new Map([[targets.orgId, push]]));

  // ★ 관리자마다 한 통. 한 통에 여럿을 적으면 서로의 주소가 보입니다
  await Promise.all(
    targets.emails.map(async (to) => {
      const result = await sendMail({ to, subject: mail.subject, html: mail.html });
      if (!result.ok) console.error('[events] 승인 알림 메일 실패', to, result.reason);
    }),
  );
}

/**
 * 가입 신청이 들어왔습니다.
 *
 * @param userId 방금 가입한 사람. 그 사람의 **아직 안 알린 pending 신청**이
 *   있을 때만 보냅니다 — 없으면 아무것도 안 합니다.
 */
export async function publishSignupRequested(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    /*
      ★ 표시를 먼저 찍습니다. 같은 요청이 동시에 둘 들어와도 update 는
        한 줄만 잡습니다 — 잡은 쪽만 보냅니다.
    */
    const { data } = await admin
      .from('signup_requests')
      .update({ notified_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .is('notified_at', null)
      .select('org_name, org_type')
      .maybeSingle();

    const request = data as { org_name: string | null; org_type: string } | null;
    if (!request) return;

    const input: SignupAlertInput = { orgName: request.org_name ?? '', orgType: request.org_type };
    await deliver(signupPush(input), signupMail(input, SITE_URL));
  } catch (error) {
    console.error('[events] 가입 신청 알림 실패', error);
  }
}

/** 홈페이지 수가표 문의가 들어왔습니다. 문의 액션이 저장한 뒤에 부릅니다 */
export async function publishContactRequested(input: ContactAlertInput): Promise<void> {
  try {
    await deliver(contactPush(input), contactMail(input, SITE_URL));
  } catch (error) {
    console.error('[events] 문의 알림 실패', error);
  }
}
