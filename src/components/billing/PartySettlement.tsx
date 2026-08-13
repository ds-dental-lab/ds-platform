// =========================================================
// 놓을 위치: src/components/billing/PartySettlement.tsx
//
// 당사자가 보는 자기 정산. (기공소 · 치과)
//
// ★ 읽기만 합니다.
//   금액을 정하는 쪽은 디자인센터입니다. 여기서 고칠 수 있게 두면
//   같은 숫자를 두 곳에서 만들게 되고, 어느 쪽이 맞는지 알 수 없어집니다.
//   숫자가 다르면 주문별 대화로 알립니다.
//
// ★ 마감 전이라도 보여 줍니다.
//   "이번 달 얼마쯤 되겠구나" 를 미리 아는 것이 이 화면의 값어치입니다.
//   다만 아직 움직이는 값이라고 분명히 적어 둡니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PartnerRow } from '@/server/repositories/partner';
import type { Settlement } from '@/server/repositories/billing';

type Tab = 'products' | 'items';

export interface PartySettlementProps {
  me: PartnerRow;
  yearMonth: string;
  settlement: Settlement;
  closed: boolean;
  issued: boolean;
  paid: boolean;
  basePath: string;
}

export default function PartySettlement({
  me,
  yearMonth,
  settlement,
  closed,
  issued,
  paid,
  basePath,
}: PartySettlementProps) {
  const [tab, setTab] = useState<Tab>('items');

  const isLab = me.orgType === 'lab';
  const amountLabel = isLab ? '받을 금액' : '결제하실 금액';

  // 섹터 색을 그대로 씁니다 — 기공소는 초록, 치과는 파랑
  const accent = isLab ? '#12855B' : '#1B63E8';

  return (
    <div className="space-y-3">
      {/* ---------- 기간 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <Arrow href={`${basePath}?ym=${shiftMonth(yearMonth, -1)}`} label="이전 달">
              ‹
            </Arrow>
            <b className="min-w-[86px] text-center text-[15px] font-bold tabular-nums text-[#1A2130]">
              {yearMonth}
            </b>
            <Arrow href={`${basePath}?ym=${shiftMonth(yearMonth, 1)}`} label="다음 달">
              ›
            </Arrow>
          </span>

          <span className="rounded-md bg-[#F4F6F9] px-3 py-1.5 text-[14px] tabular-nums text-[#4A5567]">
            {settlement.from} ~ {settlement.to}
          </span>

          <span className="text-[13px] text-[#98A2B3]">
            매월 {me.closingDay}일 기준 · 배송일로 가릅니다
          </span>

          <span
            className={
              'ml-auto rounded-md px-3 py-1.5 text-[13.5px] font-bold ' +
              (paid
                ? 'bg-[#E6F4EE] text-[#12855B]'
                : closed
                  ? 'bg-[#FEF3E7] text-[#C2721B]'
                  : 'bg-[#F4F6F9] text-[#4A5567]')
            }
          >
            {paid ? '입금 완료' : issued ? '청구서 발행됨' : closed ? '마감됨' : '집계 중'}
          </span>
        </div>
      </section>

      {/* ---------- 아직 움직이는 값인가 ---------- */}
      {closed ? (
        <p className="rounded-lg border border-[#CDE6DA] bg-[#F2FAF6] px-5 py-3 text-[14px] text-[#0F6B4A]">
          마감된 기간입니다. 아래 금액은 확정된 값입니다. 다른 곳이 있으면 디자인센터에
          알려 주세요.
        </p>
      ) : (
        <p className="rounded-lg border border-[#E2EAF7] bg-[#F5F8FE] px-5 py-3 text-[14px] text-[#2E5AA8]">
          아직 집계 중입니다. {settlement.to} 까지 나가는 건이 더해지고, 마감해야 확정됩니다.
        </p>
      )}

      {/* ---------- 단가 미정 ---------- */}
      {settlement.unpricedCount > 0 && (
        <p className="rounded-lg border border-[#F5C6C4] bg-[#FDF2F2] px-5 py-3 text-[14px] text-[#B3312C]">
          단가가 안 정해진 보철이 <b className="font-bold">{settlement.unpricedCount}줄</b>{' '}
          있어 0원으로 잡혀 있습니다. 디자인센터에 단가를 정해 달라고 알려 주세요.
        </p>
      )}

      {/* ---------- 내역 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="flex gap-1 border-b border-[#E8EBF0] px-4">
          <TabButton accent={accent} on={tab === 'items'} onClick={() => setTab('items')}>
            보철 세부내역
            <span className="ml-1.5 text-[12.5px] text-[#98A2B3]">{settlement.items.length}</span>
          </TabButton>
          <TabButton accent={accent} on={tab === 'products'} onClick={() => setTab('products')}>
            제품별
          </TabButton>
        </div>

        <div className="overflow-x-auto">
          {tab === 'items' ? (
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="border-b border-[#E8EBF0] text-[13.5px] text-[#4A5567]">
                  <Th>접수일</Th>
                  <Th>배송일</Th>
                  <Th>환자명</Th>
                  <Th>제품</Th>
                  <Th center>치식</Th>
                  <Th right>조정</Th>
                  <Th right>{isLab ? '기공 원가' : '금액'}</Th>
                </tr>
              </thead>
              <tbody>
                {settlement.items.length === 0 ? (
                  <Empty colSpan={7} />
                ) : (
                  settlement.items.map((row) => (
                    <tr
                      key={row.itemId}
                      className={
                        'border-b border-[#F0F2F5] text-[14px] ' +
                        (row.billable ? '' : 'bg-[#FFFBF4]')
                      }
                    >
                      <Td>{day(row.receivedAt)}</Td>
                      <Td>{day(row.shippedAt)}</Td>
                      <Td>
                        {row.patientLabel}
                        {row.isRemake && (
                          <span className="ml-1.5 text-[12.5px] font-semibold text-[#C2721B]">
                            {row.remakeSeq}차
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span style={{ color: accent }}>{row.label}</span>
                        {row.hasGingival && (
                          <span className="ml-1.5 text-[11px] text-[#98A2B3]">+핑크</span>
                        )}
                      </Td>
                      <Td center>{row.toothNumber}</Td>
                      <Td right>
                        {row.adjustment === 0 ? (
                          <span className="text-[#C4CBD6]">-</span>
                        ) : (
                          <span className="font-semibold text-[#C2721B]" title={row.adjustmentReason}>
                            {won(row.adjustment)}
                          </span>
                        )}
                      </Td>
                      <Td right>
                        {!row.billable ? (
                          <span className="text-[#C2721B]">₩0</span>
                        ) : row.unpriced ? (
                          <span className="rounded bg-[#FDF2F2] px-1.5 py-0.5 text-[11px] font-bold text-[#B3312C]">
                            단가 미정
                          </span>
                        ) : (
                          won(row.amount)
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-[#E8EBF0] text-[13.5px] text-[#4A5567]">
                  <Th>제품</Th>
                  <Th right>수량</Th>
                  <Th right>금액</Th>
                </tr>
              </thead>
              <tbody>
                {settlement.products.length === 0 ? (
                  <Empty colSpan={3} />
                ) : (
                  settlement.products.map((row) => (
                    <tr key={row.key} className="border-b border-[#F0F2F5] text-[14px]">
                      <Td>
                        <b className="font-semibold text-[#1A2130]">{row.label}</b>
                      </Td>
                      <Td right>{row.count}</Td>
                      <Td right>{won(row.amount)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ---------- 합계 ---------- */}
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-[#E8EBF0] px-5 py-4">
          {closed && (
            <Link
              href={`${basePath}/${yearMonth}`}
              className="mr-auto h-9 rounded-md border border-[#DDE2EA] px-3.5 text-[13.5px] font-semibold leading-9 text-[#4A5567] hover:opacity-80"
            >
              청구서 보기
            </Link>
          )}

          <dl className="w-[280px] space-y-1.5 text-[14px]">
            <Row label="보철 금액">{won(settlement.subtotal)}</Row>
            <Row label="조정 금액">{won(settlement.adjustment)}</Row>
            <div
              className="flex items-center justify-between border-t border-[#E8EBF0] pt-2 text-[15px] font-bold"
              style={{ color: accent }}
            >
              <dt>{amountLabel}</dt>
              <dd className="tabular-nums">{won(settlement.total)}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

// ---------- 조각들 ----------

function shiftMonth(ym: string, by: number): string {
  const [year, month] = ym.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + by, 1));

  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

function won(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₩${Math.abs(value).toLocaleString('ko-KR')}`;
}

function day(value: string | null): string {
  return value ? value.slice(0, 10) : '-';
}

function Arrow({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-[16px] text-[#4A5567] hover:bg-[#F4F6F9]"
    >
      {children}
    </Link>
  );
}

function TabButton({
  on,
  accent,
  onClick,
  children,
}: {
  on: boolean;
  accent: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={on ? { borderColor: accent, color: accent } : undefined}
      className={
        'border-b-2 px-4 py-3 text-[13.5px] font-semibold ' +
        (on ? '' : 'border-transparent text-[#98A2B3]')
      }
    >
      {children}
    </button>
  );
}

function Th({
  children,
  center,
  right,
}: {
  children: React.ReactNode;
  center?: boolean;
  right?: boolean;
}) {
  return (
    <th
      className={
        'whitespace-nowrap px-3 py-3 font-semibold ' +
        (center ? 'text-center' : right ? 'text-right' : 'text-left')
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
  right,
}: {
  children: React.ReactNode;
  center?: boolean;
  right?: boolean;
}) {
  return (
    <td
      className={
        'whitespace-nowrap px-3 py-3 tabular-nums text-[#4A5567] ' +
        (center ? 'text-center' : right ? 'text-right' : 'text-left')
      }
    >
      {children}
    </td>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[#4A5567]">
      <dt>{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}

function Empty({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center text-[14px] text-[#98A2B3]">
        이 기간에 배송된 건이 없습니다.
      </td>
    </tr>
  );
}
