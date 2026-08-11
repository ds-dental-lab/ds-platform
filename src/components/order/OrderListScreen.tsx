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
import {
  rangeStart,
  isSortable,
  ISSUE_ORDER,
  RANGE_PRESETS,
  type IssueType,
  type RangePreset,
  type SortColumn,
} from '@/server/domain/order-list';
import { STATUS_ORDER, type OrderStatus } from '@/server/domain/order-status';
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
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function OrderListScreen({
  title,
  basePath,
  orderPath,
  showLab,
  showClinicSearch,
  searchParams,
}: OrderListScreenProps) {
  const today = todayInKst();
  const q = readParams(searchParams, today);

  const result = await listOrderPage({
    from: q.from,
    to: q.to,
    clinic: q.clinic,
    patient: q.patient,
    status: q.status,
    issue: q.issue,
    sort: q.sort,
    dir: q.dir,
    page: q.page,
    perPage: 10,
  });

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
          clinic={q.clinic}
          patient={q.patient}
          showClinicSearch={showClinicSearch}
        >
          <div className="mt-3.5">
            <OrderQuickFilters
              basePath={basePath}
              params={q.raw}
              status={q.status}
              issue={q.issue}
              statusCounts={result.statusCounts}
              issueCounts={result.issueCounts}
            />
          </div>
        </OrderSearchBar>
      </div>

      {result.truncated && (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
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

  const statusRaw = one('status');
  const status: OrderStatus | null = (STATUS_ORDER as string[]).includes(statusRaw)
    ? (statusRaw as OrderStatus)
    : null;

  const issueRaw = one('issue');
  const issue: IssueType | null = (ISSUE_ORDER as string[]).includes(issueRaw)
    ? (issueRaw as IssueType)
    : null;

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
  if (status) raw.status = status;
  if (issue) raw.issue = issue;
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
    status,
    issue,
    sort,
    dir,
    page,
    raw,
  };
}
