// =========================================================
// 놓을 위치: src/server/actions/fit-value.ts
//
// 내면값 저장. 디자인센터 **관리자만** 합니다 (사용자 요청 2026-08-17 —
//   "디자인 관리자는 그 해당값을 수시로 컨트롤 할수 있어야해").
//
// ★ 저장하면서 **변경 이력을 같은 자리에서** 남깁니다.
//   "값이 바뀌면 웹페이지에서 알려야" 하는데, 그 알림의 재료가 이
//   이력입니다. 저장 따로 이력 따로면 언젠가 이력 없는 저장이 생기고,
//   그 변경은 아무도 모른 채 지나갑니다.
//   무엇이 바뀌었는지는 domain/fit-value 의 diffFitValues 가 셉니다.
//
// ★ 바뀐 것이 없으면 이력을 안 남깁니다.
//   열어 보고 그대로 저장을 눌러도 '변경됨' 점이 붙으면, 점이 곧
//   아무 뜻도 없어집니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { canSeeMoney, type MemberRole } from '@/server/domain/member';
import {
  checkFitValues,
  diffFitValues,
  type FitValues,
} from '@/server/domain/fit-value';

export type FitValueResult = { ok: true } | { ok: false; error: string };

interface RawFitRow {
  natural_tooth: number | string | null;
  cnc: number | string | null;
  inlay: number | string | null;
  pla: number | string | null;
  pmma: number | string | null;
  contact_adj: number | string | null;
  contact_single: number | string | null;
  hook: boolean;
  implant_note: string | null;
  note: string | null;
}

function num(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

/** 빈 글은 null 로 — '' 를 넣어 두면 '값이 있다' 로 보입니다 */
function orNull(value: string | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export async function submitSaveFitValues(
  clinicOrgId: string,
  input: FitValues,
): Promise<FitValueResult> {
  const session = await getSession();

  // 관리자 판정은 세션과 RLS(fit_write) 가 이중으로 봅니다
  if (
    session?.orgType !== 'design_center' ||
    !session.orgId ||
    !canSeeMoney(session.role as MemberRole | null)
  ) {
    return { ok: false, error: '디자인센터 관리자만 내면값을 고칠 수 있습니다' };
  }

  const problem = checkFitValues(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  // ★ 이전 값을 먼저 읽습니다 — 이력은 '무엇에서 무엇으로' 입니다
  const { data: before } = await supabase
    .from('clinic_fit_values')
    .select(
      'natural_tooth, cnc, inlay, pla, pmma, contact_adj, contact_single, ' +
        'hook, implant_note, note',
    )
    .eq('clinic_org_id', clinicOrgId)
    .maybeSingle();

  const raw = before as RawFitRow | null;

  const cleaned: FitValues = {
    ...input,
    implantNote: orNull(input.implantNote),
    note: orNull(input.note),
  };

  const changes = diffFitValues(
    raw
      ? {
          naturalTooth: num(raw.natural_tooth),
          cnc: num(raw.cnc),
          inlay: num(raw.inlay),
          pla: num(raw.pla),
          pmma: num(raw.pmma),
          contactAdj: num(raw.contact_adj),
          contactSingle: num(raw.contact_single),
          hook: raw.hook,
          implantNote: raw.implant_note,
          note: raw.note,
        }
      : null,
    cleaned,
  );

  // 바뀐 것이 없으면 아무것도 안 씁니다 — updated_at 도 그대로여야 합니다
  if (changes.length === 0) return { ok: true };

  const { data: saved, error } = await supabase
    .from('clinic_fit_values')
    .upsert(
      {
        clinic_org_id: clinicOrgId,
        natural_tooth: cleaned.naturalTooth,
        cnc: cleaned.cnc,
        inlay: cleaned.inlay,
        pla: cleaned.pla,
        pmma: cleaned.pmma,
        contact_adj: cleaned.contactAdj,
        contact_single: cleaned.contactSingle,
        hook: cleaned.hook,
        implant_note: cleaned.implantNote,
        note: cleaned.note,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clinic_org_id' },
    )
    .select('clinic_org_id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };

  // RLS 는 오류가 아니라 0행으로 막습니다
  if (!saved || saved.length === 0) {
    return { ok: false, error: '이 치과의 내면값을 고칠 권한이 없습니다' };
  }

  /*
    ★ 이력이 안 남으면 저장도 실패로 칩니다.
      값만 바뀌고 이력이 없으면, 디자이너 화면의 '최근 변경' 이
      조용히 거짓말을 합니다 — 알리는 것이 이 기능의 절반입니다.
  */
  const { error: logError } = await supabase.from('fit_value_changes').insert({
    clinic_org_id: clinicOrgId,
    changes,
    created_by: session.user.id,
  });

  if (logError) {
    return { ok: false, error: `변경 이력을 남기지 못했습니다: ${logError.message}` };
  }

  revalidatePath('/design/fit-values');
  // 디자이너의 주문상세 카드가 새 값을 보게
  revalidatePath('/design/orders', 'layout');

  return { ok: true };
}
