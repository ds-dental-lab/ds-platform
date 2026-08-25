// =========================================================
// 놓을 위치: src/components/home/HomeScreen.tsx
//
// HOME. (사용자가 준 화면 — 치과 · 디자인센터 · 기공소 셋)
//
// 배치는 셋이 같습니다. 세 칸으로 나뉩니다.
//   왼쪽    금액 · 진행중 상태 · 진행중 이슈 · 아래 넓은 칸
//   가운데  오늘 배송 예정
//   오른쪽  공지사항 · 수거요청
//
// ★ 섹터마다 다른 것은 '무엇을 세는가' 뿐입니다.
//   기공소는 접수·디자인·재스캔을 볼 이유가 없습니다 — 배정 전 단계라
//   목록에 뜨지도 않습니다. 대신 수거대기가 그 자리에 옵니다.
//   금액도 치과는 '이용', 기공소는 '판매' 로 방향이 반대입니다.
//
// ★ 아직 값이 없는 칸은 빈 상태로 둡니다.
//   금액은 정산(Sprint 8), 공지사항은 게시판(Sprint 9)이 서야 채워집니다.
//   숫자를 지어내느니 "없습니다" 가 낫습니다.
//
// ★ 세 칸의 **아래끝을 맞춥니다** (사용자 지적 2026-08-13 — "빈공간이
//   너무 많다, 열 맞춰줘"). 규칙이 둘입니다.
//
//   ① 카드에 `min-h-[…]` 를 박지 않습니다.
//      전에는 배송예정 400 · 공지 230 · 수거요청 300 · 추이 300 이
//      박혀 있었습니다. 값이 적은 치과에서는 그 숫자가 그대로 빈칸이
//      됩니다. 실제로 치과 HOME 이 745px 인데 오른쪽 칸은 544 에서
//      끝나 **201px 이 허공**이었습니다.
//
//   ② 칸마다 **늘어날 카드를 하나** 정해 남는 높이를 몰아 줍니다
//      (`flex-1`). 왼쪽은 추이, 가운데는 배송예정, 오른쪽은 수거요청.
//      그래야 카드 사이가 벌어지지 않고 세 칸이 같은 줄에서 끝납니다.
//
//   자리가 남는 것 자체는 못 없앱니다 — 오늘 나갈 게 세 건이면 그 카드는
//   빕니다. 다만 **빈 곳이 한 군데로 모이고 테두리가 어긋나지 않습니다.**
// =========================================================

import Link from 'next/link';
import { STATUS_LABEL, type OrderStatus, type Sector } from '@/server/domain/order-status';
import { ISSUE_META, type IssueType } from '@/server/domain/order-list';
import MoneyTrend from '@/components/home/MoneyTrend';
import { PICKUP_KIND_LABEL, PICKUP_STATUS_LABEL } from '@/lib/format/pickup';
import { WORK_LABEL, WORK_SECTORS, homeLeftLayout } from '@/server/domain/worklist';
import RetentionNudge from '@/components/home/RetentionNudge';
import StorageBar from '@/components/home/StorageBar';
import type { RetentionNudge as Nudge } from '@/server/repositories/retention';
import type { HomeSummary, HomePickup, HomeWork } from '@/server/repositories/home';

/** 섹터마다 세는 상태가 다릅니다 */
const STATUS_ROWS: Record<Sector, OrderStatus[]> = {
  clinic: ['rescan', 'received', 'designing', 'production_wait', 'production', 'shipping'],
  design_center: ['rescan', 'received', 'designing', 'production_wait', 'production', 'shipping'],
  // 기공소는 배정받은 뒤부터입니다. 앞 단계는 목록에 뜨지도 않습니다
  lab: ['production_wait', 'production', 'shipping'],
};

const ISSUE_ROWS: Record<Sector, IssueType[]> = {
  clinic: ['rescan', 'remake', 'repair', 'analog'],
  design_center: ['rescan', 'remake', 'repair', 'analog'],
  // 기공소는 재스캔을 겪지 않습니다 — 스캔은 치과와 디자인센터 사이의 일입니다
  lab: ['remake', 'repair', 'analog'],
};

