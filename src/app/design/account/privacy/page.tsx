// =========================================================
// 놓을 위치: src/app/design/account/privacy/page.tsx
//
// 처리방침 설정 (디자인센터 관리자 전용).
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { createClient } from '@/lib/supabase/server';
import { getPolicyFacts } from '@/server/repositories/privacy';
import { listSeatOptions } from '@/server/repositories/member';
import PrivacyBoard from '@/components/account/PrivacyBoard';

export const dynamic = 'force-dynamic';

export default async function PrivacySettingsPage() {
  const session = await requireManagerSector('design_center');

  const supabase = await createClient();

  const [facts, seats, orgRes] = await Promise.all([
    getPolicyFacts(),
    listSeatOptions(),
    supabase
      .from('organizations')
      .select('privacy_officer_user_id')
      .eq('id', session.orgId as string)
      .maybeSingle(),
  ]);

  const officerUserId =
    (orgRes.data as { privacy_officer_user_id: string | null } | null)?.privacy_officer_user_id ??
    null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-1">
      <header>
        <h1 className="text-[19px] font-extrabold tracking-[-0.03em] text-[#1A2130]">
          개인정보 처리방침
        </h1>
        <p className="mt-1 text-[13px] text-[#7C8595]">
          공개 화면(/privacy)에 나갈 값을 정합니다. 숫자와 상호는 다른 화면에서 읽어 옵니다.
        </p>
      </header>

      <PrivacyBoard facts={facts} officerUserId={officerUserId} seats={seats} />
    </div>
  );
}
