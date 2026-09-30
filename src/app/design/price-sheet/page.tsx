// =========================================================
// 놓을 위치: src/app/design/price-sheet/page.tsx
//
// 상담용 수가표 (사용자 요청 2026-09-29 — "스스로 수가표 만들 수 있으면 좋겠다,
// 원장님과 상담할 때 A4 로 뽑아 가게").
//
// ★ 값은 문의 메일 수가표와 한 곳에서 옵니다 (organizations.price_sheet).
//   여기서 고쳐 뽑기만 할 수도 있고, '기본값으로 저장' 으로 아예 바꿀 수도 있습니다.
// ★ 저장은 관리자만. 단가는 회사의 값이라 디자이너가 바꿀 것이 아닙니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { canManageMembers, type MemberRole } from '@/server/domain/member';
import { getPriceSheetDefaults } from '@/server/repositories/price-sheet';
import { SITE_LEGAL, SITE_TEL } from '@/server/domain/site';
import PriceSheetEditor from '@/components/contact/PriceSheetEditor';

export const dynamic = 'force-dynamic';

export default async function PriceSheetPage() {
  // ★ 감춘 메뉴에는 문을 답니다 — 주소만 알면 열리면 안 됩니다 (nav 테스트가 잠급니다)
  const session = await requireManagerSector('design_center');

  const rows = await getPriceSheetDefaults();

  return (
    <PriceSheetEditor
      rows={rows}
      company={{ name: SITE_LEGAL.name, tel: SITE_TEL, address: SITE_LEGAL.address }}
      canSave={canManageMembers(session.role as MemberRole | null)}
    />
  );
}
