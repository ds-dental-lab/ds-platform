// =========================================================
// 놓을 위치: src/components/order/WorkOrderSheet.tsx
//
// 기공의뢰서. 기공소가 **박스에 붙여 두는 종이**입니다.
// (사용자 요청 2026-08-15 — "박스에 해당 환자분 기공의뢰서 용지를
//  뽑아서 정보를 구분짓거든")
//
// ★★ 이 종이의 쓸모는 **어느 박스가 누구 것인지 가르는 것**입니다.
//   그래서 환자명·주문번호가 제일 크고 위에 있습니다. 화면에서는
//   상태·금액이 중요하지만, 작업대 위에서는 그게 아닙니다.
//
// ★ 금액이 **한 줄도 안 들어갑니다.** 기공소와 치과가 같이 볼 수 있는
//   종이인데, 기공단가와 치과 판매가는 서로 못 보는 값입니다
//   ([[ds-flow-price-isolation]]). 종이는 화면보다 더 잘 돌아다닙니다 —
//   박스에 붙어서 치과까지 갑니다. 여기 금액을 실으면 그 격리가
//   통째로 무너집니다.
//
// ★ 한 장에 담습니다. 두 장이 되면 박스에 한 장만 붙고 나머지는
//   버려집니다 — 그러면 뒷장에 있던 것은 없는 것과 같습니다.
//
// ★ 인쇄용 색을 씁니다. 화면의 옅은 회색 배경은 흑백 프린터에서
//   지저분한 회색으로 나옵니다. 테두리와 검은 글씨로만 그립니다.
// =========================================================

import ToothChart, { type ChartPlacement } from '@/components/dental/ToothChart';
import { buildSummaryLines } from '@/server/domain/summary';
import { formatSelection } from '@/server/domain/implant';
import type { ProsthesisCatalog } from '@/server/domain/prosthesis';
import type { ToothShade } from '@/server/domain/shade';
import type { ImplantCatalog, ImplantSelection } from '@/server/domain/implant';
import type { OrderDetail } from '@/server/repositories/order';

export interface WorkOrderSheetProps {
  order: OrderDetail;
  prosthesisCatalog: ProsthesisCatalog;
  implantCatalog: ImplantCatalog;
}

