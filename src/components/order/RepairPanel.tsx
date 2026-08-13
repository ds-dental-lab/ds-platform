// =========================================================
// 놓을 위치: src/components/order/RepairPanel.tsx
//
// 주문상세 머리줄 아래의 리페어 줄.
//
// ★ 읽는 사람에 따라 말이 다릅니다 (사용자 지적 2026-08-13).
//   같은 건인데 치과는 **보낸 쪽**이고 기공소는 **받는 쪽**입니다.
//   치과 화면에 "고쳐 달라고 들어온 건입니다" 라고 적으면 남의 말이
//   됩니다 — 요청한 사람은 자기니까요.
//
// ★ 초록 바탕을 걷어냈습니다 (사용자 지적 — "시인성이 떨어져").
//   초록 위의 초록 글씨라 정작 중요한 **요청 내용**이 안 읽혔습니다.
//   흰 바탕에 왼쪽만 초록 띠를 둡니다. 딱지는 목록과 같은 초록이라
//   "그 초록 딱지를 보고 들어온 그 건" 이라는 연결은 살아 있습니다.
//
// ★ 치과에는 자세한 것을 안 폅니다.
//   치과는 고객이라 과정만 봅니다 — 요청한 내용과 원주문으로 가는 길만
//   있으면 됩니다. 갈라져 나간 리페어 목록은 일하는 쪽에만 폅니다.
// =========================================================

import Link from 'next/link';
import { ISSUE_META } from '@/server/domain/order-list';
import { STATUS_LABEL } from '@/server/domain/order-status';
import type { RepairContext } from '@/server/repositories/repair';

export interface RepairPanelProps {
  repair: RepairContext;
  /** 이 주문 자신이 리페어인가 */
  isRepair: boolean;
  /** 같은 섹터의 주문상세 경로 — '/design/orders' */
  orderPath: string;
  /**
   * 읽는 사람이 요청한 쪽인가, 일하는 쪽인가.
   *   requester — 치과 (보낸 쪽)
   *   worker    — 디자인센터 · 기공소 (받는 쪽)
   */
  audience?: 'requester' | 'worker';
}

export default function RepairPanel({
  repair,
  isRepair,
  orderPath,
  audience = 'worker',
}: RepairPanelProps) {
  if (!isRepair && repair.children.length === 0) return null;

  const meta = ISSUE_META.repair;
  const requester = audience === 'requester';

  return (
    <div className="overflow-hidden rounded-[9px] border border-[#E8EBF0] bg-white">
      <div className="flex border-l-[3px]" style={{ borderLeftColor: meta.fg }}>
        <div className="min-w-0 flex-1 px-4 py-3">
          {isRepair && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-2 py-[2px] text-[12.5px] font-bold"
                  style={{ background: meta.bg, color: meta.fg }}
                >
                  {meta.label}
                </span>

                <span className="text-[13px] text-[#98A2B3]">
                  {requester ? '요청하신 내용' : '고쳐 달라고 들어온 건입니다'}
                  {repair.openedAt && ` · ${repair.openedAt.slice(0, 10)}`}
                </span>

                {repair.parent && (
                  <Link
                    href={`${orderPath}/${repair.parent.id}`}
                    className="ml-auto shrink-0 text-[13px] font-semibold text-[#1279E8] hover:underline"
                  >
                    원주문 {repair.parent.orderNo} ›
                  </Link>
                )}
              </div>

              {/*
                ★ 요청 내용이 이 칸의 주인공입니다.
                  진한 글씨로 크게 둡니다 — 전에는 초록 위 초록이라
                  제목보다 덜 읽혔습니다.
              */}
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-semibold leading-relaxed text-[#1A2130]">
                {repair.reason || <span className="text-[#C4CBD6]">적힌 내용이 없습니다.</span>}
              </p>
            </>
          )}

          {/* ★ 갈라져 나간 리페어 목록은 일하는 쪽에만 폅니다 */}
          {!requester && repair.children.length > 0 && (
            <div className={isRepair ? 'mt-3 border-t border-[#F0F2F5] pt-2.5' : ''}>
              <p className="text-[13px] font-bold" style={{ color: meta.fg }}>
                이 주문에서 나간 리페어 {repair.children.length}건
              </p>

              <ul className="mt-1 space-y-0.5">
                {repair.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`${orderPath}/${child.id}`}
                      className="flex flex-wrap items-baseline gap-2 rounded py-1 text-[13.5px] hover:bg-[#F8F9FB]"
                    >
                      <span className="tabular-nums font-semibold text-[#4A5567]">
                        {child.createdAt.slice(0, 10)}
                      </span>
                      <span className="font-semibold" style={{ color: meta.fg }}>
                        {STATUS_LABEL[child.status]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[#98A2B3]">
                        {child.notes || '내용 없음'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/*
            ★ 치과에도 "리페어가 나갔다" 는 사실은 알려 줍니다.
              목록까지 펴지 않고 몇 건인지만 — 자기가 요청한 것이라
              무엇인지는 이미 압니다.
          */}
          {requester && !isRepair && repair.children.length > 0 && (
            <p className="text-[13.5px] text-[#4A5567]">
              <span
                className="mr-2 rounded px-2 py-[2px] text-[12.5px] font-bold"
                style={{ background: meta.bg, color: meta.fg }}
              >
                {meta.label}
              </span>
              이 주문으로 리페어를 {repair.children.length}건 요청하셨습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
