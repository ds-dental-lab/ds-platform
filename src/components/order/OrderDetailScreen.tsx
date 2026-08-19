// =========================================================
// 놓을 위치: src/components/order/OrderDetailScreen.tsx
//
// 주문상세. (시안 dental-clinic-portal.html — data-page="order-detail")
//
// 시안의 .dt-wrap 을 그대로 옮겼습니다.
//   .dt-main (본문) + aside.dt-memo (대화 320px) 이 나란히 섭니다.
//
//   본문 안은 위에서 아래로
//     .dt-head   상태 · 치과 · 환자 | 요청시한 · D-day
//     .dt-arch   치식도
//     .dt-cols   1.6fr / 1fr 그리드 — 아래 자리표대로
//     .dt-bar    주문 삭제 · 수정 | 상태 전이 | 주문목록
//
//   자리표 (시안 .g-a ~ .g-g)
//     ┌ 제작보철 (g-a) ┬ 스캔/쉐이드 (g-b) ┐
//     ├ 제작옵션 (g-c) ┤                    │  ← 디자인 파일이 2~3행을
//     ├ 요청사항 (g-e) ┤ 디자인 파일 (g-d)  │     덮어 바닥선을 맞춥니다
//     └ 담당자   (g-f) ┴ 기공소     (g-g) ┘
//
// ★ 진행 이력은 넣지 않습니다.
//   시안 어디에도 없습니다. 상태가 지나온 길은 order_status_history 에
//   남아 있고, 화면에서 볼 것은 지금 어디까지 왔는가 뿐입니다.
//
// ★ 주문번호도 화면에 쓰지 않습니다. 시안이 그렇습니다.
//   문의할 때만 필요해 title 속성에 남겨 뒀습니다.
// =========================================================

import Link from 'next/link';
import ToothChart from '@/components/dental/ToothChart';
import OrderStatusActions from '@/components/order/OrderStatusActions';
import OrderChat from '@/components/order/OrderChat';
import OrderSignal from '@/components/order/OrderSignal';
import AutoRefresh from '@/components/layout/AutoRefresh';
import OrderActions from '@/components/order/OrderActions';
import OrderFileList, { DownloadAllButton } from '@/components/order/OrderFileList';
import LabAssignSelect from '@/components/order/LabAssignSelect';
import MissingFileBar from '@/components/order/MissingFileBar';
import OrderProgress, { ProgressNote } from '@/components/order/OrderProgress';
import type { ProgressStep } from '@/server/domain/progress';
import { computeDDay } from '@/server/domain/order-list';
import { buildSummaryLines } from '@/server/domain/summary';
import { colorOfType, type ProsthesisCatalog } from '@/server/domain/prosthesis';
import { formatSelection } from '@/server/domain/implant';
import {
  STATUS_LABEL,
  canDeleteFile,
  canEditFiles,
  type Sector,
} from '@/server/domain/order-status';
import type { ChartPlacement } from '@/components/dental/ToothChart';
import type { ToothShade } from '@/server/domain/shade';
import type { ImplantCatalog, ImplantSelection } from '@/server/domain/implant';
import type { OrderDetail } from '@/server/repositories/order';
import type { OrderMessage } from '@/server/repositories/order-message';
import type { IsoDate } from '@/server/domain/week';

// ★ 세 섹터가 같은 말을 씁니다.
//   사이드바 메뉴 이름이 '주문목록' 인데 상세 화면의 버튼만 '주문관리'·'작업목록'
//   이었습니다. 같은 곳으로 가는 두 이름은 사람을 헷갈리게 합니다.
const SECTOR_HOME: Record<Sector, { href: string; label: string }> = {
  clinic: { href: '/clinic/orders', label: '주문목록' },
  design_center: { href: '/design/orders', label: '주문목록' },
  lab: { href: '/lab/orders', label: '주문목록' },
};

const STATUS_COLOR: Record<string, string> = {
  received: '#1279E8',
  rescan: '#D8453F',
  designing: '#5546C8',
  production_wait: '#E09A1B',
  production: '#E09A1B',
  shipping: '#12855B',
  completed: '#5C6779',
  cancelled: '#D8453F',
};

