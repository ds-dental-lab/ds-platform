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
// =========================================================

import Link from 'next/link';
import { STATUS_LABEL, type OrderStatus, type Sector } from '@/server/domain/order-status';
import { ISSUE_META, type IssueType } from '@/server/domain/order-list';
import type { HomeSummary } from '@/server/repositories/home';

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

const MONEY_LABEL: Record<Sector, { title: string; trend: string; empty: string }> = {
  clinic: {
    title: '이용 금액',
    trend: '사용금액 추이',
    empty: '최근 6개월 사용 내역이 없습니다.',
  },
  design_center: {
    title: '이용 금액',
    trend: '사용금액 추이',
    empty: '최근 6개월 사용 내역이 없습니다.',
  },
  lab: {
    title: '당월 판매금액',
    trend: '판매금액 추이',
    empty: '표시할 사용 내역이 없습니다.',
  },
};

const HOME_PATH: Record<Sector, { deliveries: string; orders: string }> = {
  clinic: { deliveries: '/clinic/deliveries', orders: '/clinic/orders' },
  design_center: { deliveries: '/design/deliveries', orders: '/design/orders' },
  lab: { deliveries: '/lab/shipments', orders: '/lab/orders' },
};

export interface HomeScreenProps {
  sector: Sector;
  summary: HomeSummary;
  /** 디자인센터는 진행 중 작업 목록을 왼쪽 아래에 세웁니다 */
  showWorklist?: boolean;
}

export default function HomeScreen({ sector, summary, showWorklist }: HomeScreenProps) {
  const money = MONEY_LABEL[sector];
  const path = HOME_PATH[sector];

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* ================= 왼쪽 ================= */}
      <div className="space-y-3.5">
        <Card>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">{money.title}</h2>
            <InfoDot title="배송된 건을 기준으로 셉니다" />
            <Link
              href={path.orders}
              aria-label="자세히 보기"
              className="ml-auto text-[#98A2B3] hover:text-[#1279E8]"
            >
              <ExternalIcon />
            </Link>
          </div>

          <p className="mt-2.5 text-[26px] font-extrabold tracking-[-0.04em] text-[#1A2130]">
            ₩0
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3.5">
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
                    className="flex items-center rounded-md px-1.5 py-1.5 text-[13px] hover:bg-[#F4F6F9]"
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
                    className="flex items-center rounded-md px-1.5 py-1 text-[13px] hover:bg-[#F4F6F9]"
                  >
                    <span
                      className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
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

        {/* 디자인센터는 작업 리스트, 나머지는 금액 추이 */}
        {showWorklist ? (
          <Card className="min-h-[220px]">
            <div className="flex items-center">
              <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">작업 리스트</h2>
              <span className="ml-auto text-[12px] text-[#98A2B3]">0건</span>
            </div>

            <div className="mt-3 grid grid-cols-4 border-b border-[#E8EBF0] pb-2 text-[12px] text-[#98A2B3]">
              <span>치과명</span>
              <span>환자정보</span>
              <span>디자이너</span>
              <span>상태</span>
            </div>

            <Empty className="py-14">진행 중인 작업이 없습니다.</Empty>
          </Card>
        ) : (
          <Card className="min-h-[300px]">
            <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">{money.trend}</h2>
            <Empty className="py-24">{money.empty}</Empty>
          </Card>
        )}
      </div>

      {/* ================= 가운데 — 오늘 배송 예정 ================= */}
      <Card className="min-h-[400px]">
        <div className="flex items-center">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">오늘 배송 예정</h2>
          <Link
            href={path.deliveries}
            className="ml-auto text-[12.5px] text-[#4A5567] hover:text-[#1279E8]"
          >
            배송 일정확인하러 가기 ›
          </Link>
        </div>

        {summary.todayDeliveries.length === 0 ? (
          <Empty className="py-16">오늘 배송 예정인 케이스가 없습니다.</Empty>
        ) : (
          <ul className="mt-3 divide-y divide-[#F0F2F5]">
            {summary.todayDeliveries.map((row) => (
              <li key={row.id}>
                <Link
                  href={`${path.orders}/${row.id}`}
                  className="flex items-center gap-3 py-2.5 text-[13px] hover:bg-[#F8F9FB]"
                >
                  <span className="text-[#98A2B3]">{row.clinicName}</span>
                  <b className="font-semibold text-[#1A2130]">{row.patientLabel}</b>
                  <span className="ml-auto text-[12px] text-[#4A5567]">
                    {STATUS_LABEL[row.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ================= 오른쪽 ================= */}
      <div className="space-y-3.5">
        <Card className="min-h-[230px]">
          <div className="flex items-center">
            <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">공지사항</h2>
            <span className="ml-auto text-[12.5px] text-[#4A5567]">전체보기 ›</span>
          </div>
          <Empty className="py-16">등록된 공지가 없습니다.</Empty>
        </Card>

        <Card className="min-h-[300px]">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">수거요청</h2>

          <div className="mt-3.5 grid grid-cols-3 border-b border-[#E8EBF0] pb-2.5 text-[12px] text-[#98A2B3]">
            <span>치과명</span>
            <span>요청시한</span>
            <span>요청사항</span>
          </div>

          {summary.pickups.length === 0 ? (
            <Empty className="py-20">데이터가 없습니다.</Empty>
          ) : (
            <ul className="divide-y divide-[#F0F2F5]">
              {summary.pickups.map((row) => (
                <li key={row.id} className="grid grid-cols-3 gap-2 py-2.5 text-[12.5px]">
                  <span className="truncate text-[#4A5567]">{row.clinicName}</span>
                  <span className="tabular-nums text-[#4A5567]">{row.dueDate}</span>
                  <span className="truncate text-[#98A2B3]">{row.memo}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
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
  return (
    <section
      className={'rounded-lg border border-[#E8EBF0] bg-white px-5 py-4 ' + className}
    >
      {children}
    </section>
  );
}

function Empty({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={'text-center text-[13px] text-[#98A2B3] ' + className}>{children}</p>
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
