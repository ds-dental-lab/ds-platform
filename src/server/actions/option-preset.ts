// =========================================================
// 놓을 위치: src/server/actions/option-preset.ts
//
// 제작옵션 즐겨찾기 저장 · 이름변경 · 삭제.
// 실제 차단은 RLS 가 합니다 (option_preset_* 정책).
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';

export type PresetResult = { ok: true } | { ok: false; error: string };

/** 이름 규칙 — 빈 이름과 지나치게 긴 이름을 막습니다 */
function checkName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '이름을 입력해 주세요';
  if (trimmed.length > 20) return '이름은 20자까지입니다';
  return null;
}

export async function submitSaveOptionPreset(
  name: string,
  selections: Record<string, string>,
): Promise<PresetResult> {
  const session = await getSession();
  if (session?.orgType !== 'clinic' || !session.orgId) {
    return { ok: false, error: '치과 계정만 저장할 수 있습니다' };
  }

  const problem = checkName(name);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  const { error } = await supabase.from('clinic_option_presets').insert({
    clinic_org_id: session.orgId,
    name: name.trim(),
    selections,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '같은 이름이 이미 있습니다'
          : `저장하지 못했습니다: ${error.message}`,
    };
  }

  revalidatePath('/clinic/orders/new');
  return { ok: true };
}

/** 이름만 고칩니다. '원장1' 로 만들어 둔 것을 실제 이름으로 바꾸는 용도입니다 */
export async function submitRenameOptionPreset(
  id: string,
  name: string,
): Promise<PresetResult> {
  const problem = checkName(name);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clinic_option_presets')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? '같은 이름이 이미 있습니다'
          : `저장하지 못했습니다: ${error.message}`,
    };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: '고칠 수 있는 항목이 아닙니다' };
  }

  revalidatePath('/clinic/orders/new');
  return { ok: true };
}

/** 지금 고른 값으로 덮어씁니다 */
export async function submitUpdateOptionPreset(
  id: string,
  selections: Record<string, string>,
): Promise<PresetResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clinic_option_presets')
    .update({ selections, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (error) return { ok: false, error: `저장하지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '고칠 수 있는 항목이 아닙니다' };
  }

  revalidatePath('/clinic/orders/new');
  return { ok: true };
}

export async function submitDeleteOptionPreset(id: string): Promise<PresetResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clinic_option_presets')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) return { ok: false, error: `지우지 못했습니다: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: '지울 수 있는 항목이 아닙니다' };
  }

  revalidatePath('/clinic/orders/new');
  return { ok: true };
}
