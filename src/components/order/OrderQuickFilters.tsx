// =========================================================
// 놓을 위치: src/components/order/OrderQuickFilters.tsx
//
// 주문목록 아이콘 필터. (기능명세서 §4.3, 시안 .statfilter / .sicon)
//
// 배치 — 상태는 왼쪽, **이슈는 오른쪽 끝**입니다.
//   시안의 `.statfilter.issues { margin-left:auto }` 를 옮긴 것으로,
//   "지금 어디까지 왔나"와 "무슨 일이 있었나"를 눈으로 갈라 놓습니다.
//
// 모양 — 테두리 없는 버튼입니다. 아이콘 위, 글자 아래.
//   켜지면 옅은 파란 배경이 깔리고 아이콘·글자가 그 상태의 색을 씁니다.
//   배지는 우상단에 흰 테두리를 두르고 붙습니다.
//
// ★ 배지 숫자는 상태·이슈 선택을 뺀 나머지 조건으로 셉니다.
//   고른 상태만 세면 다른 아이콘이 전부 0이 되어 옮겨 갈 수가 없습니다.
// =========================================================

import Link from 'next/link';
import { STATUS_LABEL, type OrderStatus } from '@/server/domain/order-status';
import {
  statusesForSector,
  SECTOR_COLOR,
  ISSUE_META,
  ISSUE_ORDER,
  sectorOfStatus,
  type IssueType,
} from '@/server/domain/order-list';

// 아이콘은 시안(SICON)을 그대로 옮겼습니다. 원·선이 섞여 있어 요소로 둡니다.

const RESCAN_ICON = (
  <>
    <path d="M20 12a8 8 0 1 1-2.5-5.8" />
    <path d="M20 2.5V8h-5.5" />
  </>
);

const STATUS_ICON: Record<OrderStatus, React.ReactNode> = {
  rescan: RESCAN_ICON,
  received: (
    <>
      <path d="M15.5 3.5 20 8 9 19H4.5v-4.5z" />
      <path d="M13.5 5.5 18 10" />
    </>
  ),
  designing: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
    </>
  ),
  production_wait: (
    <>
      <path d="M6.5 3h11M6.5 21h11" />
      <path d="M8 3v3.5c0 2 4 3.6 4 5.5s-4 3.5-4 5.5V21M16 3v3.5c0 2-4 3.6-4 5.5s4 3.5 4 5.5V21" />
    </>
  ),
  production: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </>
  ),
  shipping: (
    <>
      <path d="M2 6.5h11v10H2zM13 9.5h4l4 3v4h-8z" />
      <circle cx="6" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
    </>
  ),
  completed: <path d="M4 12.5 9.5 18 20 6.5" />,
  cancelled: <path d="M6 6l12 12M18 6 6 18" />,
};

const ISSUE_ICON: Record<IssueType, React.ReactNode> = {
  rescan: RESCAN_ICON,
  remake: (
    <>
      <path d="M4 7.5h11a5 5 0 0 1 0 10H7" />
      <path d="M7.5 14 4 17.5 7.5 21" />
    </>
  ),
  repair: (
    <path d="M15.5 3.5a5 5 0 0 0-6.2 6.8L3.5 16v4.5H8l5.7-5.8a5 5 0 0 0 6.8-6.2l-3 3-2.8-2.8z" />
  ),
  analog: <path d="M12 3v18M5 8h14M5 16h14" />,
};

export interface OrderQuickFiltersProps {
  basePath: string;
  params: Record<string, string>;
  status: OrderStatus | null;
  issue: IssueType | null;
  statusCounts: Record<string, number>;
  issueCounts: Record<string, number>;
  /** 어느 섹터의 목록인가. 기공소는 앞 단계 상태를 세우지 않습니다 */
  sector: 'clinic' | 'design_center' | 'lab';
}

export default function OrderQuickFilters({
  basePath,
  params,
  status,
  issue,
  statusCounts,
  issueCounts,
  sector,
}: OrderQuickFiltersProps) {
  /** 아이콘을 눌렀을 때 갈 주소. 이미 켜져 있으면 끕니다 */
  function hrefFor(key: 'status' | 'issue', value: string, active: boolean): string {
    const next = new URLSearchParams(params);

    if (active) next.delete(key);
    else next.set(key, value);

    next.delete('page'); // 필터가 바뀌면 1쪽으로
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="flex flex-wrap items-start gap-y-2 border-t border-gray-200 pt-3.5">
      {/* 상태 — 왼쪽 */}
      <div className="flex flex-wrap gap-0.5">
        {statusesForSector(sector).map(({ status: s }) => (
          <IconButton
            key={s}
            href={hrefFor('status', s, status === s)}
            label={STATUS_LABEL[s]}
            icon={STATUS_ICON[s]}
            color={SECTOR_COLOR[sectorOfStatus(s)].color}
            count={statusCounts[s] ?? 0}
            active={status === s}
            title={`${SECTOR_COLOR[sectorOfStatus(s)].label} 단계`}
          />
        ))}
      </div>

      {/* 이슈 — 오른쪽 끝 (시안 .statfilter.issues) */}
      <div className="ml-auto flex flex-wrap gap-0.5">
        {ISSUE_ORDER.map((i) => (
          <IconButton
            key={i}
            href={hrefFor('issue', i, issue === i)}
            label={ISSUE_META[i].label}
            icon={ISSUE_ICON[i]}
            color={ISSUE_META[i].fg}
            count={issueCounts[i] ?? 0}
            active={issue === i}
          />
        ))}
      </div>
    </div>
  );
}

function IconButton({
  href,
  label,
  icon,
  color,
  count,
  active,
  title,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  count: number;
  active: boolean;
  title?: string;
}) {
  // 0건이면 아이콘과 글자만 옅게. 누를 수는 있습니다
  const faded = count === 0 && !active;

  return (
    <Link
      href={href}
      title={title}
      aria-pressed={active}
      className={
        'relative flex min-w-[68px] flex-col items-center gap-1.5 rounded-lg px-1 pb-1 pt-1.5 transition-colors ' +
        (active ? 'bg-[#EDF3FE]' : 'hover:bg-[#F4F6F9]')
      }
    >
      <span
        className={'grid h-[26px] w-[26px] place-items-center ' + (faded ? 'opacity-45' : '')}
        style={{ color: active ? color : '#8B94A3' }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>

      <span
        className={'whitespace-nowrap text-[12px] font-semibold ' + (faded ? 'opacity-45' : '')}
        style={{ color: active ? color : '#4A5567' }}
      >
        {label}
      </span>

      {count > 0 && (
        <span
          className="absolute -top-px right-2 grid h-[19px] min-w-[19px] place-items-center rounded-full border-2 border-white px-[5px] text-[10px] font-extrabold text-white"
          style={{ background: color }}
        >
          {count > 999 ? '999+' : count}
        </span>
      )}
    </Link>
  );
}
