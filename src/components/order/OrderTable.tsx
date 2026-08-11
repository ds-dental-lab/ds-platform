// =========================================================
// 놓을 위치: src/components/order/OrderTable.tsx
//
// 주문목록 표. (기능명세서 §4.3, 시안 .otbl)
//   주문상태 · D-Day · 접수일 · 치과 · 환자명 · 치식 · 기공소 · 이슈 · 리메이크 횟수
//
// ★ 줄 아무 데나 누르면 상세로 갑니다 (시안 tbody tr cursor:pointer).
// ★ 기공소 열은 치과 계정에서 빠집니다 — 값 자체가 내려오지 않습니다 (§8.5).
// ★ 치식과 이슈는 정렬하지 않습니다. 한 칸에 값이 여럿이라 기준을 정할 수 없습니다.
// =========================================================

import Link from 'next/link';
import {
  computeDDay,
  formatToothList,
  colorOfStatus,
  ISSUE_META,
  isSortable,
  type SortColumn,
} from '@/server/domain/order-list';
import { STATUS_LABEL } from '@/server/domain/order-status';
import OrderTableRow from '@/components/order/OrderTableRow';
import type { OrderRow } from '@/server/repositories/order-list';
import type { IsoDate } from '@/server/domain/week';

interface Column {
  key: string;
  label: string;
  width: string;
  align: 'left' | 'center';
}

const COLUMNS: Column[] = [
  { key: 'status', label: '주문상태', width: '100px', align: 'center' },
  { key: 'due_date', label: 'D-Day', width: '112px', align: 'center' },
  { key: 'received_at', label: '접수일', width: '112px', align: 'center' },
  { key: 'clinic_name', label: '치과', width: 'auto', align: 'left' },
  { key: 'patient_label', label: '환자명', width: '112px', align: 'center' },
  { key: 'teeth', label: '치식', width: '15%', align: 'center' },
  { key: 'lab_name', label: '기공소', width: '13%', align: 'left' },
  { key: 'issue', label: '이슈', width: '104px', align: 'center' },
  { key: 'remake_count', label: '리메이크 횟수', width: '104px', align: 'center' },
];

export interface OrderTableProps {
  rows: OrderRow[];
  today: IsoDate;
  basePath: string;
  orderPath: string;
  params: Record<string, string>;
  sort: SortColumn;
  dir: 1 | -1;
  showLab: boolean;
}

export default function OrderTable({
  rows,
  today,
  basePath,
  orderPath,
  params,
  sort,
  dir,
  showLab,
}: OrderTableProps) {
  const columns = showLab ? COLUMNS : COLUMNS.filter((c) => c.key !== 'lab_name');

  /** 머리글을 눌렀을 때. 같은 열을 다시 누르면 방향만 뒤집습니다 */
  function sortHref(key: string): string {
    const next = new URLSearchParams(params);
    next.set('sort', key);
    next.set('dir', sort === key && dir === 1 ? '-1' : '1');
    next.delete('page');
    return `${basePath}?${next.toString()}`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] table-fixed border-collapse">
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            {columns.map((c) => {
              const sortable = isSortable(c.key);
              const on = sort === c.key;

              return (
                <th
                  key={c.key}
                  className={
                    'whitespace-nowrap border-b border-gray-200 px-3 py-3.5 text-[12.5px] font-bold text-[#4A5567] ' +
                    (c.align === 'left' ? 'text-left' : 'text-center')
                  }
                >
                  {sortable ? (
                    <Link
                      href={sortHref(c.key)}
                      className="inline-flex select-none items-center hover:text-blue-600"
                    >
                      {c.label}
                      {on && (
                        <>
                          <span className="ml-0.5 text-[10px] text-blue-600" aria-hidden="true">
                            {dir > 0 ? '↑' : '↓'}
                          </span>
                          <span className="sr-only">{dir > 0 ? '오름차순' : '내림차순'}</span>
                        </>
                      )}
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-gray-400">
                조건에 맞는 주문이 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const dday = computeDDay(row.due_date, today, row.status);
              const issue = row.issue ? ISSUE_META[row.issue] : null;

              return (
                <OrderTableRow
                  key={row.id}
                  href={`${orderPath}/${row.id}`}
                  label={`${row.order_no} ${row.patient_label} 상세 보기`}
                >
                  {/* 주문상태 — 담당 섹터 색 */}
                  <td
                    className="truncate px-3 py-3 text-center text-[13px] font-bold"
                    style={{ color: colorOfStatus(row.status) }}
                  >
                    {STATUS_LABEL[row.status]}
                  </td>

                  {/* D-Day — 큰 글씨 아래 요청시한 */}
                  <td className="whitespace-nowrap px-3 py-3 text-center leading-[1.35]">
                    <b
                      className={
                        'block text-[13px] font-bold tabular-nums ' +
                        (dday.urgent ? 'text-[#D8453F]' : 'text-[#1A2130]')
                      }
                    >
                      {dday.label}
                    </b>
                    <span
                      className={
                        'text-[11.5px] tabular-nums ' +
                        (dday.urgent ? 'text-[#E08080]' : 'text-[#98A2B3]')
                      }
                    >
                      {row.due_date}
                    </span>
                  </td>

                  <td className="truncate px-3 py-3 text-center text-[13px] tabular-nums text-[#4A5567]">
                    {(row.received_at ?? '').slice(0, 10) || '-'}
                  </td>

                  <td className="truncate px-3 py-3 text-left text-[13px] text-[#4A5567]">
                    {row.clinic_name}
                  </td>

                  {/* 환자명 — 시안에서 유일하게 굵은 열입니다 */}
                  <td className="truncate px-3 py-3 text-center text-[13px] font-bold text-[#1A2130]">
                    {row.patient_label}
                  </td>

                  <td className="truncate px-3 py-3 text-center text-[13px] tabular-nums text-[#4A5567]">
                    {formatToothList(row.teeth)}
                  </td>

                  {showLab && (
                    <td className="truncate px-3 py-3 text-left text-[13px] text-[#4A5567]">
                      {row.lab_name || <span className="text-gray-300">미배정</span>}
                    </td>
                  )}

                  <td className="px-3 py-3 text-center">
                    {issue && (
                      <span
                        className="inline-block rounded-full px-[9px] py-[3px] text-[11px] font-bold"
                        style={{ background: issue.bg, color: issue.fg }}
                      >
                        {issue.label}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-center text-[13px] tabular-nums text-[#4A5567]">
                    {row.remake_count}
                  </td>
                </OrderTableRow>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
