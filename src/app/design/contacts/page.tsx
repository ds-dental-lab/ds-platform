// =========================================================
// 놓을 위치: src/app/design/contacts/page.tsx
//
// 홈페이지로 들어온 수가표·상담 요청 (디자인센터 관리자 전용).
//
// ★ 메뉴에서 감춘 화면에는 반드시 문이 있어야 합니다 (tests/domain/nav).
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { listContacts } from '@/server/repositories/contact';
import { getPriceSheetDefaults } from '@/server/repositories/price-sheet';
import ContactBoard from '@/components/site/ContactBoard';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  await requireManagerSector('design_center');

  // ★ 둘은 서로를 안 씁니다 — 함께 보냅니다
  const [{ fresh, done }, priceSheet] = await Promise.all([listContacts(), getPriceSheetDefaults()]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-1">
      <header>
        <h1 className="text-[19px] font-extrabold tracking-[-0.03em] text-[#1A2130]">수가표 요청</h1>
        <p className="mt-1 text-[14px] text-[#7C8595]">
          홈페이지에서 남긴 문의입니다. 전화하고 수가표를 보낸 뒤 처리로 표시해 주세요.
        </p>
      </header>

      <ContactBoard fresh={fresh} done={done} priceSheet={priceSheet} />
    </div>
  );
}
