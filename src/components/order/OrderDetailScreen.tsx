// =========================================================
// 놓을 위치: src/components/order/OrderDetailScreen.tsx
//
// 주문상세. (기능명세서 §4.3, 사용자가 준 화면)
//
// 배치 — 위에서 아래로 네 덩어리입니다.
//   ① 머리줄   상태 · 치과 · 환자 | 요청시한 · D-day
//   ② 치식도   테두리 없이 폭을 다 씁니다
//   ③ 두 칸    왼쪽 제작보철 · 제작옵션 · 요청사항 / 오른쪽 파일들
//   ④ 아래줄   되돌아가기와 상태 전이 버튼
//
// ★ 주문번호는 화면에 쓰지 않습니다.
//   원장이 보는 건 '누구의 무엇' 이지 번호가 아닙니다.
//   번호는 문의할 때만 필요해 제목(title)에만 남겨 뒀습니다.
//
// ★ 상태 전이 버튼은 맨 아래에 둡니다.
//   위에 있으면 주문 내용을 보기도 전에 눈에 먼저 들어와 거슬립니다.
//   내용을 다 읽고 나서 누르는 것이 순서입니다.
// =========================================================

import Link from 'next/link';
import ToothChart from '@/components/dental/ToothChart';
import ProsthesisSummary from '@/components/dental/ProsthesisSummary';
import OrderStatusActions from '@/components/order/OrderStatusActions';
import OrderChat from '@/components/order/OrderChat';
import OrderFileList from '@/components/order/OrderFileList';
import { computeDDay } from '@/server/domain/order-list';
import { STATUS_LABEL, type Sector } from '@/server/domain/order-status';
import type { ChartPlacement } from '@/components/dental/ToothChart';
import type { ToothShade } from '@/server/domain/shade';
import type { ImplantCatalog, ImplantSelection } from '@/server/domain/implant';
import type { OrderDetail } from '@/server/repositories/order';
import type { OrderMessage } from '@/server/repositories/order-message';
import type { IsoDate } from '@/server/domain/week';

/** 섹터마다 색과 돌아갈 곳이 다릅니다 */
const SECTOR_HOME: Record<Sector, { href: string; label: string }> = {
  clinic: { href: '/clinic/orders', label: '주문목록' },
  design_center: { href: '/design/orders', label: '주문관리' },
  lab: { href: '/lab/orders', label: '작업목록' },
};

const STATUS_COLOR: Record<string, string> = {
  received: '#1279E8',
  designing: '#5546C8',
  design_done: '#5546C8',
  production_wait: '#E09A1B',
  production: '#E09A1B',
  shipping: '#12855B',
  done: '#5C6779',
  cancelled: '#D8453F',
};

export interface OrderDetailScreenProps {
  order: OrderDetail;
  sector: Sector;
  today: IsoDate;
  implantCatalog: ImplantCatalog;
  /** 주문별 대화. 세 섹터가 함께 봅니다 */
  messages: OrderMessage[];
  /** 디자인센터가 배정할 수 있는 기공소 */
  labs?: { id: string; name: string }[];
  forwardBlockedReason?: string;
  /** 머리줄에 치과 이름을 보일지 — 치과 자신에게는 필요 없습니다 */
  showClinic?: boolean;
  /** 오른쪽 아래 파일칸 위에 끼워 넣을 것 (디자인 파일 업로더 등) */
  designSlot?: React.ReactNode;
  /** 치식도 아래에 끼워 넣을 것 (수거 카드 · 리페어 신청 등) */
  extraSlot?: React.ReactNode;
  /** 맨 아래에 붙일 것 (진행 이력 등) */
  footerSlot?: React.ReactNode;
}

