// =========================================================
// 놓을 위치: src/app/design/orders/new/page.tsx
//
// 대리등록 — 디자인센터가 치과를 대신해 주문을 넣습니다.
// 전화·팩스로 들어오는 주문이 많아 이 길이 필요합니다.
//
// ★ 치과를 고르기 전에는 폼을 안 띄웁니다.
//   임플란트 즐겨찾기와 제작옵션 즐겨찾기가 **치과마다** 다릅니다.
//   먼저 띄우고 나중에 갈아끼우면 원장이 안 만든 즐겨찾기가 보입니다.
//
// ★ 정산은 따로 이어 붙이지 않습니다.
//   주문의 clinic_org_id 가 그 치과라, 정산 조회가 그 치과의 기간에서
//   이 주문을 그대로 집어 갑니다.
// =========================================================

import { notFound } from 'next/navigation';
import { requireSector } from '@/server/policies/session';
import { listPartners } from '@/server/repositories/partner';
import { getImplantCatalog, listImplantFavorites } from '@/server/repositories/implant';
import { getProductionOptions } from '@/server/repositories/production-option';
import { listOptionPresets } from '@/server/repositories/option-preset';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { todayInKst } from '@/server/domain/week';
import { defaultDueDate } from '@/server/domain/due-date';
import NewOrderForm from '@/components/order/NewOrderForm';
import ClinicPicker from '@/components/order/ClinicPicker';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DesignNewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ clinic?: string }>;
}) {
  await requireSector('design_center');

  const { clinic: clinicId } = await searchParams;
  const partners = await listPartners();

  // ★ 거래중인 치과만입니다. 끊은 곳에 새 주문이 들어가면 청구할 데가 없습니다
  const clinics = partners.filter((p) => p.orgType === 'clinic' && p.isActive);

  if (!clinicId) {
    return (
      <ClinicPicker
        clinics={clinics.map((c) => ({
          id: c.id,
          name: c.name,
          ceoName: c.ceoName,
          address: c.address,
        }))}
      />
    );
  }

  const clinic = clinics.find((c) => c.id === clinicId);

  // 거래중지됐거나 남의 치과면 없는 것으로 봅니다 (§8.6)
  if (!clinic) notFound();

  const [implantCatalog, implantFavorites, optionGroups, optionPresets, prosthesisCatalog] =
    await Promise.all([
      getImplantCatalog(),
      // ★ 그 치과의 즐겨찾기입니다. 디자인센터 자기 것이 아닙니다
      listImplantFavorites(clinic.id),
      getProductionOptions(),
      listOptionPresets(clinic.id),
      getProsthesisCatalog(),
    ]);

  const today = todayInKst();

  return (
    // ★ 폼과 같은 폭·같은 자리입니다. 치과 화면과 다른 것은
    //   위의 '어느 치과인가' 띠 하나뿐입니다.
    <div className="mx-auto max-w-5xl space-y-3">
      {/* 누구를 대신해 넣고 있는지 늘 보이게 둡니다 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#EFEDFB] bg-[#F8F7FE] px-4 py-3">
        <span className="rounded bg-[#5546C8] px-2 py-0.5 text-[11px] font-bold text-white">
          대리등록
        </span>
        <b className="text-[14px] font-bold text-[#1A2130]">{clinic.name}</b>
        <span className="text-[12.5px] text-[#98A2B3]">
          이 치과의 주문으로 등록되고, 정산도 이 치과로 잡힙니다
        </span>

        <Link
          href="/design/orders/new"
          className="ml-auto rounded-md border border-[#DDE2EA] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4A5567] hover:border-[#5546C8] hover:text-[#5546C8]"
        >
          치과 바꾸기
        </Link>
      </div>

      {/*
        ★ key 에 치과를 답니다.
          치과를 바꾸면 폼이 통째로 새로 태어납니다 — 앞 치과에서 적던
          환자·치식이 남아 다른 치과 주문으로 넘어가면 안 됩니다.
      */}
      <NewOrderForm
        key={clinic.id}
        clinicName={clinic.name}
        clinicOrgId={clinic.id}
        basePath="/design/orders"
        /*
          ★ 요청시한을 오늘부터 고를 수 있습니다.
            전화로 들어오는 건에는 이미 약속된 날짜가 있습니다.
            4영업일을 강요하면 실제와 다른 날을 적게 되고, 그 날짜로
            돌아가는 D-day·배송조회·정산 예상이 전부 어긋납니다.
        */
        dueDatePolicy="free"
        today={today}
        defaultDue={defaultDueDate(today)}
        implantCatalog={implantCatalog}
        implantFavorites={implantFavorites}
        optionGroups={optionGroups}
        optionPresets={optionPresets}
        prosthesisCatalog={prosthesisCatalog}
      />
    </div>
  );
}