/**
 * 금액 카드의 말.
 *
 * ★ 무엇을 세는지 카드에 적습니다 (사용자 결정 2026-08-12).
 *   치과는 **접수** 기준, 디자인센터·기공소는 **배송** 기준입니다.
 *   그래서 치과의 HOME 금액과 치과의 정산 금액은 **일부러 다릅니다** —
 *   하나는 넣은 것, 하나는 나간 것입니다. 안 적어 두면 "왜 다르냐" 는
 *   전화가 옵니다. 규칙은 domain/billing 의 moneyRange 에 있습니다.
 */
interface MoneyLabel {
  title: string;
  /** 물음표에 뜨는 말 */
  hint: string;
  /** 건수 앞에 붙는 말 — '접수 17건' */
  countLabel: string;
  trend: string;
  empty: string;
}

const MONEY_LABEL: Record<Sector, MoneyLabel> = {
  clinic: {
    title: '이용 금액',
    hint: '접수한 건을 기준으로 셉니다. 아직 안 나간 건도 들어 있어 정산서 금액과는 다릅니다',
    countLabel: '접수',
    trend: '사용금액 추이',
    empty: '최근 6개월 사용 내역이 없습니다.',
  },
  design_center: {
    title: '이용 금액',
    hint: '배송된 건을 기준으로 셉니다. 거래처마다 정산일이 달라 달력 월로 묶었습니다',
    countLabel: '배송',
    trend: '사용금액 추이',
    empty: '최근 6개월 사용 내역이 없습니다.',
  },
  lab: {
    title: '당월 판매금액',
    hint: '배송된 건을 기준으로 셉니다',
    countLabel: '배송',
    trend: '판매금액 추이',
    empty: '표시할 사용 내역이 없습니다.',
  },
};

/** '2026-07-26' → '07.26' — 카드 안에서는 연도가 군더더기입니다 */
function shortDate(iso: string): string {
  return iso.length >= 10 ? `${iso.slice(5, 7)}.${iso.slice(8, 10)}` : iso;
}

const HOME_PATH: Record<
  Sector,
  { deliveries: string; orders: string; billing: string; notices: string }
> = {
  clinic: {
    deliveries: '/clinic/deliveries',
    orders: '/clinic/orders',
    billing: '/clinic/billing',
    notices: '/clinic/notices',
  },
  design_center: {
    deliveries: '/design/deliveries',
    orders: '/design/orders',
    billing: '/design/billing',
    notices: '/design/notices',
  },
  lab: {
    deliveries: '/lab/shipments',
    orders: '/lab/orders',
    billing: '/lab/billing',
    notices: '/lab/notices',
  },
};

/** 계정정보가 어느 주소에 있는가 — 파기 화면이 그 아래입니다 */
const SECTOR_BASE: Record<Sector, string> = {
  clinic: '/clinic',
  design_center: '/design',
  lab: '/lab',
};

export interface HomeScreenProps {
  sector: Sector;
  summary: HomeSummary;
  /**
   * 파기 알림. 관리자가 아니거나 알릴 것이 없으면 null 입니다
   * (사용자 요청 2026-08-25).
   */
  retention?: Nudge | null;
  /**
   * 저장소가 몇 바이트 찼나. **센터 관리자에게만** 넘어옵니다
   * (사용자 요청 2026-08-25). 못 셌으면 null 입니다.
   */
  storageUsed?: number | null;
  /**
   * 금액을 볼 수 있는 사람인가 (관리자).
   *
   * ★ 사용자에게는 금액 카드와 추이가 **아예 없습니다**
   *   (사용자 결정 2026-08-12 — "금액나오는 곳만 안보이면 된다").
   *   가려 두거나 '-' 로 두면 "왜 안 보이냐" 를 묻습니다. 없는 것이 낫습니다.
   */
  canSeeMoney?: boolean;
}

