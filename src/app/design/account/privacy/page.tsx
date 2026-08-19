// =========================================================
// 놓을 위치: src/app/design/account/privacy/page.tsx
//
// 공개 문서 설정 — 처리방침과 이용약관 (디자인센터 관리자 전용).
//
// ★ 두 문서를 한 화면에 둡니다 (2026-08-19).
//   정할 것이 같은 종류입니다 — "무엇을 공개하고, 언제부터 시행하는가".
//   화면을 나누면 한쪽만 시행일이 들어간 채로 잊힙니다.
//   다만 **시행일은 따로** 받습니다. 검토가 끝나는 시점이 다릅니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { createClient } from '@/lib/supabase/server';
import { getPolicyFacts } from '@/server/repositories/privacy';
import { getTermsFacts } from '@/server/repositories/terms';
import { listSeatOptions } from '@/server/repositories/member';
import PrivacyBoard from '@/components/account/PrivacyBoard';
import TermsBoard from '@/components/account/TermsBoard';

export const dynamic = 'force-dynamic';

export default async function PrivacySettingsPage() {
  const session = await requireManagerSector('design_center');

  const supabase = await createClient();

  const [facts, termsFacts, seats, orgRes] = await Promise.all([
    getPolicyFacts(),
    getTermsFacts(),
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
          공개 문서
        </h1>
        <p className="mt-1 text-[14px] text-[#7C8595]">
          공개 화면(/privacy, /terms)에 나갈 값을 정합니다. 숫자와 상호는 다른 화면에서
          읽어 옵니다.
        </p>
      </header>

      <PrivacyBoard facts={facts} officerUserId={officerUserId} seats={seats} />
      <TermsBoard facts={termsFacts} />
    </div>
  );
}