export interface OrderDetailScreenProps {
  order: OrderDetail;
  sector: Sector;
  today: IsoDate;
  implantCatalog: ImplantCatalog;
  prosthesisCatalog: ProsthesisCatalog;
  messages: OrderMessage[];
  labs?: { id: string; name: string; inHouse?: boolean }[];
  forwardBlockedReason?: string;
  /** 머리줄에 치과 이름을 보일지 — 치과 자신에게는 필요 없습니다 */
  showClinic?: boolean;
  /**
   * 치과 이름 자리를 통째로 갈아 끼울 것 (내면값 카드).
   *
   * ★ 디자인센터만 넣습니다 — 치과명을 누르면 그 치과의 내면값이
   *   열립니다. 없으면 이름만 찍습니다.
   */
  clinicSlot?: React.ReactNode;
  /** 담당자·기공소 줄을 보일지. 치과에는 감춥니다 (설계서 §8.5) */
  showCost?: boolean;
  /** 배정된 기공소 이름. showCost 일 때만 씁니다 */
  labName?: string;
  /**
   * 담당 디자이너 칸에 넣을 것.
   *
   * ★ 디자인센터만 넣습니다. 기공소에게는 어차피 이름이 안 옵니다 —
   *   user_profiles 는 같은 조직 사람만 읽히므로(RLS), 여기서 다시
   *   가릴 필요가 없습니다.
   */
  designerSlot?: React.ReactNode;
  /**
   * 담당자 옆에 붙는 금액 한 줄 — 기공수가·기공원가.
   *
   * ★ 디자인센터 **관리자만** 봅니다 (사용자 결정 2026-08-12).
   *   디자이너에게는 금액이 아예 안 보이는 것이 이 프로젝트의 규칙입니다.
   *   조정은 스패너 안에 있고, 여기는 **읽기만** 하는 한 줄입니다.
   */
  costLine?: React.ReactNode;
  /** 디자인 파일칸 위에 끼워 넣을 것 (업로더 등) */
  designSlot?: React.ReactNode;
  /** 스캔 파일칸 위에 끼워 넣을 것 (재스캔 띠) — 시안 .rescan-bar */
  scanSlot?: React.ReactNode;
  /** 치식도 아래에 끼워 넣을 것 (수거 카드 등) */
  extraSlot?: React.ReactNode;
  /**
   * 진행 막대. (사용자 요청 2026-08-13)
   *
   * ★ 머리줄의 상태는 **지금** 어디인지만 말합니다.
   *   어디까지 왔고 다음이 무엇인지는 이 줄이 답합니다.
   */
  progress?: ProgressStep[];
  /** 막대 아래 한 줄. 치과에만 답니다 (고객의 말) */
  progressNote?: string;
  /**
   * 머리줄 **바로 아래**에 끼워 넣을 것 (리페어 칸).
   *
   * ★ 치식도보다 위입니다. 이 건이 왜 다시 들어왔는지는
   *   어느 이가 몇 개인지보다 먼저 읽혀야 합니다.
   */
  issueSlot?: React.ReactNode;
  /** 아래줄에 끼워 넣을 것 (리메이크 · 리페어 신청) — 시안 .dt-bar */
  barSlot?: React.ReactNode;
  /**
   * 환자 이름 **바로 옆**에 붙일 것 (리메이크 사유).
   *
   * ★ 이 건이 무엇인가에 붙는 꼬리표만 옵니다. 동작 단추는
   *   `barSlot` 입니다 — 섞으면 이름줄이 단추밭이 됩니다.
   */
  nameSlot?: React.ReactNode;
  /**
   * 머리줄 **오른쪽**, 요청시한 앞에 붙일 것 (기공의뢰서 인쇄).
   *
   * ★ 아래 단추줄과 나눈 이유 — 거기는 삭제·수정·상태 전이처럼
   *   **조심해야 하는** 단추들입니다. 매번 눌러야 하는 것을 그 사이에
   *   두면 안 됩니다.
   */
  sheetSlot?: React.ReactNode;
}

