// =========================================================
// 놓을 위치: src/components/order/OrderListScreen.tsx
//
// 주문목록 화면 한 벌. (기능명세서 §4.3)
//
// ★ 세 섹터가 같은 화면을 씁니다.
//   무엇이 보이는지는 RLS 와 repositories 가 정합니다 —
//   치과에는 기공소명이 아예 안 내려오고, 기공소에는 환자명이 마스킹됩니다.
//   그래서 여기서는 경로와 '기공소 열을 쓸지'만 받습니다.
// =========================================================

import { listOrderPage } from '@/server/repositories/order-list';
import { unreadChatByOrder } from '@/server/repositories/notification';
import {
  rangeStart,
  isSortable,
  parseFilterList,
  filterListToParam,
  statusesForSector,
  ISSUE_ORDER,
  RANGE_PRESETS,
  type RangePreset,
  type SortColumn,
} from '@/server/domain/order-list';
import { todayInKst, isValidIsoDate } from '@/server/domain/week';
import OrderQuickFilters from '@/components/order/OrderQuickFilters';
import OrderSearchBar from '@/components/order/OrderSearchBar';
import OrderTable from '@/components/order/OrderTable';
import OrderPager from '@/components/order/OrderPager';

export interface OrderListScreenProps {
  title: string;
  basePath: string;
  orderPath: string;
  /** 치과는 false — 기공소명이 내려오지 않습니다 (설계서 §8.5) */
  showLab: boolean;
  /** 치과는 false — 자기 치과뿐이라 검색할 게 없습니다 */
  showClinicSearch: boolean;
  /** 어느 섹터의 목록인가. 상태 아이콘을 고르는 데 씁니다 */
  sector: 'clinic' | 'design_center' | 'lab';
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function OrderListScreen({
  title,
  basePath,
  orderPath,
  showLab,
  showClinicSearch,
  sector,
  searchParams,
}: OrderListScreenProps) {
  const today = todayInKst();
  const q = readParams(searchParams, today, sector);

  // 안 읽은 대화 뱃지(💬)는 목록과 무관하니 나란히 물어봅니다
  const [result, unreadChat] = await Promise.all([
    listOrderPage({
      from: q.from,
      to: q.to,
      clinic: q.clinic,
      patient: q.patient,
      statuses: q.statuses,
      issues: q.issues,
      sort: q.sort,
      dir: q.dir,
      page: q.page,
      perPage: 10,
    }),
    unreadChatByOrder(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">{title}</h1>

      {/* 검색줄과 아이콘 필터는 시안에서 한 카드입니다 (.listbar) */}
      <div className="mt-4">
        <OrderSearchBar
          basePath={basePath}
          params={q.raw}
          range={q.range}
          from={q.rawFrom}
          to={q.rawTo}
          shownFrom={q.from ?? ''}
          shownTo={q.to ?? today}
          clinic={q.clinic}
          patient={q.patient}
          showClinicSearch={showClinicSearch}
        >
          <div className="mt-3.5">
            <OrderQuickFilters
              basePath={basePath}
              params={q.raw}
              statuses={q.statuses}
              issues={q.issues}
              statusCounts={result.statusCounts}
              issueCounts={result.issueCounts}
              sector={sector}
            />
          </div>
        </OrderSearchBar>
      </div>

      {result.truncated && (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-2.5 text-[14px] text-amber-800">
          주문이 많아 최근 것부터 일부만 불러왔습니다. 기간을 좁혀 주세요.
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <OrderTable
          rows={result.rows}
          today={today}
          basePath={basePath}
          orderPath={orderPath}
          params={q.raw}
          sort={q.sort}
          dir={q.dir}
          showLab={showLab}
          unreadChat={unreadChat}
          /* ★ 📷 는 치과 목록에만 — 사진을 찍는 건 진료실입니다 (2026-09-06) */
          shadeShortcut={sector === 'clinic'}
        />

        <OrderPager
          basePath={basePath}
          params={q.raw}
          page={result.page}
          pages={result.pages}
          total={result.total}
        />
      </div>

      <div className="pb-10" />
    </div>
  );
}

/**
 * 주소에 붙은 조건을 읽습니다.
 *
 * ★ 값을 그대로 믿지 않습니다. 정렬 열 이름은 화이트리스트로 거르고,
 *   날짜는 형식을 확인합니다. 주소는 사용자가 직접 고칠 수 있습니다.
 */
function readParams(
  searchParams: Record<string, string | string[] | undefined>,
  today: string,
  sector: 'clinic' | 'design_center' | 'lab',
) {
  const one = (key: string): string => {
    const v = searchParams[key];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };

  const rangeRaw = one('range');
  const range: RangePreset = (RANGE_PRESETS as string[]).includes(rangeRaw)
    ? (rangeRaw as RangePreset)
    : '1년';

  const rawFrom = one('from');
  const rawTo = one('to');

  // 직접 넣은 날짜가 있으면 그것이 우선입니다
  const hasCustom = isValidIsoDate(rawFrom) || isValidIsoDate(rawTo);

  const from = hasCustom
    ? isValidIsoDate(rawFrom)
      ? rawFrom
      : null
    : rangeStart(range, today);

  const to = hasCustom && isValidIsoDate(rawTo) ? rawTo : null;

  /* ★ 여러 개를 고를 수 있습니다 (`?status=production_wait,production`).
       값 하나짜리 옛 주소도 그대로 읽힙니다 — HOME 카드가 아직 그렇게 보냅니다.

     ★ **그 섹터의 아이콘에 있는 상태만** 받습니다.
       기공소 목록에는 접수·디자인 아이콘이 없습니다. 주소로 `status=received`
       가 들어오면 켤 수도 끌 수도 없는 필터가 걸려, 빈 목록을 보면서
       왜 비었는지 알 길이 없습니다. **끌 수 있는 것만 켜집니다.** */
  const statuses = parseFilterList(
    one('status'),
    statusesForSector(sector).map(({ status }) => status),
  );
  const issues = parseFilterList(one('issue'), ISSUE_ORDER);

  const sortRaw = one('sort');
  const sort: SortColumn = isSortable(sortRaw) ? sortRaw : 'received_at';

  const dir: 1 | -1 = one('dir') === '1' ? 1 : -1;

  const pageRaw = Number(one('page'));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  // 링크를 만들 때 쓸 원본. 걸러진 값만 남깁니다.
  const raw: Record<string, string> = {};
  if (range !== '1년') raw.range = range;
  if (isValidIsoDate(rawFrom)) raw.from = rawFrom;
  if (isValidIsoDate(rawTo)) raw.to = rawTo;
  if (one('clinic')) raw.clinic = one('clinic');
  if (one('patient')) raw.patient = one('patient');
  if (statuses.length > 0) raw.status = filterListToParam(statuses);
  if (issues.length > 0) raw.issue = filterListToParam(issues);
  if (sortRaw && isSortable(sortRaw)) raw.sort = sort;
  if (one('dir')) raw.dir = String(dir);

  return {
    range,
    from,
    to,
    rawFrom: isValidIsoDate(rawFrom) ? rawFrom : '',
    rawTo: isValidIsoDate(rawTo) ? rawTo : '',
    clinic: one('clinic'),
    patient: one('patient'),
    statuses,
    issues,
    sort,
    dir,
    page,
    raw,
  };
}
