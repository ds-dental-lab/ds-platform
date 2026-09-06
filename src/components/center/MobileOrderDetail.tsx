// =========================================================
// 놓을 위치: src/components/center/MobileOrderDetail.tsx
//
// 폰에서 보는 주문 한 건 — 전화 받으면서 답할 것만.
// (사용자 요청 2026-09-06 — "어떤 종류고 어떤 치식인지 확인")
//
// ★★ 세 줄이면 답이 됩니다: 지금 어느 단계인가 · 무엇을 몇 개 · 어느
//   치아. 그 아래는 곁다리(요청시한·담당·파일). 주문을 고치는 단추는
//   없습니다 — 그건 PC 에서, 링크 하나로 갑니다.
// =========================================================

import Link from 'next/link';
import { itemLine } from '@/server/domain/center-mobile';
import { STATUS_LABEL } from '@/server/domain/order-status';
import type { ProsthesisCatalog } from '@/server/domain/prosthesis';
import type { OrderDetail } from '@/server/repositories/order';

export default function MobileOrderDetail({
  order,
  catalog,
}: {
  order: OrderDetail;
  catalog: ProsthesisCatalog;
}) {
  const scanCount = order.files.filter((f) => f.kind === 'scan').length;
  const designCount = order.files.filter((f) => f.kind === 'design').length;

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-5">
      <Link href="/m/orders" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
        <span aria-hidden="true">&#8249;</span> 주문 찾기
      </Link>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(22,50,79,0.06)]">
        <p className="text-[13px] font-semibold text-[var(--muted)]">{order.clinic_name}</p>
        <h1 className="mt-0.5 text-[26px] font-extrabold tracking-[-0.5px] text-[var(--ink)]">
          {order.patient_label}
        </h1>
        <p className="mt-1 text-[12.5px] tabular-nums text-[#9FB0C0]">{order.order_no}</p>

        {/* ① 지금 어느 단계인가 — 전화의 첫 질문 */}
        <div className="mt-4 flex items-center gap-2">
          <span className="rounded-full bg-[var(--mist)] px-3 py-1 text-[13px] font-bold text-[#0E9384]">
            {STATUS_LABEL[order.status]}
          </span>
          {order.is_remake && (
            <span className="rounded-full bg-[#FDECEA] px-2.5 py-1 text-[12px] font-bold text-[#B02A22]">리메이크</span>
          )}
          {order.is_repair && (
            <span className="rounded-full bg-[#FDECEA] px-2.5 py-1 text-[12px] font-bold text-[#B02A22]">리페어</span>
          )}
        </div>
      </section>

      {/* ② 무엇을 몇 개, ③ 어느 치아 */}
      <h2 className="mt-6 text-[14px] font-bold text-[var(--ink)]">
        보철 <span className="ml-1 text-[var(--muted)]">{order.items.length}개</span>
      </h2>
      {order.items.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-[var(--muted)]">항목이 없습니다</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--line)] rounded-2xl bg-white shadow-[0_1px_2px_rgba(22,50,79,0.06)]">
          {[...order.items]
            .sort((a, b) => a.slot - b.slot || a.tooth_number - b.tooth_number)
            .map((item) => (
              <li key={item.id} className="px-4 py-3 text-[15px] font-semibold tabular-nums text-[var(--ink)]">
                {itemLine(catalog, item)}
                {item.shade_cervical && (
                  <span className="ml-2 text-[12.5px] font-normal text-[var(--muted)]">
                    쉐이드 {item.shade_cervical}
                    {item.shade_incisal && item.shade_incisal !== item.shade_cervical && ` / ${item.shade_incisal}`}
                  </span>
                )}
              </li>
            ))}
        </ul>
      )}

      <dl className="mt-6 space-y-2 text-[13.5px]">
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 text-[var(--muted)]">요청시한</dt>
          <dd className="tabular-nums text-[var(--ink)]">{order.due_date}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 text-[var(--muted)]">담당</dt>
          <dd className="text-[var(--ink)]">{order.designer_name || '아직 없음'}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 text-[var(--muted)]">파일</dt>
          <dd className="text-[var(--ink)]">스캔 {scanCount} · 디자인 {designCount}</dd>
        </div>
        {order.notes && (
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-[var(--muted)]">요청사항</dt>
            <dd className="whitespace-pre-wrap text-[var(--ink)]">{order.notes}</dd>
          </div>
        )}
      </dl>

      {/* ★ 고치는 일은 PC 에서 — 링크 하나로 그 주문으로 갑니다 */}
      <Link
        href={`/design/orders/${order.id}`}
        className="mt-8 block rounded-xl border border-[var(--line)] bg-white py-3.5 text-center text-[14.5px] font-bold text-[var(--muted)]"
      >
        전체 화면에서 열기
      </Link>
    </main>
  );
}
