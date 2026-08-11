// =========================================================
// 놓을 위치: src/components/billing/SettlementScreen.tsx
//
// 정산관리 — 거래처 하나의 한 기간. (사용자가 준 화면 기준)
//
// 시안과 다르게 한 곳 —
// ★ '1일 / 26일' 라디오를 없앴습니다.
//   정산 기준일은 이미 거래처 설정(사용자탭)에 있습니다. 화면에서 또 고르면
//   두 곳이 어긋나고, 26일 치과를 실수로 1일로 뽑으면 지난달과 겹치거나 빕니다.
//   대신 달을 ◀ ▶ 로 넘기고, 그 달이 실제로 며칠부터 며칠인지 적어 둡니다.
//   기간을 손으로 잡아야 할 때만 '직접 선택' 을 켭니다.
//
// ★ 단가를 안 정한 줄은 0원이 아니라 '미정' 으로 찍고 위에 세어 보여 줍니다.
//   조용히 0원으로 청구하면 돈을 못 받고 아무도 모릅니다.
// =========================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PartnerRow } from '@/server/repositories/partner';
import Link from 'next/link';
import CloseBar from '@/components/billing/CloseBar';
import AdjustCell from '@/components/billing/AdjustCell';
import type { Settlement } from '@/server/repositories/billing';

type Tab = 'products' | 'items';

export interface SettlementScreenProps {
  parties: PartnerRow[];
  partner: PartnerRow | null;
  /** 보고 있는 정산 달. '2026-08' */
  yearMonth: string;
  settlement: Settlement | null;
  closed: boolean;
  paid: boolean;
  issued: boolean;
  /** 마감할 수 없으면 그 이유 */
  closeBlockedReason?: string;
}