export default function HomeScreen({
  sector,
  summary,
  canSeeMoney = true,
  retention = null,
  storageUsed = null,
}: HomeScreenProps) {
  const money = MONEY_LABEL[sector];
  const path = HOME_PATH[sector];

  /*
    ★ 치과는 '내 일' 목록을 안 세웁니다 (사용자 요청 2026-08-13).
      기다리는 쪽이라 진행중 상태 숫자와 주문목록으로 충분합니다.
  */
  const showWork = WORK_SECTORS.includes(sector);

  /*
    ★ 무엇을 세우고 누가 남는 높이를 가져가는지는 **규칙**이 정합니다
      (domain/worklist 의 homeLeftLayout). 화면 안에서 따지면 카드를
      하나 넣고 뺄 때마다 세 칸이 어긋납니다 — 실제로 그래서 옮겼습니다.
  */
  const { showTrend, workGrows, statusGrows } = homeLeftLayout(sector, canSeeMoney);

  /*
    ★★ 띠는 세 칸 **위**에 답니다. 칸 안에 넣으면 homeLeftLayout 이
      맞춰 둔 세 칸의 높이가 어긋납니다 — 카드 하나 넣고 뺄 때마다
      셋이 틀어지는 것을 겪어서 규칙으로 옮겨 둔 자리입니다.
  */
  return (
    <>
      {/*
        ★ 저장소가 먼저입니다. 가득 차면 업로드가 **멈추고**, 파기는
          늦어도 요금만 붙습니다 — 급한 것을 위에 둡니다.
      */}
      {storageUsed !== null && <StorageBar used={storageUsed} />}

      {retention && (
        <RetentionNudge nudge={retention} href={`${SECTOR_BASE[sector]}/account/retention`} />
      )}

      {/*
        ★ 화면 높이만큼 세웁니다 (사용자 지적 2026-08-15 — "home화면 아래
        비어잇는거 확인햇어").

        전에는 금액 추이가 왼쪽 칸을 길게 만들어 주어, 그 높이에 나머지
        두 칸이 따라 늘어났습니다. 추이를 빼자 **셋이 사이좋게 짧아져서**
        화면 아래가 남았습니다 — 칸끼리는 맞는데 화면을 안 채우는 상태라,
        '세 칸이 같은 줄에서 끝나는가' 만 보던 제 확인에 안 걸렸습니다.

      ★ 76px = 상단바 48 + 위아래 여백 14+14. 껍데기가 차지하는 만큼입니다.

      ★ **넓은 화면에서만** 겁니다. 좁은 화면은 카드가 세로로 쌓이는데,
        거기에 높이를 강제하면 카드 하나가 화면을 통째로 차지합니다.
      */}
      <div className="grid grid-cols-1 gap-3.5 lg:min-h-[calc(100vh-76px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* ================= 왼쪽 ================= */}
      <div className="flex flex-col gap-3.5">
        {canSeeMoney && (
        <Card>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">{money.title}</h2>
            <InfoDot title={money.hint} />
            <Link
              href={path.billing}
              aria-label="정산에서 자세히 보기"
              className="ml-auto text-[#98A2B3] hover:text-[#1279E8]"
            >
              <ExternalIcon />
            </Link>
          </div>

          <p className="mt-2.5 text-[26px] font-extrabold tracking-[-0.04em] tabular-nums text-[#1A2130]">
            ₩{summary.money.current.amount.toLocaleString('ko-KR')}
          </p>

          {/* ★ 구간과 건수를 같이 적습니다.
              금액만 있으면 '무엇을 센 건지' 를 물어보러 전화가 옵니다.
              구간이 07.26~08.25 로 보이면 정산일이 26일이라는 것도 같이 압니다 */}
          <p className="mt-1 text-[13px] text-[#98A2B3]">
            {summary.money.current.from ? (
              <>
                {shortDate(summary.money.current.from)} ~ {shortDate(summary.money.current.to)}
                <span className="mx-1.5 text-[#DDE2EA]">·</span>
                {money.countLabel} {summary.money.current.orderCount}건
              </>
            ) : (
              '아직 셀 것이 없습니다.'
            )}
          </p>

          {/* 단가를 안 정한 제품은 0원이 아니라 '미정' 입니다 — 조용히 빠지면 안 됩니다 */}
          {summary.money.current.unpricedCount > 0 && (
            <p className="mt-1.5 text-[12.5px] font-semibold text-[#B3312C]">
              단가를 안 정한 {summary.money.current.unpricedCount}건은 이 금액에 안 들어 있습니다.
            </p>
          )}
        </Card>
        )}

        <div className={'grid grid-cols-2 gap-3.5 ' + (statusGrows ? 'flex-1' : 'shrink-0')}>
          <Card>
            <h2 className="mb-3.5 text-[14px] font-bold tracking-tight text-[#1A2130]">
              진행중 상태
            </h2>

            {/* ★ 글자만이 아니라 줄 전체가 눌립니다.
                숫자를 보고 누르려는 사람이 많은데 글자만 링크면 헛손질합니다 */}
            <ul className="-mx-1.5 space-y-0.5">
              {STATUS_ROWS[sector].map((status) => (
                <li key={status}>
                  <Link
                    href={`${path.orders}?status=${status}`}
                    className="flex items-center rounded-md px-1.5 py-1.5 text-[14px] hover:bg-[#F4F6F9]"
                  >
                    {/* 기공소의 제작대기는 '수거대기' 가 앞에 오지만 지금은 같은 이름을 씁니다 */}
                    <span className="text-[#4A5567]">{STATUS_LABEL[status]}</span>
                    <b className="ml-auto font-bold tabular-nums text-[#1A2130]">
                      {summary.statusCounts[status] ?? 0}
                    </b>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3.5 text-[14px] font-bold tracking-tight text-[#1A2130]">
              진행중 이슈
            </h2>

            <ul className="-mx-1.5 space-y-0.5">
              {ISSUE_ROWS[sector].map((issue) => (
                <li key={issue}>
                  <Link
                    href={`${path.orders}?issue=${issue}`}
                    /* ★ 옆 칸(진행중 상태)과 같은 py 를 씁니다.
                       이슈는 줄 수가 적어 카드가 먼저 끝나는데, 여백까지
                       좁으면 그 차이가 더 벌어집니다 */
                    className="flex items-center rounded-md px-1.5 py-1.5 text-[14px] hover:bg-[#F4F6F9]"
                  >
                    <span
                      className="rounded-full px-2.5 py-1 text-[13px] font-semibold"
                      style={{ background: ISSUE_META[issue].bg, color: ISSUE_META[issue].fg }}
                    >
                      {ISSUE_META[issue].label}
                    </span>
                    <b className="ml-auto font-bold tabular-nums text-[#1A2130]">
                      {summary.issueCounts[issue] ?? 0}
                    </b>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/*
          ★ 세 섹터가 다 세웁니다 (사용자 결정 2026-08-13).
            금액을 못 보는 사용자에게는 이 카드가 남는 높이를 가져갑니다 —
            그래야 왼쪽 칸이 다른 두 칸과 같은 줄에서 끝납니다.
        */}
        {showWork && (
          <Worklist
            rows={summary.worklist}
            total={summary.worklist.length}
            ordersPath={path.orders}
            sector={sector}
            grow={workGrows}
          />
        )}

        {/*
          ★ 작업 리스트가 있는 자리(디자인센터·기공소)에서는 안 세웁니다
            (사용자 요청 2026-08-15). 그쪽은 이 화면을 일하려고 열고,
            매출 흐름은 정산·통계에서 제대로 봅니다.
            치과 관리자에게는 남습니다 — 빼면 왼쪽이 휑해집니다.
        */}
        {showTrend && (
          <MoneyTrend
            className="flex-1"
            title={money.trend}
            empty={money.empty}
            buckets={summary.money.trend}
            countLabel={money.countLabel}
          />
        )}
      </div>

      {/* ================= 가운데 — 오늘 배송 예정 ================= */}
      <Card>
        <div className="flex items-center">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">오늘 배송 예정</h2>
          <Link
            href={path.deliveries}
            className="ml-auto text-[13.5px] text-[#4A5567] hover:text-[#1279E8]"
          >
            배송 일정확인하러 가기 ›
          </Link>
        </div>

        {summary.todayDeliveries.length === 0 ? (
          <Empty>오늘 배송 예정인 케이스가 없습니다.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-[#F0F2F5]">
            {summary.todayDeliveries.map((row) => (
              <li key={row.id}>
                <Link
                  href={`${path.orders}/${row.id}`}
                  className="flex items-center gap-3 py-2.5 text-[14px] hover:bg-[#F8F9FB]"
                >
                  <span className="text-[#98A2B3]">{row.clinicName}</span>
                  <b className="font-semibold text-[#1A2130]">{row.patientLabel}</b>
                  <span className="ml-auto text-[13px] text-[#4A5567]">
                    {STATUS_LABEL[row.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ================= 오른쪽 ================= */}
      <div className="flex flex-col gap-3.5">
        <Card className="shrink-0">
          <div className="flex items-center">
            <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">공지사항</h2>
            <Link
              href={path.notices}
              className="ml-auto text-[13.5px] text-[#4A5567] hover:text-[#1279E8]"
            >
              전체보기 ›
            </Link>
          </div>

          {/* ★ 제목만 보여 주고 본문은 게시판에서 읽습니다.
              카드에 본문까지 펴면 공지 두 건에 카드가 화면을 채웁니다 */}
          {summary.notices.length === 0 ? (
            <Empty className="py-9">등록된 공지가 없습니다.</Empty>
          ) : (
            <ul className="-mx-1.5 mt-2">
              {summary.notices.map((notice) => (
                <li key={notice.id}>
                  <Link
                    href={path.notices}
                    className="flex items-baseline gap-2 rounded px-1.5 py-[7px] hover:bg-[#F4F8FE]"
                  >
                    {notice.isPinned && (
                      <span className="shrink-0 text-[11px] font-bold text-[#D8453F]">고정</span>
                    )}
                    {notice.publishedAt === null && (
                      <span className="shrink-0 text-[11px] font-bold text-[#98A2B3]">임시</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-[#1A2130]">
                      {notice.title}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[#C4CBD6]">
                      {(notice.publishedAt ?? notice.createdAt).slice(5, 10)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex-1">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">수거요청</h2>

          <div className="mt-3.5 grid shrink-0 grid-cols-[1fr_0.72fr_0.72fr] gap-2 border-b border-[#E8EBF0] pb-2.5 text-[13px] text-[#98A2B3]">
            <span>치과명</span>
            <span>요청시한</span>
            <span>상태</span>
          </div>

          {summary.pickups.length === 0 ? (
            <Empty>데이터가 없습니다.</Empty>
          ) : (
            <ul className="-mx-1.5 divide-y divide-[#F0F2F5]">
              {summary.pickups.map((row) => (
                <li key={row.id}>
                  {/*
                    ★ 눌러서 그 주문을 엽니다 (사용자 요청 2026-08-13).
                      요청사항 한 줄을 좁은 칸에 욱여넣는 대신, 무엇을
                      가져가는지·왜인지는 주문상세에서 온전히 봅니다.
                      여기서는 마우스를 올리면 미리 보입니다.
                  */}
                  <PickupRow
                    row={row}
                    href={row.orderId ? `${path.orders}/${row.orderId}` : null}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      </div>
    </>
  );
}

// ---------- 수거요청 한 줄 ----------

/**
 * ★ 상태 글자가 꼭 필요합니다 (2026-08-13).
 *   '배송 전까지 남긴다' 로 바꾼 순간, 이미 가져간 건도 카드에 남습니다.
 *   상태를 안 적으면 목록이 "아직 안 가져갔다" 는 거짓말을 합니다.
 */
function PickupRow({ row, href }: { row: HomePickup; href: string | null }) {
  const title =
    `${PICKUP_KIND_LABEL[row.kind] ?? row.kind} 수거` +
    (row.memo ? ` · ${row.memo}` : '');

  const body = (
    <>
      <span className="truncate text-[#4A5567]">{row.clinicName}</span>
      <span className="tabular-nums text-[#4A5567]">{row.dueDate}</span>
      <span
        className={
          'truncate text-[12.5px] font-semibold ' +
          (row.waiting ? 'text-[#C77700]' : 'text-[#98A2B3]')
        }
      >
        {PICKUP_STATUS_LABEL[row.status] ?? row.status}
      </span>
    </>
  );

  const shape =
    'grid grid-cols-[1fr_0.72fr_0.72fr] items-center gap-2 rounded px-1.5 py-2.5 text-[13.5px]';

  if (!href) {
    return (
      <div className={shape} title={title}>
        {body}
      </div>
    );
  }

  return (
    <Link href={href} title={title} className={`${shape} hover:bg-[#F4F8FE]`}>
      {body}
    </Link>
  );
}

// ---------- '내 일' 목록 (세 섹터 공통) ----------

/** 카드에 보여 줄 줄 수. 넘치면 '외 N건' 으로 접습니다 */
const WORKLIST_SHOWN = 6;

/**
 * 지금 내 손에 있는 주문.
 *
 * ★ **세 섹터가 다 씁니다** (사용자 결정 2026-08-13).
 *   전에는 디자인센터에만 있었습니다. 그래서 사용자 계정으로 들어가면
 *   왼쪽 칸에 카드가 하나뿐이라 관리자 화면의 절반도 안 되는 페이지가
 *   됐습니다 — 재 보니 327px 대 766px 이었습니다. 이제 어느 계정으로
 *   들어와도 왼쪽 칸 맨 아래에 **같은 모양의 목록**이 섭니다.
 *
 * ★ 표의 틀은 넷으로 고정입니다. 섹터마다 **머리말 두 개만** 바뀝니다.
 *   틀까지 갈리면 계정을 옮길 때마다 눈이 다시 자리를 찾아야 합니다.
 *
 * ★ 무엇이 오르고 누가 임자인지는 domain/worklist 가 정합니다
 *   (WORK_STATUSES · ownerOf). 치과는 넣은 사람, 디자인센터는 디자인을
 *   잡은 사람, 기공소는 임자가 없습니다 — 조직이 통째로 받으니까요.
 *
 * ★ '경과' 의 뜻도 섹터마다 다릅니다.
 *   디자인센터만 **잡은 지 며칠째**이고, 나머지는 **요청시한을 며칠
 *   지났나**입니다. 치과·기공소에는 '잡은 순간' 이 없습니다.
 */
const WORK_COLUMNS = 'grid-cols-[1fr_1.2fr_0.9fr_0.6fr]';

function Worklist({
  rows,
  ordersPath,
  sector,
  total,
  grow,
}: {
  rows: HomeWork[];
  ordersPath: string;
  sector: Sector;
  /** 접기 전 전체 건수 */
  total: number;
  /** 왼쪽 칸에서 남는 높이를 가져갈 것인가 */
  grow?: boolean;
}) {
  const shown = rows.slice(0, WORKLIST_SHOWN);
  const label = WORK_LABEL[sector];
  const design = sector === 'design_center';

  return (
    <Card className={grow ? 'flex-1' : 'shrink-0'}>
      <div className="flex items-center">
        <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">{label.title}</h2>
        <span className="ml-auto text-[13px] text-[#98A2B3]">{total}건</span>
      </div>

      <div
        className={`mt-3 grid ${WORK_COLUMNS} gap-2 border-b border-[#E8EBF0] pb-2 text-[13px] text-[#98A2B3]`}
      >
        {/* ★ 치과에는 치과명 칸이 쓸모없습니다 — 모든 줄이 자기 치과입니다 */}
        <span>{sector === 'clinic' ? '상태' : '치과명'}</span>
        <span>환자정보</span>
        <span>{design ? '디자이너' : '요청시한'}</span>
        <span className="text-right">경과</span>
      </div>

      {shown.length === 0 ? (
        <Empty className="py-8">{label.empty}</Empty>
      ) : (
        <ul className="-mx-1.5">
          {shown.map((row) => (
            <li key={row.id}>
              <Link
                href={`${ordersPath}/${row.id}`}
                title={
                  design
                    ? `${row.startedOn || '?'} 에 잡음 · 요청시한 ${row.dueDate}`
                    : `요청시한 ${row.dueDate}`
                }
                className={`grid ${WORK_COLUMNS} items-center gap-2 rounded px-1.5 py-[7px] text-[13.5px] hover:bg-[#F4F8FE]`}
              >
                <span className="truncate text-[#4A5567]">
                  {sector === 'clinic' ? STATUS_LABEL[row.status] : row.clinicName}
                </span>
                <span className="truncate font-semibold text-[#1A2130]">{row.patientLabel}</span>
                <span className="truncate tabular-nums text-[#4A5567]">
                  {design ? (
                    row.designerName || <span className="text-[#C4CBD6]">미상</span>
                  ) : (
                    row.dueDate.slice(5)
                  )}
                </span>

                <Elapsed days={row.dayCount} design={design} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > shown.length && (
        <Link
          href={ordersPath}
          className="mt-1.5 block text-[13px] text-[#4A5567] hover:text-[#1279E8]"
        >
          외 {total - shown.length}건 더 보기 ›
        </Link>
      )}
    </Card>
  );
}

/**
 * 오른쪽 끝 '경과' 칸.
 *
 * ★ 하루 넘긴 건은 눈에 띄어야 합니다. 오늘 잡은 것과 나흘째인 것이
 *   같아 보이면 목록이 소용없습니다.
 *
 * ★ 치과·기공소는 **시한을 안 넘겼으면 아무 말도 안 합니다.**
 *   '0일 지남' 은 지났다는 말처럼 읽힙니다.
 */
function Elapsed({ days, design }: { days: number; design: boolean }) {
  const hot = design ? days >= 3 : days >= 1;
  const warm = design ? days >= 2 : days >= 1;

  return (
    <span
      className={
        'truncate text-right tabular-nums ' +
        (hot
          ? 'font-bold text-[#D8453F]'
          : warm
            ? 'font-semibold text-[#C77700]'
            : 'text-[#98A2B3]')
      }
    >
      {design ? `${days}일째` : days > 0 ? `${days}일 지남` : '–'}
    </span>
  );
}

// ---------- 조각들 ----------

function Card({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  /*
    ★ 카드는 세로 flex 입니다.
      그래야 카드 안에서 '남는 높이를 가져갈 것' 을 고를 수 있습니다.
      목록은 위에 붙어 있고, 빈 상태만 가운데로 옵니다.
  */
  return (
    <section
      className={
        'flex flex-col rounded-lg border border-[#E8EBF0] bg-white px-5 py-4 ' + className
      }
    >
      {children}
    </section>
  );
}

/**
 * 값이 없을 때의 한 줄.
 *
 * ★ **남는 높이를 다 먹고 그 한가운데** 섭니다 (`flex-1` + `place-items-center`).
 *   전에는 `py-16`·`py-20` 처럼 여백을 숫자로 박아 뒀는데, 카드가 그보다
 *   커지면 글자가 위에 붙고 아래가 통째로 비었습니다.
 *
 * ★ 목록은 반대입니다 — 위에 붙습니다.
 *   세 줄짜리 목록을 카드 한가운데 띄우면 읽는 자리가 매번 달라집니다.
 */
function Empty({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={'grid flex-1 place-items-center text-center text-[14px] text-[#98A2B3] ' + className}>
      {children}
    </p>
  );
}

function InfoDot({ title }: { title: string }) {
  return (
    <span
      title={title}
      className="grid h-[15px] w-[15px] cursor-help place-items-center rounded-full border border-[#C4CBD6] text-[9px] font-bold text-[#98A2B3]"
    >
      i
    </span>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 3h6v6M17 3l-8 8M15 12v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 2 16.5v-10A1.5 1.5 0 0 1 3.5 5H8" />
    </svg>
  );
}