export default function OrderDetailScreen({
  order,
  sector,
  today,
  implantCatalog,
  prosthesisCatalog,
  messages,
  labs = [],
  forwardBlockedReason,
  showClinic = true,
  clinicSlot,
  showCost = false,
  labName,
  designerSlot,
  costLine,
  designSlot,
  scanSlot,
  extraSlot,
  issueSlot,
  progress,
  progressNote,
  barSlot,
  nameSlot,
  sheetSlot,
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

  const lines = buildSummaryLines({
    placements,
    shades,
    implants,
    implantCatalog,
    catalog: prosthesisCatalog,
  });
  const hasPontic = placements.some((p) => p.isPontic);

  const scanFiles = order.files.filter((f) => f.kind !== 'design');
  const designFiles = order.files.filter((f) => f.kind === 'design');

  /*
    ★ (올라온 수 / 보낸 수) 를 줄에서 셉니다.
      줄은 올리기 **전에** 만들어집니다 — 그래서 끊긴 파일도 이름이 남고,
      전체 줄 수가 곧 '치과가 보내려던 수' 입니다.
      따로 숫자를 세어 두면 언젠가 줄과 어긋납니다.
  */
  const scanArrived = scanFiles.filter((f) => f.upload_status === 'uploaded');
  const scanMissingFiles = scanFiles.filter((f) => f.upload_status !== 'uploaded');
  const scanExpected = scanFiles.length;
  const scanMissing = scanMissingFiles.length;

  // 무엇을 지울 수 있는가는 도메인이 정합니다 (설계서 §8.3)
  const canRemoveScan = canDeleteFile('scan', order.status, order.roles);
  const canRemoveDesign = canDeleteFile('design', order.status, order.roles);
  const canAddFiles = canEditFiles(order.status);

  // ★ 기공소는 넘기기 전까지만 바꿉니다.
  //   제작대기로 가면 그 기공소가 이미 일을 받았습니다.
  const canAssignLab = canEditFiles(order.status);

  // 임플란트 주문이면 치아별 모델을 따로 세웁니다 (시안 #dtImplantCard)
  const implantTeeth = order.items.filter((i) => i.type_code === 'implant');
  const hasImplant = implantTeeth.length > 0;

  // ★ 폰틱은 픽스처가 없습니다. 모델 칸에 세울 것이 없어 뺍니다
  const implantRows = implantTeeth
    .filter((i) => !i.is_pontic && i.implant_manufacturer)
    .sort((a, b) => a.tooth_number - b.tooth_number)
    .map((i) => ({
      tooth: i.tooth_number,
      model: formatSelection(implantCatalog, implants[i.tooth_number]),
    }));

  // 폰틱은 픽스처가 없어 셈에서 뺍니다
  const missingModels = implantTeeth.filter(
    (i) => !i.implant_manufacturer && !i.is_pontic,
  ).length;

  return (
    <div
      className="-mx-3.5 -mt-3.5 flex flex-wrap items-stretch gap-3 xl:flex-nowrap"
      title={`주문번호 ${order.order_no}`}
    >
      {/*
        ★ 열어 둔 채로도 대화가 따라옵니다 (2026-08-19).
          OrderSignal 이 빠른 길(신호, 즉시), AutoRefresh 가 반드시 오는
          길(20초 폴링)입니다. Realtime 연결은 조용히 끊기므로 폴링을
          지우면 안 됩니다 — 끊겨도 최대 20초 늦을 뿐 잃지 않습니다.
      */}
      <OrderSignal orderId={order.id} />
      <AutoRefresh />
      {/* ================= 본문 (.dt-main) ================= */}
      <div className="flex min-w-0 flex-1 flex-col border-y border-r border-[#E8EBF0] bg-white">
        {/* ---------- .dt-head ---------- */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E8EBF0] px-[18px] py-3">
          <span className="grid place-items-center text-[#98A2B3]" aria-hidden="true">
            <svg
              width="16"
              height="16"
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

          <b className="text-[13.5px] font-bold" style={{ color: statusColor }}>
            {STATUS_LABEL[order.status]}
          </b>

          {showClinic &&
            (clinicSlot ??
              (order.clinic_name && (
                <span className="text-[14px] text-[#4A5567]">{order.clinic_name}</span>
              )))}

          <b className="text-[15.5px] font-extrabold tracking-[-0.03em] text-[#1A2130]">
            {order.patient_label}
          </b>

          {/* ★ 이름 바로 옆입니다 (사용자 요청 2026-08-14).
                리메이크 사유는 '이 건이 무엇인가' 에 붙는 꼬리표라,
                아래 단추줄에 두면 다른 동작들과 섞여 안 눌립니다 */}
          {nameSlot}

          <div className="ml-auto flex flex-wrap items-center gap-[9px]">
            {/*
              ★ 기공의뢰서는 **요청시한 왼쪽**입니다 (사용자 요청 2026-08-15).
                작업대에서 종이를 뽑는 동작이라 아래 단추줄(삭제·수정·상태
                전이)과는 성격이 다릅니다. 거기 두면 위험한 단추들 사이에
                섞여서, 매번 눌러야 하는 것이 매번 조심해야 하는 자리에
                놓입니다.
            */}
            {sheetSlot}

            <span className="text-[13.5px] text-[#4A5567]">요청시한: {order.due_date}</span>

            <span
              className="rounded-md border px-2.5 py-1 text-[13.5px] font-bold"
              style={{
                borderColor: dday.urgent ? '#F3C6C6' : '#BFD5F5',
                color: dday.urgent ? '#C4383A' : '#1279E8',
                background: dday.urgent ? '#FDE7E7' : '#F2F7FE',
              }}
            >
              {dday.label}
            </span>
          </div>
        </div>

        {/* 넓은 것에는 자기 스크롤을 줍니다 — 칸이 여덟까지 늘어납니다 */}
        {progress && progress.length > 1 && (
          <div className="border-b border-[#F0F2F5] px-[18px] py-3">
            <div className="overflow-x-auto">
              <OrderProgress steps={progress} />
            </div>
            {progressNote && <ProgressNote note={progressNote} />}
          </div>
        )}

        {issueSlot && <div className="px-[18px] pt-3.5">{issueSlot}</div>}

        {/* ---------- .dt-arch ---------- */}
        <div className="px-[18px] pb-[30px] pt-6">
          <ToothChart placements={placements} catalog={prosthesisCatalog} readOnly />
        </div>

        {extraSlot && <div className="px-[18px] pb-3.5">{extraSlot}</div>}

        {/* ---------- .dt-cols ---------- */}
        <div className="grid grid-cols-1 items-stretch gap-3.5 px-[18px] pb-[18px] lg:grid-cols-[1.6fr_1fr]">
          {/* g-a — 제작보철 */}
          <Card
            className="lg:col-start-1 lg:row-start-1"
            icon={ICON.cart}
            title="제작보철"
            right={
              hasPontic ? (
                <span className="ml-auto text-[13.5px] font-semibold text-[#4A5567]">
                  <b className="mr-[3px] font-bold text-[#98A2B3]">✕</b>Pontic
                </span>
              ) : null
            }
          >
            {lines.length === 0 ? (
              <p className="text-[13.5px] text-[#98A2B3]">등록된 보철 정보가 없습니다.</p>
            ) : (
              <div className="flex flex-col items-start gap-2">
                {lines.map((line) => {
                  const color = colorOfType(prosthesisCatalog, line.typeCode);

                  return (
                    <div
                      key={line.key}
                      className="inline-flex max-w-full items-center gap-[34px] rounded-[20px] bg-white px-[22px] py-[9px]"
                      style={{ border: `1.5px solid ${color.line}` }}
                    >
                      <span className="whitespace-nowrap text-[14px] font-semibold text-[#1A2130]">
                        {line.abbr}
                      </span>

                      <span className="ml-auto whitespace-nowrap text-[14px] font-semibold tabular-nums text-[#4A5567]">
                        {line.teethLabel}
                        {line.shadeLabel && ` (${line.shadeLabel})`}
                      </span>

                      {line.teeth.length > 1 && (
                        <span
                          className="rounded-[9px] px-[7px] py-0.5 text-[10.5px] font-bold"
                          style={{ background: color.soft, color: color.line }}
                        >
                          연결
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* g-b — 스캔/쉐이드 파일 */}
          <Card
            className="lg:col-start-2 lg:row-start-1"
            title="스캔/쉐이드 파일"
            right={
              /*
                ★ 왼쪽은 실제로 올라온 수, 오른쪽은 치과가 보내려던 수입니다.
                  스캔 데이터는 한 개가 수백 MB 라 올리다 끊기면 주문만 들어오고
                  파일이 빠집니다. 두 수가 같아야 다 왔다는 뜻입니다.
              */
              <span
                className={
                  'ml-auto flex items-center gap-1.5 text-[13.5px] font-semibold ' +
                  (scanMissing > 0 ? 'text-[#B3312C]' : 'text-[#4A5567]')
                }
                title={
                  scanMissing > 0
                    ? `${scanMissing}개가 올라오지 못했습니다`
                    : '보낸 파일이 모두 올라왔습니다'
                }
              >
                File Count ({scanArrived.length}/{scanExpected})
                <DownloadAllButton files={scanFiles} />
              </span>
            }
          >
            {scanSlot}

            <MissingFileBar
              orderId={order.id}
              missing={scanMissingFiles.map((f) => ({
                id: f.id,
                fileName: f.file_name,
                fileSize: f.file_size,
              }))}
              /* 스캔은 치과가 올립니다. 디자인센터는 무엇이 빠졌는지 보기만 합니다 */
              editable={sector === 'clinic' && canAddFiles}
            />

            <div className="flex max-h-[260px] min-h-[172px] flex-col overflow-y-auto">
              {scanFiles.length === 0 ? (
                <p className="m-auto py-6 text-[13.5px] text-[#98A2B3]">
                  업로드된 스캔 파일이 없습니다.
                </p>
              ) : (
                <OrderFileList files={scanFiles} deletable={canRemoveScan} />
              )}
            </div>
          </Card>

          {/* g-c — 제작옵션 (+ 임플란트 모델) */}
          <div
            className={
              'grid gap-3 lg:col-start-1 lg:row-start-2 ' +
              (hasImplant ? 'lg:grid-cols-[1.15fr_1fr]' : 'grid-cols-1')
            }
          >
            <Card icon={ICON.gear} title="제작옵션">
              {order.options.length === 0 ? (
                <p className="text-[13.5px] text-[#98A2B3]">고른 제작옵션이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {order.options.map((option) => (
                    <div key={option.groupName} className="relative">
                      {/* 시안 .ffield — 라벨이 테두리 위에 걸쳐 앉습니다 */}
                      <label className="absolute -top-[7px] left-[10px] z-10 bg-[#F5F8FE] px-[5px] text-[11px] font-semibold text-[#98A2B3]">
                        {option.groupName}
                      </label>
                      <div className="grid h-11 place-items-center rounded-md border border-[#DDE2EA] bg-white text-[14px] font-medium text-[#1A2130]">
                        {option.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {hasImplant && (
              <Card icon={ICON.implant} title="임플란트 모델">
                <div className="flex max-h-[190px] flex-col gap-2 overflow-y-auto">
                  {implantRows.length === 0 ? (
                    <p className="px-0.5 py-1.5 text-[13.5px] text-[#98A2B3]">
                      등록된 모델 정보가 없습니다.
                    </p>
                  ) : (
                    implantRows.map((row) => (
                      <div key={row.tooth} className="flex items-center gap-2.5 text-[13.5px]">
                        <span className="min-w-[30px] shrink-0 rounded-[5px] border border-[#DDE2EA] bg-white py-[3px] text-center font-bold tabular-nums">
                          {row.tooth}
                        </span>
                        <span className="font-semibold text-[#4A5567]">{row.model}</span>
                      </div>
                    ))
                  )}

                </div>

                {/*
                  ★ 경고는 스크롤 상자 **밖**에 둡니다 (2026-08-13).
                    안에 있으면 치아가 여럿일 때 아래로 밀려 안 보입니다 —
                    정작 "모델이 없다" 를 알려야 할 주문일수록 줄이 많습니다.
                */}
                {missingModels > 0 && (
                  <p className="mt-2 rounded-md border border-[#F3C6C6] bg-[#FDECEA] px-[11px] py-[9px] text-[12.5px] font-bold leading-relaxed text-[#C4383A]">
                    ⚠ 모델이 지정되지 않은 치아가 {missingModels}개 있습니다. 제작을 진행할 수
                    없습니다.
                  </p>
                )}
              </Card>
            )}
          </div>

          {/* g-d — 디자인 파일 (2~3행을 덮어 바닥선을 맞춥니다) */}
          <Card
            className="lg:col-start-2 lg:row-start-2 lg:row-end-4"
            title={`디자인 파일(${designFiles.length})`}
            /* ★ 올리기는 머리줄의 아이콘 하나입니다 — 본문은 목록만 씁니다 */
            right={
              <span className="ml-auto flex items-center gap-1.5">
                <DownloadAllButton files={designFiles} />
                {designSlot}
              </span>
            }
          >
            <div className="flex max-h-[260px] min-h-[172px] flex-col overflow-y-auto">
              {designFiles.length === 0 ? (
                <p className="m-auto py-6 text-[13.5px] text-[#98A2B3]">
                  아직 디자인 파일이 없습니다.
                </p>
              ) : (
                <OrderFileList files={designFiles} deletable={canRemoveDesign} />
              )}
            </div>
          </Card>

          {/* g-e — 기타 요청사항 */}
          <div className="min-h-[104px] rounded-[9px] border border-[#E8EBF0] bg-white px-4 py-[13px] lg:col-start-1 lg:row-start-3">
            <p className="mb-[7px] text-[14px] font-bold text-[#1A2130]">기타 요청사항</p>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1279E8]">
              {order.notes || <span className="text-[#C4CBD6]">적힌 내용이 없습니다.</span>}
            </p>
          </div>

          {/* g-f · g-g — 담당자 · 기공소 (치과에는 감춥니다) */}
          {showCost && (
            <>
              <div className="flex flex-wrap items-center gap-3.5 px-1 py-0.5 text-[13.5px] text-[#4A5567] lg:col-start-1 lg:row-start-4">
                {designerSlot}
                {costLine}
              </div>

              <div className="flex items-center gap-3.5 px-1 py-0.5 text-[13.5px] text-[#4A5567] lg:col-start-2 lg:row-start-4">
                <LabAssignSelect
                  orderId={order.id}
                  labs={labs.map((l) => ({ id: l.id, name: l.name, inHouse: Boolean(l.inHouse) }))}
                  current={order.lab_org_id}
                  editable={sector === 'design_center' && labs.length > 0 && canAssignLab}
                  labName={labName}
                />
              </div>
            </>
          )}
        </div>

        {/* ---------- .dt-bar ---------- */}
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#E8EBF0] px-[18px] py-3">
          <OrderActions
            orderId={order.id}
            status={order.status}
            roles={order.roles}
            orderPath={home.href}
            /* ★ 디자인센터도 고칠 수 있습니다 (사용자 결정 2026-08-12) */
            editPath={
              sector === 'lab' ? undefined : `/${sector === 'clinic' ? 'clinic' : 'design'}/orders/${order.id}/edit`
            }
          />

          {barSlot}

          <OrderStatusActions
            orderId={order.id}
            status={order.status}
            roles={order.roles}
            labs={labs}
            /*
              ★ 아래 칸에서 고른 기공소를 그대로 씁니다.
                아직 안 골랐으면 자사 기공입니다 — 셀렉박스에 그렇게
                보이므로, 눌렀을 때도 그대로 넘어가야 말이 맞습니다.
            */
            assignedLabId={order.lab_org_id ?? labs.find((l) => l.inHouse)?.id ?? null}
            forwardBlockedReason={forwardBlockedReason}
          />

          <Link
            href={home.href}
            className="ml-auto grid h-[34px] place-items-center rounded-[7px] bg-[#1279E8] px-5 text-[14px] font-bold text-white hover:bg-[#1554C8]"
          >
            {home.label}
          </Link>
        </div>
      </div>

      {/* ================= 대화 (aside.dt-memo) ================= */}
      <aside className="flex min-h-[560px] w-full shrink-0 flex-col self-stretch border-y border-l border-[#E8EBF0] bg-white xl:w-[320px]">
        <OrderChat orderId={order.id} messages={messages} />
      </aside>
    </div>
  );
}

// ---------- 조각들 ----------

const ICON = {
  cart: (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M2.4 3.4h2.2l2 8.6h8.4l1.6-6H5.6" />
      <circle cx="8.4" cy="15.6" r="1.2" />
      <circle cx="14.4" cy="15.6" r="1.2" />
    </svg>
  ),
  gear: (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.7" />
      <path d="M10 1.8v2.4M10 15.8v2.4M18.2 10h-2.4M4.2 10H1.8M15.8 4.2l-1.7 1.7M5.9 14.1l-1.7 1.7M15.8 15.8l-1.7-1.7M5.9 5.9 4.2 4.2" />
    </svg>
  ),
  implant: (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <rect x="2.6" y="5.4" width="14.8" height="11" rx="1.8" />
      <path d="M7.2 5.4V4a1.2 1.2 0 0 1 1.2-1.2h3.2A1.2 1.2 0 0 1 12.8 4v1.4" />
      <path d="M10 9v4M8 11h4" />
    </svg>
  ),
};

/** 시안 .dt-card — 옅은 파란 바탕에 머리줄 하나 */
function Card({
  icon,
  title,
  right,
  className = '',
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        'flex flex-col rounded-[9px] border border-[#E2EAF7] bg-[#F5F8FE] ' + className
      }
    >
      <div className="flex items-center gap-2.5 px-4 pt-[13px]">
        <span className="flex items-center gap-1.5 text-[14px] font-bold tracking-[-0.03em] text-[#1A2130]">
          {icon && (
            <span className="text-[#1279E8]" aria-hidden="true">
              {icon}
            </span>
          )}
          {title}
        </span>
        {right}
      </div>

      <div className="min-h-[112px] flex-1 px-4 pb-4 pt-3">{children}</div>
    </div>
  );
}