export default function SettlementScreen({
  parties,
  partner,
  yearMonth,
  settlement,
  closed,
  paid,
  issued,
  closeBlockedReason,
}: SettlementScreenProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('items');

  const type = partner?.orgType ?? 'clinic';
  const shown = parties.filter((p) => p.orgType === type);

  function go(next: { party?: string; ym?: string; type?: string }) {
    const params = new URLSearchParams();

    if (next.type) {
      params.set('type', next.type);
    } else {
      params.set('type', type);
      params.set('party', next.party ?? partner?.id ?? '');
      params.set('ym', next.ym ?? yearMonth);
    }

    router.push(`/design/billing?${params}`);
  }

  return (
    <div className="space-y-3">
      {/* ---------- 거래처 고르기 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white px-5 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="사용자 타입">
            <select
              value={type}
              onChange={(e) => go({ type: e.target.value })}
              className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8]"
            >
              <option value="clinic">치과</option>
              <option value="lab">기공소</option>
            </select>
          </Field>

          <Field label={type === 'clinic' ? '치과명' : '기공소명'}>
            <select
              value={partner?.id ?? ''}
              onChange={(e) => go({ party: e.target.value })}
              className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[13px] outline-none focus:border-[#5546C8]"
            >
              <option value="">선택해 주세요</option>
              {shown.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isActive ? '' : ' (거래중지)'}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {!partner ? (
        <p className="rounded-lg border border-[#E8EBF0] bg-white px-5 py-16 text-center text-[13px] text-[#98A2B3]">
          거래처를 고르면 그 기간의 정산이 나옵니다.
        </p>
      ) : (
        <>
          {/* ---------- 거래처 정보 + 기간 ---------- */}
          <section className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white px-5 py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label={type === 'clinic' ? '치과명' : '기공소명'}>
                <ReadOnly value={partner.name} />
              </Field>
              <Field label="대표자명">
                <ReadOnly value={partner.ceoName} />
              </Field>
              <Field label="주소">
                <ReadOnly value={partner.address} />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Field label="이메일" ok={Boolean(partner.invoiceEmail)}>
                <ReadOnly value={partner.invoiceEmail} />
              </Field>
              <Field label="팩스 번호" ok={Boolean(partner.fax)}>
                <ReadOnly value={partner.fax} />
              </Field>
              <Field label="정산 기준일">
                <ReadOnly value={`매월 ${partner.closingDay}일`} />
              </Field>
              <Field label="청구서 상태">
                <span
                  className={
                    'inline-flex h-10 items-center rounded-md px-3 text-[13px] font-semibold ' +
                    (paid
                      ? 'bg-[#E6F4EE] text-[#12855B]'
                      : closed
                        ? 'bg-[#FEF3E7] text-[#C2721B]'
                        : 'bg-[#F4F6F9] text-[#4A5567]')
                  }
                >
                  {paid ? '입금' : closed ? '미입금' : '마감 전'}
                </span>
              </Field>
            </div>

            {/* ★ 기준일이 기간을 정합니다. 화면에서 다시 고르지 않습니다 */}
            <div className="flex flex-wrap items-center gap-3 border-t border-[#F0F2F5] pt-4">
              <span className="text-[12px] font-semibold text-[#4A5567]">이용기간</span>

              <span className="flex items-center gap-1">
                <Arrow label="이전 달" onClick={() => go({ ym: shiftMonth(yearMonth, -1) })}>
                  ‹
                </Arrow>
                <b className="min-w-[86px] text-center text-[15px] font-bold tabular-nums text-[#1A2130]">
                  {yearMonth}
                </b>
                <Arrow label="다음 달" onClick={() => go({ ym: shiftMonth(yearMonth, 1) })}>
                  ›
                </Arrow>
              </span>

              <span className="rounded-md bg-[#F4F6F9] px-3 py-1.5 text-[13px] tabular-nums text-[#4A5567]">
                {settlement?.from} ~ {settlement?.to}
              </span>

              <span className="text-[12px] text-[#98A2B3]">
                {partner.closingDay}일 기준 · 배송일로 가릅니다
              </span>

              <span className="ml-auto flex items-center gap-2">
                <CloseBar
                  partyOrgId={partner.id}
                  partnerName={partner.name}
                  yearMonth={yearMonth}
                  from={settlement?.from ?? ''}
                  to={settlement?.to ?? ''}
                  blockedReason={closeBlockedReason}
                  closed={closed}
                  issued={issued}
                  itemCount={settlement?.items.length ?? 0}
                  total={settlement?.total ?? 0}
                  unpricedCount={settlement?.unpricedCount ?? 0}
                />

                {closed && (
                  <Link
                    href={`/design/billing/${partner.id}/${yearMonth}`}
                    className="h-9 rounded-md border border-[#DDE2EA] px-3.5 text-[12.5px] font-semibold leading-9 text-[#4A5567] hover:border-[#5546C8] hover:text-[#5546C8]"
                  >
                    청구서 보기
                  </Link>
                )}
              </span>
            </div>
          </section>

          {/* ---------- 굳은 기간 안내 ---------- */}
          {closed && (
            <p className="rounded-lg border border-[#CDE6DA] bg-[#F2FAF6] px-5 py-3 text-[13px] text-[#0F6B4A]">
              마감된 기간입니다. 아래 금액은 마감할 때 굳은 값이라, 그 뒤에 단가를 고치거나
              주문을 손대도 달라지지 않습니다.
            </p>
          )}

          {/* ---------- 단가 미정 경고 ---------- */}
          {!closed && settlement && settlement.unpricedCount > 0 && (
            <p className="rounded-lg border border-[#F5C6C4] bg-[#FDF2F2] px-5 py-3 text-[13px] text-[#B3312C]">
              단가를 안 정한 보철이 <b className="font-bold">{settlement.unpricedCount}줄</b>{' '}
              있습니다. 지금은 0원으로 잡혀 있어 그대로 마감하면 못 받습니다 — 사용자탭에서 이
              거래처 단가를 채워 주세요.
            </p>
          )}

          {/* ---------- 내역 ---------- */}
          <section className="rounded-lg border border-[#E8EBF0] bg-white">
            <div className="flex gap-1 border-b border-[#E8EBF0] px-4">
              <TabButton on={tab === 'products'} onClick={() => setTab('products')}>
                청구 내역
              </TabButton>
              <TabButton on={tab === 'items'} onClick={() => setTab('items')}>
                보철 세부내역
                <span className="ml-1.5 text-[11.5px] text-[#98A2B3]">
                  {settlement?.items.length ?? 0}
                </span>
              </TabButton>
            </div>

            {tab === 'products' ? (
              <ProductTable settlement={settlement} />
            ) : (
              <ItemTable
              settlement={settlement}
              isClinic={type === 'clinic'}
              partyOrgId={partner.id}
              editable={!closed}
            />
            )}

            {/* ---------- 합계 ---------- */}
            <div className="flex justify-end border-t border-[#E8EBF0] px-5 py-4">
              <dl className="w-[280px] space-y-1.5 text-[13px]">
                <Row label={type === 'clinic' ? '보철 금액' : '기공 원가'}>
                  {won(settlement?.subtotal ?? 0)}
                </Row>
                <Row label="조정 금액">{won(settlement?.adjustment ?? 0)}</Row>
                <div className="flex items-center justify-between border-t border-[#E8EBF0] pt-2 text-[15px] font-bold text-[#5546C8]">
                  <dt>{type === 'clinic' ? '총 청구액' : '총 지급액'}</dt>
                  <dd className="tabular-nums">{won(settlement?.total ?? 0)}</dd>
                </div>
              </dl>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ---------- 표 ----------

function ProductTable({ settlement }: { settlement: Settlement | null }) {
  const rows = settlement?.products ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-[#E8EBF0] text-[12.5px] text-[#4A5567]">
            <Th className="w-[60px] text-center">#</Th>
            <Th>제품</Th>
            <Th className="text-right">수량</Th>
            <Th className="text-right">금액</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <Empty colSpan={4} />
          ) : (
            rows.map((row, i) => (
              <tr key={row.key} className="border-b border-[#F0F2F5] text-[13px]">
                <Td className="text-center text-[#98A2B3]">{i + 1}</Td>
                <Td>
                  <b className="font-semibold text-[#1A2130]">{row.label}</b>
                  {row.unpriced && <Unpriced />}
                </Td>
                <Td className="text-right tabular-nums">{row.count}</Td>
                <Td className="text-right tabular-nums">{won(row.amount)}</Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ItemTable({
  settlement,
  isClinic,
  partyOrgId,
  editable,
}: {
  settlement: Settlement | null;
  isClinic: boolean;
  partyOrgId: string;
  editable: boolean;
}) {
  const rows = settlement?.items ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-[#E8EBF0] text-[12.5px] text-[#4A5567]">
            <Th>접수일</Th>
            <Th>배송일</Th>
            <Th>환자명</Th>
            <Th>제품</Th>
            <Th className="text-center">치식</Th>
            <Th className="text-right">조정 금액</Th>
            <Th className="text-right">{isClinic ? '금액' : '기공 원가'}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <Empty colSpan={7} />
          ) : (
            rows.map((row) => (
              <tr
                key={row.itemId}
                className={
                  'border-b border-[#F0F2F5] text-[13px] ' + (row.billable ? '' : 'bg-[#FFFBF4]')
                }
              >
                <Td className="tabular-nums">{day(row.receivedAt)}</Td>
                <Td className="tabular-nums">{day(row.shippedAt)}</Td>
                <Td>
                  {row.patientLabel}
                  {/* 리메이크 표기는 (다)안 — 리메이크는 'N차' */}
                  {row.isRemake && (
                    <span className="ml-1.5 text-[11.5px] font-semibold text-[#C2721B]">
                      {row.remakeSeq}차
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="text-[#5546C8]">{row.label}</span>
                  {row.hasGingival && (
                    <span className="ml-1.5 text-[11px] text-[#98A2B3]">+핑크</span>
                  )}
                </Td>
                <Td className="text-center tabular-nums">{row.toothNumber}</Td>
                <Td className="text-right tabular-nums">
                  <AdjustCell
                    itemId={row.itemId}
                    partyOrgId={partyOrgId}
                    label={`${row.patientLabel} · ${row.toothNumber}번 ${row.label}`}
                    amount={row.adjustment}
                    editable={editable && row.billable}
                  />
                </Td>
                <Td className="text-right tabular-nums">
                  {!row.billable ? (
                    <span className="text-[#C2721B]">₩0</span>
                  ) : row.unpriced ? (
                    <Unpriced />
                  ) : (
                    won(row.amount)
                  )}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- 조각들 ----------

/** 정산 달을 앞뒤로 넘깁니다 */
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

function Unpriced() {
  return (
    <span className="ml-1.5 rounded bg-[#FDF2F2] px-1.5 py-0.5 text-[11px] font-bold text-[#B3312C]">
      단가 미정
    </span>
  );
}

function Field({
  label,
  ok,
  children,
}: {
  label: string;
  ok?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[12px] font-semibold text-[#4A5567]">
        {label}
        {ok !== undefined && (
          <span className={ok ? 'text-[#12855B]' : 'text-[#C4CBD6]'} title={ok ? '있음' : '비어 있음'}>
            ●
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function ReadOnly({ value }: { value: string | null }) {
  return (
    <span className="flex h-10 items-center rounded-md bg-[#F8F9FB] px-2.5 text-[13px] text-[#4A5567]">
      {value || <span className="text-[#C4CBD6]">-</span>}
    </span>
  );
}

function Arrow({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-[16px] text-[#4A5567] hover:bg-[#F4F6F9]"
    >
      {children}
    </button>
  );
}

function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'border-b-2 px-4 py-3 text-[13.5px] font-semibold ' +
        (on ? 'border-[#5546C8] text-[#5546C8]' : 'border-transparent text-[#98A2B3]')
      }
    >
      {children}
    </button>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-3 py-3 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`whitespace-nowrap px-3 py-3 text-[#4A5567] ${className}`}>{children}</td>
  );
}

function Empty({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center text-[13px] text-[#98A2B3]">
        이 기간에 배송된 건이 없습니다.
      </td>
    </tr>
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
