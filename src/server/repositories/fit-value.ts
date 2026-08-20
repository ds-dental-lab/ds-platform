// =========================================================
// 놓을 위치: src/server/repositories/fit-value.ts
//
// 치과별 내면값 읽기. 디자인센터 화면 둘이 씁니다 —
//   관리탭(/design/fit-values)  치과 전부를 한 표로
//   주문상세 카드                그 주문의 치과 하나 (값 + 비고 + 바뀐 날)
//
// ★ 제 것만 돌아옵니다 (RLS fit_select — 디자인센터 전원).
//   치과·기공소가 부르면 0줄입니다. 화면이 아니라 표가 막습니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import type { FitValues } from '@/server/domain/fit-value';

interface RawFitRow {
  clinic_org_id: string;
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
  updated_at: string;
}

const FIT_COLUMNS =
  'clinic_org_id, natural_tooth, cnc, inlay, pla, pmma, ' +
  'contact_adj, contact_single, hook, implant_note, note, updated_at';

// numeric 칸은 드라이버에 따라 글자로 옵니다. 수로 못 박아 둡니다
function num(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function toValues(raw: RawFitRow): FitValues {
  return {
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
  };
}

// ---------- 관리탭 ----------

export interface FitBoardRow {
  clinicOrgId: string;
  clinicName: string;
  /** 거래중인가. 끊긴 치과도 표에는 남습니다 — 값은 남아 있어야 합니다 */
  isActive: boolean;
  /** 아직 안 적었으면 null */
  values: FitValues | null;
  updatedAt: string | null;
}

/**
 * 치과 전부와 내면값을 한 표로.
 *
 * ★ 치과만입니다. 내면값은 치과 취향이지 기공소 것이 아닙니다.
 * ★ 값이 없는 치과도 줄이 섭니다 — '미등록' 이 보여야 채웁니다.
 */
export async function listFitBoard(): Promise<FitBoardRow[]> {
  const session = await getSession();
  if (session?.orgType !== 'design_center' || !session.orgId) return [];

  const supabase = await createClient();

  const [clinics, fits] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, status')
      .eq('org_type', 'clinic')
      .is('deleted_at', null)
      .neq('id', session.orgId)
      .order('name'),
    supabase.from('clinic_fit_values').select(FIT_COLUMNS),
  ]);

  if (clinics.error || !clinics.data) return [];

  const byClinic = new Map(
    ((fits.data ?? []) as unknown as RawFitRow[]).map((raw) => [raw.clinic_org_id, raw]),
  );

  return (clinics.data as { id: string; name: string; status: string }[]).map((org) => {
    const raw = byClinic.get(org.id);

    return {
      clinicOrgId: org.id,
      clinicName: org.name,
      isActive: org.status === 'active',
      values: raw ? toValues(raw) : null,
      updatedAt: raw?.updated_at ?? null,
    };
  });
}

// ---------- 주문상세 카드 ----------

export interface FitCard {
  values: FitValues | null;
  /**
   * 마지막으로 바뀐 때. 치과명에 점을 찍고 카드에 띠를 띄우는 기준입니다.
   *
   * ★ **무엇이 바뀌었는지는 안 싣습니다** (사용자 요청 2026-08-19).
   *   카드에 변경 목록을 늘어놓았더니, 정작 지금 값이 무엇인지가
   *   뒤로 밀렸습니다. 디자이너가 볼 것은 '지금 이 치과는 얼마인가'
   *   이고, 바뀌었다는 사실은 **날짜 한 줄**이면 충분합니다.
   *   이력 자체는 fit_value_changes 에 그대로 쌓입니다 — 누가 언제
   *   무엇을 바꿨는지는 남아야 합니다. 화면에서만 뺐습니다.
   */
  lastChangedAt: string | null;
}

/** 치과 하나의 내면값. 디자인센터가 아니면 빈 카드 */
export async function getFitCard(clinicOrgId: string): Promise<FitCard> {
  const supabase = await createClient();

  const [fit, lastChange] = await Promise.all([
    supabase
      .from('clinic_fit_values')
      .select(FIT_COLUMNS)
      .eq('clinic_org_id', clinicOrgId)
      .maybeSingle(),
    /*
      ★ 마지막 한 줄만 봅니다.
        전에는 다섯 줄을 읽고 바꾼 사람 이름까지 따로 물어봤습니다
        (왕복 셋). 화면이 날짜만 쓰므로 이제 하나면 됩니다.
    */
    supabase
      .from('fit_value_changes')
      .select('created_at')
      .eq('clinic_org_id', clinicOrgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    values: fit.data ? toValues(fit.data as unknown as RawFitRow) : null,
    lastChangedAt: (lastChange.data as { created_at: string } | null)?.created_at ?? null,
  };
}
