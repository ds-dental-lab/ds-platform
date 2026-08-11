// =========================================================
// 놓을 위치: src/components/billing/InvoiceSheet.tsx
//
// 청구서 한 장. 화면에서 보고 그대로 인쇄합니다.
//
// ★ 방향이 반대인 두 문서를 한 틀로 찍습니다 (사용자 확정 2026-08-12).
//     디자인센터 → 치과       '청구서'
//     기공소     → 디자인센터  '청구서 (기공료)'
//   금액은 양쪽 다 디자인센터가 정하지만, 문서의 머리는 방향을 따릅니다.
//   기공소 것을 '청구' 로 적으면 주는 쪽이 달라는 문서가 됩니다.
//
// ★ 리메이크도 세부내역에 넣습니다.
//   0원으로 적혀 있어야 "이건 안 받았다" 가 문서로 남습니다.
//   빼 버리면 치과는 그 달에 무엇을 다시 만들었는지 알 수 없습니다.
//
// ★ 인쇄용 규칙은 print: 로 답니다.
//   화면의 껍데기(사이드바·버튼)는 인쇄에서 빠지고, 표는 쪽을 넘길 때
//   줄이 잘리지 않게 합니다.
// =========================================================

'use client';

import type { InvoiceParties } from '@/server/domain/billing';
import type { Settlement } from '@/server/repositories/billing';
import type { PartnerRow } from '@/server/repositories/partner';

export interface InvoiceSheetProps {
  parties: InvoiceParties;
  /** 청구하는 쪽 */
  issuer: { name: string; bizNo: string | null; ceoName: string | null; address: string | null };
  /** 청구받는 쪽 */
  receiver: PartnerRow | { name: string; bizNo: string | null; ceoName: string | null; address: string | null };
  yearMonth: string;
  settlement: Settlement;
  issuedAt: string | null;
  paidAt: string | null;
}