export default function WorkOrderSheet({
  order,
  prosthesisCatalog,
  implantCatalog,
}: WorkOrderSheetProps) {
  const placements: ChartPlacement[] = order.items.map((item) => ({
    tooth: item.tooth_number,
    typeCode: item.type_code,
    materialCode: item.material_code,
    isPontic: item.is_pontic,
    hasGingival: item.has_gingival,
  }));

  const shades: Record<number, ToothShade> = {};
  const implants: Record<number, ImplantSelection> = {};

  for (const item of order.items) {
    shades[item.tooth_number] = {
      cervical: item.shade_cervical,
      incisal: item.shade_incisal,
    };

    if (item.type_code === 'implant') {
      implants[item.tooth_number] = {
        manufacturerCode: item.implant_manufacturer,
        typeCode: item.implant_type,
        sizeCode: item.implant_size,
        screwCode: item.implant_screw,
        option: item.implant_option ?? '',
      };
    }
  }

  const lines = buildSummaryLines({
    placements,
    shades,
    implants,
    implantCatalog,
    catalog: prosthesisCatalog,
  });

  const hasPontic = order.items.some((item) => item.is_pontic);

  /* 임플란트가 있으면 규격을 따로 적습니다 — 기공소가 제일 먼저 보는 값입니다 */
  const implantRows = order.items
    .filter((item) => item.type_code === 'implant')
    .map((item) => ({
      tooth: item.tooth_number,
      spec: formatSelection(implantCatalog, {
        manufacturerCode: item.implant_manufacturer,
        typeCode: item.implant_type,
        sizeCode: item.implant_size,
        screwCode: item.implant_screw,
        option: item.implant_option ?? '',
      }),
    }))
    .filter((row) => row.spec);

  return (
    <div className="mx-auto w-full max-w-[720px] bg-white px-8 py-7 text-[#111827] print:max-w-none print:px-0 print:py-0">
      <h1 className="text-center text-[26px] font-extrabold tracking-[-0.03em]">기공의뢰서</h1>

      {/* ---------- 누구 것인가 ---------- */}
      <table className="mt-6 w-full border-collapse text-[14px]">
        <tbody>
          <Row
            left="주문번호"
            leftValue={order.order_no}
            right="환자명"
            rightValue={order.patient_label}
            /* ★ 환자명이 이 종이의 열쇠입니다. 굵게 둡니다 */
            rightStrong
          />
          <Row
            left="치과"
            leftValue={order.clinic_name || '-'}
            right="기공소"
            rightValue={order.in_house ? '자사 제작' : order.lab_name || '-'}
          />
          <Row
            left="주문일"
            leftValue={(order.received_at ?? order.created_at).slice(0, 10)}
            right="요청시한"
            rightValue={order.due_date}
            rightStrong
          />
        </tbody>
      </table>

      {/* ---------- 어느 이인가 ---------- */}
      <div className="mt-6">
        <ToothChart placements={placements} catalog={prosthesisCatalog} readOnly />
      </div>

      {/* ---------- 무엇을 만드는가 ---------- */}
      <Section title="제작보철" right={hasPontic ? '✕ Pontic' : undefined}>
        {lines.length === 0 ? (
          <p className="text-[13.5px] text-[#6B7280]">등록된 보철이 없습니다.</p>
        ) : (
          /*
            ★ 표로 그립니다. 화면은 알약 모양이지만 종이에서는 줄이
              여럿일 때 눈이 세로로 훑습니다 — 재료·치식·쉐이드가
              같은 자리에 서 있어야 빨리 읽힙니다.
          */
          <table className="w-full border-collapse text-[14px]">
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="py-1.5 pr-4 font-semibold">{line.abbr}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{line.teethLabel}</td>
                  <td className="py-1.5 pr-4">{line.shadeLabel}</td>
                  <td className="py-1.5 text-[13px] text-[#374151]">{line.implantLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {implantRows.length > 0 && (
        <Section title="임플란트 규격">
          <ul className="space-y-1.5">
            {implantRows.map((row) => (
              <li key={row.tooth} className="text-[14px] leading-relaxed">
                <b className="font-bold">{row.tooth}</b> · {row.spec}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="제작옵션">
        {order.options.length === 0 ? (
          <p className="text-[13.5px] text-[#6B7280]">고른 제작옵션이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {order.options.map((option) => (
              <div key={option.groupName} className="text-[13.5px]">
                <span className="text-[#6B7280]">{option.groupName}</span>
                <span className="mx-1.5 text-[#D1D5DB]">|</span>
                <b className="font-semibold">{option.value}</b>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="요청사항">
        {/*
          ★ 비어 있어도 칸을 남깁니다. 기공사가 손으로 적는 자리입니다 —
            종이의 쓸모 절반이 여기서 나옵니다.
        */}
        <p className="min-h-[54px] whitespace-pre-wrap text-[14px] leading-relaxed">
          {order.notes?.trim() || ''}
        </p>
      </Section>

      {/* ★ 작업하며 손으로 체크하는 칸. 시안의 '작업 리스트' */}
      <Section title="작업 메모">
        <div className="min-h-[86px]" />
      </Section>
    </div>
  );
}

// ---------- 조각 ----------

function Row({
  left,
  leftValue,
  right,
  rightValue,
  rightStrong = false,
}: {
  left: string;
  leftValue: string;
  right: string;
  rightValue: string;
  rightStrong?: boolean;
}) {
  return (
    <tr className="border-b border-[#D1D5DB]">
      <th className="w-[15%] border-r border-[#E5E7EB] px-3 py-2.5 text-left text-[13px] font-medium text-[#6B7280]">
        {left}
      </th>
      <td className="w-[35%] px-3 py-2.5 text-[14px]">{leftValue}</td>
      <th className="w-[15%] border-l border-r border-[#E5E7EB] px-3 py-2.5 text-left text-[13px] font-medium text-[#6B7280]">
        {right}
      </th>
      <td className={'px-3 py-2.5 text-[14px] ' + (rightStrong ? 'font-bold' : '')}>
        {rightValue}
      </td>
    </tr>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 break-inside-avoid rounded-md border border-[#D1D5DB] px-4 py-3">
      <div className="mb-2 flex items-baseline">
        <h2 className="text-[13.5px] font-bold">{title}</h2>
        {right && <span className="ml-auto text-[12.5px] text-[#6B7280]">{right}</span>}
      </div>
      {children}
    </section>
  );
}
