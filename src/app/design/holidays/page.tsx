// =========================================================
// 놓을 위치: src/app/design/holidays/page.tsx
//
// 휴일 관리. 여기 있는 날은 요청시한 달력에서 빠집니다.
//
// ★ 표는 하나이고 디자인센터가 쥡니다.
//   쉬는 날은 '만드는 곳이 쉬는 날' 입니다 — 그날은 물건이 안 나갑니다.
//   치과·기공소는 달력에서 결과만 봅니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { listHolidays } from '@/server/repositories/holiday';
import { todayInKst } from '@/server/domain/week';
import HolidayTable from '@/components/holiday/HolidayTable';

export const dynamic = 'force-dynamic';

/** 고르개에 띄울 범위 — 작년부터 5년 뒤까지 */
const BACK = 1;
const AHEAD = 5;

export default async function DesignHolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireManagerSector('design_center');

  const thisYear = Number(todayInKst().slice(0, 4));
  const { year: raw } = await searchParams;

  const asked = Number(raw);
  const year = Number.isInteger(asked) && asked > 2000 && asked < 2100 ? asked : thisYear;

  const rows = await listHolidays(year, year);
  const years = Array.from({ length: BACK + AHEAD + 1 }, (_, i) => thisYear - BACK + i);

  return (
    <div className="mx-auto max-w-[900px]">
      <HolidayTable year={year} rows={rows} years={years} />
      <div className="pb-10" />
    </div>
  );
}
