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
  formatRemakeCell,
  type SortColumn,
} from '@/server/domain/order-list';
import { STATUS_LABEL } from '@/server/domain/order-status';
import OrderTableRow from '@/components/order/OrderTableRow';
import ShadePhotoButton from '@/components/order/ShadePhotoButton';
import { canShoot } from '@/server/domain/shade-photo';
import type { OrderRow } from '@/server/repositories/order-list';
import type { IsoDate } from '@/server/domain/week';

interface Column {
  key: string;
  label: string;
  width: string;
  align: 'left' | 'center';
}

/*
  ★ 전부 가운데 정렬입니다 (사용자 결정 2026-08-12).
    전에는 치과·기공소만 왼쪽이었는데, 아홉 칸 중 둘만 다르니
    표가 한쪽으로 쏠려 보였습니다.

  ★ 폭을 백분율로 바꿨습니다.
    px 와 % 와 auto 를 섞어 놓아서 '치과' 가 남는 자리를 통째로 먹고
    나머지가 눌렸습니다. 백분율로 두면 창이 넓어져도 비율이 유지됩니다.
    합이 100% 입니다 — 기공소 열이 빠지는 화면에서는 table-fixed 가
    남은 열에 비례해서 나눠 줍니다.
*/
const COLUMNS: Column[] = [
  { key: 'status', label: '주문상태', width: '10%', align: 'center' },
  { key: 'due_date', label: 'D-Day', width: '9%', align: 'center' },
  { key: 'received_at', label: '접수일', width: '10%', align: 'center' },
  { key: 'clinic_name', label: '치과', width: '16%', align: 'center' },
  { key: 'patient_label', label: '환자명', width: '10%', align: 'center' },
  { key: 'teeth', label: '치식', width: '15%', align: 'center' },
  { key: 'lab_name', label: '기공소', width: '13%', align: 'center' },
  { key: 'issue', label: '이슈', width: '10%', align: 'center' },
  { key: 'remake_count', label: '리메이크', width: '7%', align: 'center' },
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
  /** 주문 id → 안 읽은 대화 수. 있으면 💬 뱃지가 붙습니다 */
  unreadChat?: Record<string, number>;
  /**
   * 📷 쉐이드 사진 단추를 낼 것인가 — **치과 목록만** (2026-09-06).
   * 센터·기공소 목록에는 안 냅니다. 사진을 찍는 건 진료실입니다.
   */
  shadeShortcut?: boolean;
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
  unreadChat = {},
  shadeShortcut = false,
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
                    'whitespace-nowrap border-b border-gray-200 px-3 py-2.5 text-[13.5px] font-bold text-[#4A5567] ' +
                    (c.align === 'left' ? 'text-left' : 'text-center')
                  }
                >
                  {/*
                    ★ 누를 수 있다는 것을 **늘** 보여 줍니다.
                      전에는 정렬 중인 열에만 화살표가 떴습니다. 그러니
                      D-Day 를 눌러 볼 생각을 아무도 안 했습니다 —
                      기능이 있어도 없는 것과 같았습니다.
                  */}
                  {sortable ? (
                    <Link
                      href={sortHref(c.key)}
                      title={`${c.label} 순서로 정렬`}
                      className={
                        'inline-flex select-none items-center gap-0.5 rounded px-1 py-0.5 ' +
                        (on ? 'text-blue-600' : 'hover:bg-gray-100 hover:text-blue-600')
                      }
                    >
                      {c.label}
                      {on ? (
                        <>
                          <span className="text-[10px]" aria-hidden="true">
                            {dir > 0 ? '▲' : '▼'}
                          </span>
                          <span className="sr-only">{dir > 0 ? '오름차순' : '내림차순'}</span>
                        </>
                      ) : (
                        <span className="text-[9px] text-[#C4CBD6]" aria-hidden="true">
                          ▲▼
                        </span>
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
            /*
              ★ 빈 자리에 글을 쓰지 않습니다 (사용자 요청 2026-08-21).
                '조건에 맞는 주문이 없습니다' 가 있었는데, 목록이 비었다는
                것은 보면 압니다. 굳이 적으면 없는 일을 지적받는 느낌이 됩니다.

              ★ 줄은 남겨 둡니다. 통째로 빼면 표가 머리줄만 남고 납작하게
                주저앉아, 다음 주문이 들어오는 순간 화면이 튑니다.
            */
            <tr aria-hidden="true">
              <td colSpan={columns.length} className="px-4 py-16" />
            </tr>
          ) : (
            rows.map((row) => {
              const dday = computeDDay(row.due_date, today, row.status);
              const issue = row.issue ? ISSUE_META[row.issue] : null;
              const chat = unreadChat[row.id] ?? 0;

              return (
                <OrderTableRow
                  key={row.id}
                  href={`${orderPath}/${row.id}`}
                  label={`${row.order_no} ${row.patient_label} 상세 보기`}
                >
                  {/* 주문상태 — 담당 섹터 색 */}
                  <td
                    className="truncate px-3 py-2 text-center text-[14px] font-bold"
                    style={{ color: colorOfStatus(row.status) }}
                  >
                    {STATUS_LABEL[row.status]}
                  </td>

                  {/* D-Day — 큰 글씨 아래 요청시한 */}
                  <td className="whitespace-nowrap px-3 py-2 text-center leading-[1.2]">
                    <b
                      className={
                        'block text-[14px] font-bold tabular-nums ' +
                        (dday.urgent ? 'text-[#D8453F]' : 'text-[#1A2130]')
                      }
                    >
                      {dday.label}
                    </b>
                    <span
                      className={
                        'text-[12.5px] tabular-nums ' +
                        (dday.urgent ? 'text-[#E08080]' : 'text-[#98A2B3]')
                      }
                    >
                      {row.due_date}
                    </span>
                  </td>

                  <td className="truncate px-3 py-2 text-center text-[14px] tabular-nums text-[#4A5567]">
                    {(row.received_at ?? '').slice(0, 10) || '-'}
                  </td>

                  <td className="truncate px-3 py-2 text-center text-[14px] text-[#4A5567]">
                    {row.clinic_name}
                  </td>

                  {/* 환자명 — 시안에서 유일하게 굵은 열입니다 */}
                  <td className="truncate px-3 py-2 text-center text-[14px] font-bold text-[#1A2130]">
                    {row.patient_label}
                  </td>

                  <td className="truncate px-3 py-2 text-center text-[14px] tabular-nums text-[#4A5567]">
                    {formatToothList(row.teeth)}
                  </td>

                  {showLab && (
                    <td className="truncate px-3 py-2 text-center text-[14px] text-[#4A5567]">
                      {row.lab_name || <span className="text-gray-300">미배정</span>}
                    </td>
                  )}

                  {/*
                    ★ 한 줄에 셋까지 섭니다 — 📷 · 이슈 딱지 · 💬. 이슈 딱지
                      (재스캔·리메이크·리페어·아날로그)는 **하나만** 옵니다
                      (repositories/order-list 의 pickIssue — 안 풀린 것 하나).
                      그래서 겹쳐 쌓이는 일은 없고, 셋이 다 있을 때 줄이 꺾여
                      딱지가 두 줄이 되는 것만 막으면 됩니다 — nowrap 으로 못 박고
                      열 폭을 조금 넓혔습니다 (2026-09-06).
                  */}
                  <td className="whitespace-nowrap px-2 py-2 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      {issue && (
                        <span
                          className="inline-block rounded-full px-[9px] py-[3px] text-[11px] font-bold"
                          style={{ background: issue.bg, color: issue.fg }}
                        >
                          {issue.label}
                        </span>
                      )}

                      {/*
                        ★ 📷 쉐이드 사진 (사용자 요청 2026-09-06). 치과 목록에만,
                          그리고 **찍을 수 있는 단계**(canShoot)에만 섭니다 —
                          배송 나간 뒤에 쉐이드를 찍는 일은 없습니다.
                          줄 전체가 링크라 단추가 스스로 전파를 막습니다.
                      */}
                      {shadeShortcut && canShoot(row.status) && (
                        <ShadePhotoButton
                          orderId={row.id}
                          orderNo={row.order_no}
                          patientLabel={row.patient_label}
                        />
                      )}

                      {/*
                        ★ 안 읽은 대화 (사용자 요청 2026-08-19).
                          종에는 모든 알림이 섞여서 대화가 묻힙니다.
                          일하는 화면(목록)에 직접 박습니다. 주문상세를
                          열면 읽음이 되어 뱃지가 꺼집니다.
                      */}
                      {chat > 0 && (
                        <span
                          className="inline-flex items-center gap-[3px] rounded-full bg-[#EAF3FE] px-[8px] py-[3px] text-[11px] font-bold text-[#1279E8]"
                          title={`안 읽은 대화 ${chat}건`}
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M8 2C4.1 2 1 4.6 1 7.8c0 1.8 1 3.4 2.6 4.5-.1.8-.5 1.9-1.3 2.7 1.5-.2 2.8-.8 3.7-1.4.6.1 1.3.2 2 .2 3.9 0 7-2.6 7-5.9S11.9 2 8 2Z" />
                          </svg>
                          {chat}
                        </span>
                      )}
                    </span>
                  </td>

                  {/*
                    ★ 숫자만 찍되 **색으로 가릅니다.**
                      '2' 가 '2차 리메이크' 인지 '2번 다시 만들어진 원주문'
                      인지는 글자만으로 구별되지 않습니다.
                  */}
                  {(() => {
                    const cell = formatRemakeCell({
                      isRemake: row.is_remake,
                      remakeSeq: row.remake_seq,
                      remakeCount: row.remake_count,
                    });

                    return (
                      <td
                        title={cell.title}
                        className={
                          'px-3 py-2 text-center text-[14px] tabular-nums ' +
                          (cell.isSelf
                            ? 'font-bold text-[#C4383A]'
                            : cell.text === '0'
                              ? 'text-[#C4CBD6]'
                              : 'font-semibold text-[#4A5567]')
                        }
                      >
                        {cell.text}
                      </td>
                    );
                  })()}
                </OrderTableRow>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