export default function OrderDetailScreen({
  order,
  sector,
  today,
  implantCatalog,
  messages,
  labs = [],
  forwardBlockedReason,
  showClinic = true,
  designSlot,
  extraSlot,
  footerSlot,
}: OrderDetailScreenProps) {
  const placements: ChartPlacement[] = order.items.map((item) => ({
    tooth: item.tooth_number,
    typeCode: item.type_code,
    materialCode: item.material_code,
    isPontic: item.is_pontic,
    hasGingival: item.has_gingival,
  }));

  // 같은 치아가 두 번 등록됐으면(slot 1·2) 마지막 값이 남습니다
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

  const home = SECTOR_HOME[sector];
  const dday = computeDDay(order.due_date, today, order.status);
  const statusColor = STATUS_COLOR[order.status] ?? '#4A5567';

  const scanFiles = order.files.filter((f) => f.kind !== 'design');
  const designFiles = order.files.filter((f) => f.kind === 'design');

  return (
    <div className="mx-auto max-w-[1180px]" title={`주문번호 ${order.order_no}`}>
      {/* ---------- ① 머리줄 ---------- */}
      <div className="flex flex-wrap items-center gap-2.5 px-1 pb-3.5 pt-1">
        <span className="text-[#98A2B3]" aria-hidden="true">
          <svg
            width="17"
            height="17"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.8 2.6a4.2 4.2 0 0 0-4.9 5.3L2.6 13.2a1.6 1.6 0 0 0 2.2 2.2l5.3-5.3a4.2 4.2 0 0 0 5.3-4.9l-2.4 2.4-2.1-2.1 1.9-2.7Z" />
          </svg>
        </span>

        <b className="text-[14px] font-bold tracking-tight" style={{ color: statusColor }}>
          {STATUS_LABEL[order.status]}
        </b>

        {showClinic && order.clinic_name && (
          <span className="text-[13.5px] text-[#4A5567]">{order.clinic_name}</span>
        )}

        <b className="text-[14px] font-bold tracking-tight text-[#1A2130]">
          {order.patient_label}
        </b>

        <span className="ml-auto text-[13px] text-[#4A5567]">
          요청시한: {order.due_date}
        </span>

        <span
          className="rounded-md border px-2.5 py-1 text-[12.5px] font-bold"
          style={{
            borderColor: dday.urgent ? '#E9A9A6' : '#BFD5F5',
            color: dday.urgent ? '#D8453F' : '#1279E8',
            background: dday.urgent ? '#FDF4F4' : '#F2F7FE',
          }}
        >
          {dday.label}
        </span>
      </div>

      {/* ---------- ② 치식도 ---------- */}
      <div className="rounded-lg border border-[#E8EBF0] bg-white px-5 py-6">
        <ToothChart placements={placements} readOnly />
      </div>

      {extraSlot && <div className="mt-3">{extraSlot}</div>}

      {/* ---------- ③ 두 칸 ---------- */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 왼쪽 */}
        <div className="space-y-3">
          <ProsthesisSummary
            placements={placements}
            shades={shades}
            implants={implants}
            implantCatalog={implantCatalog}
            readOnly
          />

          <Panel icon={ICON.option} title="제작옵션">
            {order.options.length === 0 ? (
              <Empty>고른 제작옵션이 없습니다.</Empty>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {order.options.map((option) => (
                  <div
                    key={option.groupName}
                    className="rounded-md border border-[#DCE8F8] bg-white px-3 pb-2.5 pt-1.5"
                  >
                    <p className="text-[11px] text-[#98A2B3]">{option.groupName}</p>
                    <p className="text-center text-[13.5px] text-[#1A2130]">{option.value}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="rounded-lg border border-[#E8EBF0] bg-white px-4 pb-4 pt-3">
            <p className="text-[13px] font-bold text-[#1A2130]">기타 요청사항</p>
            <p className="mt-2 min-h-[54px] whitespace-pre-wrap text-[13px] leading-relaxed text-[#4A5567]">
              {order.notes || <span className="text-[#C4CBD6]">적힌 내용이 없습니다.</span>}
            </p>
          </div>
        </div>

        {/* 오른쪽 */}
        <div className="space-y-3">
          <Panel
            title="스캔/쉐이드 파일"
            right={
              <span className="text-[12.5px] text-[#98A2B3]">
                File Count ({scanFiles.length}/{scanFiles.length})
              </span>
            }
          >
            {scanFiles.length === 0 ? (
              <Empty>올라온 파일이 없습니다.</Empty>
            ) : (
              <OrderFileList files={scanFiles} />
            )}
          </Panel>

          <Panel title={`디자인 파일(${designFiles.length})`}>
            {designSlot}

            {designFiles.length === 0 ? (
              <Empty>아직 디자인 파일이 없습니다.</Empty>
            ) : (
              <OrderFileList files={designFiles} />
            )}
          </Panel>

          {/* 대화 — 세 섹터가 한 주문을 두고 주고받습니다 */}
          <OrderChat orderId={order.id} messages={messages} />
        </div>
      </div>

      {footerSlot && <div className="mt-3">{footerSlot}</div>}

      {/* ---------- ④ 아래줄 ---------- */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#E8EBF0] bg-white px-4 py-3">
        <OrderStatusActions
          orderId={order.id}
          status={order.status}
          roles={order.roles}
          labs={labs}
          forwardBlockedReason={forwardBlockedReason}
        />

        <Link
          href={home.href}
          className="ml-auto rounded-md bg-[#1279E8] px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#0F68C9]"
        >
          {home.label}
        </Link>
      </div>

      <div className="pb-8" />
    </div>
  );
}

// ---------- 조각들 ----------

const ICON = {
  option: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="3" />
      <path d="M10 1.6v2.2M10 16.2v2.2M3.4 3.4l1.6 1.6M15 15l1.6 1.6M1.6 10h2.2M16.2 10h2.2M3.4 16.6 5 15M15 5l1.6-1.6" />
    </svg>
  ),
};

function Panel({
  icon,
  title,
  right,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#DCE8F8] bg-[#F2F7FE] px-4 pb-4 pt-3.5">
      <div className="mb-3 flex items-center gap-2">
        {icon && (
          <span className="text-[#1279E8]" aria-hidden="true">
            {icon}
          </span>
        )}
        <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">{title}</h2>
        {right && <span className="ml-auto">{right}</span>}
      </div>

      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-[13px] text-[#98A2B3]">{children}</p>;
}

