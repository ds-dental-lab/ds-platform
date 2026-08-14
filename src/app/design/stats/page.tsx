// =========================================================
// 놓을 위치: src/app/design/stats/page.tsx
//
// 관리 통계 (초안). 디자인센터만 들어옵니다.
//
// ★ 원장은 order_status_history 입니다. 집계표를 따로 안 만듭니다 —
//   주문이 고쳐질 때마다 어긋납니다. 느려지면 그때 굳히면 됩니다.
//
// ★ 접수일로 자릅니다.
//   '그 달에 들어온 일' 이 이 화면이 묻는 것입니다. 정산(배송일)과는
//   다른 잣대라, 화면에 그렇게 적어 뒀습니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { getDesignStats } from '@/server/repositories/stats';
import { todayInKst } from '@/server/domain/week';
import { periodRange, isValidYearMonth, prevYearMonth, yearMonthOf } from '@/server/domain/billing';
import StatsScreen from '@/components/stats/StatsScreen';
import { getReasonRows } from '@/server/repositories/remake-reason';
import { tallyReasons } from '@/server/domain/remake-reason';

export const dynamic = 'force-dynamic';

/** 고르개에 띄울 달 수 */
const MONTHS = 4;

export default async function DesignStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireManagerSector('design_center');

  const thisMonth = yearMonthOf(todayInKst());
  const { month: raw } = await searchParams;
  const month = raw && isValidYearMonth(raw) ? raw : thisMonth;

  // 달력 월로 봅니다 — 거래처마다 다른 정산 기준일과 섞으면 뜻이 흐려집니다
  const { from, to } = periodRange(month, 1);

  /*
    ★ 사유는 **적은 날**로 자릅니다 (repositories/remake-reason).
      접수일로 자르면 지난달 건에 오늘 사유를 달았을 때 이번달 표에서
      사라집니다 — 적어 놓고 안 보이면 아무도 다시 안 적습니다.
      그래서 위 접수일 기준과 잣대가 다릅니다. 화면에도 그렇게 적어 뒀습니다.
  */
  const [stats, reasonRows] = await Promise.all([
    getDesignStats(from, to),
    getReasonRows(from, to),
  ]);

  const reasons = tallyReasons(reasonRows);

  const months: { value: string; label: string }[] = [];
  let cursor = thisMonth;

  for (let i = 0; i < MONTHS; i++) {
    months.unshift({ value: cursor, label: `${Number(cursor.slice(5))}월` });
    cursor = prevYearMonth(cursor);
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <StatsScreen stats={stats} reasons={reasons} months={months} month={month} />
      <div className="pb-10" />
    </div>
  );
}
