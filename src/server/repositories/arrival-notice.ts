// =========================================================
// 놓을 위치: src/server/repositories/arrival-notice.ts
//
// 아침 "오늘 도착 예정" 안내를 대기열에 쌓습니다. (사용자 요청 2026-09-07)
//
// ★ 사람이 아니라 **시계**가 부릅니다 (pg_cron → /api/jobs/arrival-notice).
//   로그인이 없으니 RLS 대신 서비스 열쇠로 전체 치과를 훑습니다 —
//   그래서 무엇을 읽는지가 여기 한 곳에만 있습니다.
// ★ 하루 한 번만. 시계가 두 번 울리거나 사람이 손으로 눌러도 같은 치과에
//   같은 날 두 통이 안 쌓입니다 (이미 있으면 건너뜀).
// =========================================================

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayInKst } from '@/server/domain/week';
import { composeArrivalNotice, groupByClinic, noticeDate, nameLine } from '@/server/domain/arrival-notice';
import { queueAlimtalkNotice } from '@/server/events/alimtalk';
import type { OrderStatus } from '@/server/domain/order-status';

export interface ArrivalNoticeRun {
  date: string;
  /** 문구를 쌓은 치과 수 */
  clinics: number;
  /** 오늘 이미 쌓여 있어 건너뛴 치과 수 */
  skipped: number;
}

export async function runArrivalNotices(now: Date = new Date()): Promise<ArrivalNoticeRun> {
  const admin = createAdminClient();
  const today = todayInKst(now);

  const { data } = await admin
    .from('orders')
    .select('clinic_org_id, patient_label, status')
    .is('deleted_at', null)
    .eq('due_date', today);

  const rows = ((data ?? []) as { clinic_org_id: string | null; patient_label: string; status: OrderStatus }[])
    .filter((r): r is { clinic_org_id: string; patient_label: string; status: OrderStatus } => Boolean(r.clinic_org_id))
    .map((r) => ({ clinicOrgId: r.clinic_org_id, patientLabel: r.patient_label, status: r.status }));

  const grouped = groupByClinic(rows);
  if (grouped.size === 0) return { date: today, clinics: 0, skipped: 0 };

  // 오늘 이미 쌓인 치과 — KST 자정 이후 만들어진 줄
  const dayStart = new Date(`${today}T00:00:00+09:00`).toISOString();
  const { data: done } = await admin
    .from('alimtalk_queue')
    .select('to_org_id')
    .eq('event', 'arrival_notice')
    .gte('created_at', dayStart);
  const already = new Set(((done ?? []) as { to_org_id: string | null }[]).map((d) => d.to_org_id));

  let clinics = 0;
  let skipped = 0;

  for (const [clinicOrgId, names] of grouped) {
    if (already.has(clinicOrgId)) {
      skipped += 1;
      continue;
    }
    const notice = composeArrivalNotice(today, names);
    if (!notice) continue;

    await queueAlimtalkNotice({
      event: 'arrival_notice',
      orgId: clinicOrgId,
      ...notice,
      // 템플릿은 '#{환자목록} 님' 이라 이름 줄에서 ' 님' 을 뺍니다
      vars: { 날짜: noticeDate(today), 환자목록: nameLine(names).replace(/ 님$/, '') },
    });
    clinics += 1;
  }

  return { date: today, clinics, skipped };
}
