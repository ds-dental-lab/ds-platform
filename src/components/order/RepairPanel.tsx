// =========================================================
// 놓을 위치: src/components/order/RepairPanel.tsx
//
// 주문상세 머리줄 아래의 리페어 칸. (사용자 요청 2026-08-13)
//   "리페어 이슈가 달린 주문 클릭 시 리페어 내용을 상세페이지에서도
//    확인할수 있게 해줘"
//
// ★ 두 가지 얼굴이 있습니다.
//   ① 내가 리페어 건이다 → 무엇을 고쳐 달라는 글과, 원주문으로 가는 길
//   ② 나에게서 리페어가 나갔다 → 그 건들로 가는 길
//   둘 다일 수도 있습니다 (리페어를 또 리페어).
//
// ★ 맨 위에 둡니다.
//   '기타 요청사항' 칸에 섞으면 그냥 메모로 보입니다. 이 건이 왜 다시
//   들어왔는지는 치식도보다 먼저 읽혀야 합니다.
//
// ★ 초록입니다 — 목록의 리페어 딱지와 같은 색입니다 (ISSUE_META).
//   목록에서 초록 딱지를 보고 들어왔는데 상세가 다른 색이면, 같은
//   것을 가리키는지 한 번 더 생각하게 됩니다.
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
}

export default function RepairPanel({ repair, isRepair, orderPath }: RepairPanelProps) {
  if (!isRepair && repair.children.length === 0) return null;

  const meta = ISSUE_META.repair;

  return (
    <div
      className="rounded-[9px] border px-4 py-3"
      style={{ borderColor: '#BFE3C2', background: meta.bg }}
    >
      {isRepair && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
              style={{ background: '#FFFFFF', color: meta.fg }}
            >
              {meta.label}
            </span>
            <b className="text-[13px] font-bold" style={{ color: meta.fg }}>
              고쳐 달라고 들어온 건입니다
            </b>

            {repair.openedAt && (
              <span className="text-[12px]" style={{ color: meta.fg }}>
                {repair.openedAt.slice(0, 10)} 신청
              </span>
            )}

            {/* ★ 원주문으로 가는 길. 무엇을 고치는 건지는 거기에 다 있습니다 */}
            {repair.parent && (
              <Link
                href={`${orderPath}/${repair.parent.id}`}
                className="ml-auto rounded-md border border-white bg-white/70 px-2.5 py-1 text-[12px] font-semibold text-[#3A8A45] hover:bg-white"
              >
                원주문 {repair.parent.orderNo} ({STATUS_LABEL[repair.parent.status]}) ›
              </Link>
            )}
          </div>

          {/*
            ★ 줄바꿈을 살립니다. 치과가 여러 줄로 적어 보내는 경우가
              많은데 한 줄로 뭉치면 읽는 사람이 항목을 놓칩니다.
          */}
          <p
            className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed"
            style={{ color: '#255C2C' }}
          >
            {repair.reason || <span className="text-[#7FA884]">적힌 내용이 없습니다.</span>}
          </p>
        </>
      )}

      {repair.children.length > 0 && (
        <div className={isRepair ? 'mt-3 border-t border-[#BFE3C2] pt-2.5' : ''}>
          <p className="text-[12.5px] font-bold" style={{ color: meta.fg }}>
            이 주문에서 나간 리페어 {repair.children.length}건
          </p>

          <ul className="mt-1.5 space-y-1">
            {repair.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`${orderPath}/${child.id}`}
                  className="flex flex-wrap items-baseline gap-2 rounded px-1.5 py-1 text-[12.5px] hover:bg-white/70"
                >
                  <span className="tabular-nums font-semibold text-[#255C2C]">
                    {child.createdAt.slice(0, 10)}
                  </span>
                  <span className="font-semibold text-[#3A8A45]">
                    {STATUS_LABEL[child.status]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#4A5567]">
                    {child.notes || '내용 없음'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