export default function InvoiceSheet({
  parties,
  issuer,
  receiver,
  yearMonth,
  settlement,
  issuedAt,
  paidAt,
}: InvoiceSheetProps) {
  const adjustments = settlement.items.filter((i) => i.adjustment !== 0);
  const remakes = settlement.items.filter((i) => !i.billable);

  return (
    <article className="mx-auto max-w-[860px] bg-white p-10 text-[#1A2130] print:max-w-none print:p-0">
      {/* ---------- 머리 ---------- */}
      <header className="flex items-start justify-between border-b-2 border-[#1A2130] pb-5">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.04em]">{parties.title}</h1>
          <p className="mt-1 text-[13px] text-[#4A5567]">
            {yearMonth} · {settlement.from} ~ {settlement.to}
          </p>
        </div>

        <dl className="text-right text-[12px] text-[#4A5567]">
          <div className="flex justify-end gap-3">
            <dt>발행일</dt>
            <dd className="w-[92px] tabular-nums">{day(issuedAt) || '미발행'}</dd>
          </div>
          <div className="mt-1 flex justify-end gap-3">
            <dt>입금</dt>
            <dd className="w-[92px] tabular-nums">{day(paidAt) || '미입금'}</dd>
          </div>
        </dl>
      </header>

      {/* ---------- 보내는 쪽 / 받는 쪽 ---------- */}
      <section className="mt-6 grid grid-cols-2 gap-6">
        <Party title="공급자 (청구)" org={issuer} />
        <Party title="공급받는 자" org={receiver} />
      </section>

      {/* ---------- 총액 ---------- */}
      <section className="mt-6 flex items-center justify-between rounded-lg bg-[#F4F6F9] px-6 py-4 print:border print:border-[#DDE2EA]">
        <span className="text-[14px] font-bold">{parties.amountLabel}</span>
        <b className="text-[26px] font-extrabold tracking-[-0.03em] tabular-nums">
          ₩{settlement.total.toLocaleString('ko-KR')}
        </b>
      </section>

      {/* ---------- 청구 내역 (제품별) ---------- */}
      <Section title="청구 내역">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-y border-[#1A2130] text-[12px]">
              <Th className="w-[44px] text-center">#</Th>
              <Th>제품</Th>
              <Th className="w-[70px] text-right">수량</Th>
              <Th className="w-[110px] text-right">금액</Th>
            </tr>
          </thead>
          <tbody>
            {settlement.products.length === 0 ? (
              <Empty colSpan={4} />
            ) : (
              settlement.products.map((row, i) => (
                <tr key={row.key} className="border-b border-[#E8EBF0]">
                  <Td className="text-center text-[#98A2B3]">{i + 1}</Td>
                  <Td>{row.label}</Td>
                  <Td className="text-right tabular-nums">{row.count}</Td>
                  <Td className="text-right tabular-nums">{won(row.amount)}</Td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#1A2130] font-bold">
              <Td colSpan={2}>보철 합계</Td>
              <Td className="text-right tabular-nums">
                {settlement.products.reduce((n, p) => n + p.count, 0)}
              </Td>
              <Td className="text-right tabular-nums">{won(settlement.subtotal)}</Td>
            </tr>
            {settlement.adjustment !== 0 && (
              <tr className="font-bold">
                <Td colSpan={3}>조정 금액</Td>
                <Td className="text-right tabular-nums">{won(settlement.adjustment)}</Td>
              </tr>
            )}
            <tr className="border-t-2 border-[#1A2130] text-[14px] font-extrabold">
              <Td colSpan={3}>합계</Td>
              <Td className="text-right tabular-nums">{won(settlement.total)}</Td>
            </tr>
          </tfoot>
        </table>
      </Section>

      {/* ---------- 조정 내역 ---------- */}
      {adjustments.length > 0 && (
        <Section title="조정 내역">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-y border-[#1A2130] text-[12px]">
                <Th>환자</Th>
                <Th className="w-[70px] text-center">치식</Th>
                <Th>제품</Th>
                <Th>사유</Th>
                <Th className="w-[110px] text-right">조정</Th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((item) => (
                <tr key={item.itemId} className="border-b border-[#E8EBF0]">
                  <Td>{item.patientLabel}</Td>
                  <Td className="text-center tabular-nums">{item.toothNumber}</Td>
                  <Td>{item.label}</Td>
                  {/* ★ 사유가 문서에 남아야 나중에 다툴 일이 없습니다 */}
                  <Td>{item.adjustmentReason || '-'}</Td>
                  <Td className="text-right font-semibold tabular-nums">{won(item.adjustment)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* ---------- 보철 세부내역 ---------- */}
      <Section title={`보철 세부내역 (${settlement.items.length}건)`}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-[#1A2130]">
              <Th className="w-[80px]">접수일</Th>
              <Th className="w-[80px]">배송일</Th>
              <Th>환자</Th>
              <Th>제품</Th>
              <Th className="w-[54px] text-center">치식</Th>
              <Th className="w-[92px] text-right">조정</Th>
              <Th className="w-[100px] text-right">금액</Th>
            </tr>
          </thead>
          <tbody>
            {settlement.items.length === 0 ? (
              <Empty colSpan={7} />
            ) : (
              settlement.items.map((item) => (
                <tr
                  key={item.itemId}
                  className="border-b border-[#F0F2F5] print:break-inside-avoid"
                >
                  <Td className="tabular-nums">{day(item.receivedAt)}</Td>
                  <Td className="tabular-nums">{day(item.shippedAt)}</Td>
                  <Td>
                    {item.patientLabel}
                    {item.isRemake && (
                      <span className="ml-1 font-bold text-[#C2721B]">{item.remakeSeq}차</span>
                    )}
                  </Td>
                  <Td>
                    {item.label}
                    {item.hasGingival && <span className="ml-1 text-[#98A2B3]">+핑크</span>}
                  </Td>
                  <Td className="text-center tabular-nums">{item.toothNumber}</Td>
                  <Td className="text-right tabular-nums">
                    {item.adjustment === 0 ? '' : won(item.adjustment)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {item.billable ? (
                      won(item.amount)
                    ) : (
                      <span className="text-[#C2721B]">₩0 (재제작)</span>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {remakes.length > 0 && (
          <p className="mt-2 text-[11.5px] text-[#4A5567]">
            재제작 {remakes.length}건은 청구하지 않습니다. 무엇을 다시 만들었는지 남기려고
            함께 적었습니다.
          </p>
        )}
      </Section>

      <footer className="mt-8 border-t border-[#E8EBF0] pt-4 text-[11px] text-[#98A2B3]">
        이 문서는 DS Flow 에서 자동으로 만들어졌습니다. 금액이 다르면 발행처에 알려 주세요.
      </footer>
    </article>
  );
}

// ---------- 조각들 ----------

function Party({
  title,
  org,
}: {
  title: string;
  org: { name: string; bizNo: string | null; ceoName: string | null; address: string | null };
}) {
  return (
    <div className="rounded-lg border border-[#E8EBF0] px-4 py-3">
      <p className="text-[11px] font-bold text-[#98A2B3]">{title}</p>
      <p className="mt-1 text-[15px] font-bold">{org.name}</p>

      <dl className="mt-2 space-y-0.5 text-[11.5px] text-[#4A5567]">
        <Line label="대표자">{org.ceoName || '-'}</Line>
        <Line label="사업자번호">{org.bizNo || '-'}</Line>
        <Line label="주소">{org.address || '-'}</Line>
      </dl>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[58px] shrink-0 text-[#98A2B3]">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 print:break-inside-auto">
      <h2 className="mb-2 text-[13.5px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-2 py-2 text-left font-bold ${className}`}>{children}</th>
  );
}

function Td({
  children,
  className = '',
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-2 py-1.5 ${className}`}>
      {children}
    </td>
  );
}

function Empty({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-[#98A2B3]">
        이 기간에 청구할 건이 없습니다.
      </td>
    </tr>
  );
}

function won(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₩${Math.abs(value).toLocaleString('ko-KR')}`;
}

function day(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}
