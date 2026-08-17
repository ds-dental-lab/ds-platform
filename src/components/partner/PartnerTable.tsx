// =========================================================
// 놓을 위치: src/components/partner/PartnerTable.tsx
//
// 사용자탭 — 거래처(치과 · 기공소) 목록. (디자인센터, 시안 us-tbl)
//
// 표 아홉 칸 —
//   구분 · 상호 · 대표자명 · 대표 전화번호 · 사업자등록번호 ·
//   주소 · 단가 · 거래상태 · (지우기)
//
// ★ 거래를 끊는 것은 '거래상태' 이고, 지우기는 다른 일입니다 (2026-08-17).
//   끊긴 거래처는 목록에 남아야 합니다 — 지난 주문과 정산의 주인입니다.
//   지우기는 **기록이 없는 줄**을 걷어 내는 단추입니다.
//   무엇이 막는지는 DB 가 판단하고, 이 화면은 그 말을 그대로 보여 줍니다.
//
// ★ 묻기 전에 **세어 봅니다** (checkDeletePartner).
//   줄 끝의 작은 단추라 손이 미끄러지기 쉬운데, 계정까지 함께 내려가는
//   일입니다. 무엇이 걸리고 무엇이 함께 내려가는지 숫자로 적은 다음에
//   묻습니다 — 세는 동안에는 숫자를 안 적습니다(잠깐 보인 0 이 거짓말이 됩니다).
//
// ★ 줄을 누르면 정보 창, '단가' 를 누르면 단가 화면으로 갑니다.
//   둘을 한 창에 넣으면 창이 너무 길어집니다 (제품이 수십 줄입니다).
// =========================================================

'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  submitTogglePartner,
  submitDeletePartner,
  checkDeletePartner,
  type PartnerDeletePlan,
} from '@/server/actions/partner';
import PartnerDialog from '@/components/partner/PartnerDialog';
import type { PartnerRow, PartnerType } from '@/server/repositories/partner';

const PER_PAGE = 15;

type Filter = 'all' | PartnerType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'clinic', label: '치과' },
  { value: 'lab', label: '기공소' },
];

export interface PartnerTableProps {
  rows: PartnerRow[];
}

export default function PartnerTable({ rows }: PartnerTableProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [filter, setFilter] = useState<Filter>('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  /** 열려 있는 창 — 'new' 는 등록, 행이면 수정 */
  const [editing, setEditing] = useState<PartnerRow | 'new' | null>(null);
  /** 지울지 묻고 있는 거래처 */
  const [asking, setAsking] = useState<PartnerRow | null>(null);
  /** 그 거래처를 지우면 무엇이 걸리는가. 아직 세는 중이면 null */
  const [plan, setPlan] = useState<PartnerDeletePlan | null>(null);

  const busy = saving || refreshing;

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();

    return rows.filter((r) => {
      if (filter !== 'all' && r.orgType !== filter) return false;
      if (!k) return true;

      return [r.name, r.ceoName, r.tel, r.bizNo, r.address]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(k));
    });
  }, [rows, filter, keyword]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  async function toggle(row: PartnerRow) {
    setError('');
    setSaving(true);

    const result = await submitTogglePartner(row.id, !row.isActive);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  /** 물음창을 열고, 무엇이 걸리는지 세어 옵니다 (아무것도 안 고칩니다) */
  async function ask(row: PartnerRow) {
    setError('');
    setPlan(null);
    setAsking(row);

    const result = await checkDeletePartner(row.id);

    if (!result.ok) {
      setAsking(null);
      setError(result.error);
      return;
    }

    setPlan(result.plan);
  }

  async function remove(row: PartnerRow) {
    setError('');
    setSaving(true);

    const result = await submitDeletePartner(row.id);
    setSaving(false);

    /*
      ★ 막혔을 때는 창을 닫습니다.
        이유가 표 위에 남아야 읽힙니다 — 창 안에 띄우면 '취소' 를 누르는
        순간 무엇 때문에 안 됐는지가 함께 사라집니다.
    */
    setAsking(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white">
      {/* ---------- 머리줄 ---------- */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as Filter);
            setPage(1);
          }}
          className="h-9 w-[150px] rounded-md border border-[#DDE2EA] px-3 text-[14px] outline-none focus:border-[#5546C8]"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3]">
              <SearchIcon />
            </span>
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="전체 검색..."
              className="h-9 w-[240px] rounded-md border border-[#DDE2EA] pl-8 pr-3 text-[14px] outline-none focus:border-[#5546C8]"
            />
          </div>

          <button
            type="button"
            onClick={() => startTransition(() => router.refresh())}
            aria-label="다시 읽기"
            className="grid h-9 w-9 place-items-center rounded-md text-[#98A2B3] hover:bg-[#F4F6F9]"
          >
            <RefreshIcon />
          </button>

          <button
            type="button"
            onClick={() => setEditing('new')}
            className="h-9 rounded-md bg-[#5546C8] px-4 text-[14px] font-bold text-white hover:bg-[#4536B8]"
          >
            + 추가 등록
          </button>
        </div>
      </div>

      {error && <p className="px-5 pb-2 text-[13.5px] text-[#D8453F]">{error}</p>}

      {/* ---------- 표 ---------- */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr className="border-y border-[#E8EBF0] text-[13.5px] text-[#4A5567]">
              <Th center>구분</Th>
              <Th>상호</Th>
              <Th>대표자명</Th>
              <Th>대표 전화번호</Th>
              <Th>사업자등록번호</Th>
              <Th>주소</Th>
              <Th center>단가</Th>
              <Th center>거래상태</Th>
              <Th center>
                <span className="sr-only">지우기</span>
              </Th>
            </tr>
          </thead>

          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-[14px] text-[#98A2B3]">
                  {keyword || filter !== 'all'
                    ? '찾는 거래처가 없습니다.'
                    : '등록된 거래처가 없습니다.'}
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setEditing(row)}
                  className={
                    'cursor-pointer border-b border-[#F0F2F5] text-[14px] hover:bg-[#F8F9FB] ' +
                    (row.isActive ? '' : 'opacity-55')
                  }
                >
                  <Td center>
                    <span
                      className={
                        'rounded px-2 py-0.5 text-[12.5px] font-bold ' +
                        (row.orgType === 'clinic'
                          ? 'bg-[#EDF3FE] text-[#1B63E8]'
                          : 'bg-[#E6F4EE] text-[#12855B]')
                      }
                    >
                      {row.orgType === 'clinic' ? '치과' : '기공소'}
                    </span>
                  </Td>

                  <Td>
                    <b className="font-semibold text-[#5546C8]">{row.name}</b>
                  </Td>
                  <Td>{row.ceoName ?? '-'}</Td>
                  <Td>{row.tel ?? '-'}</Td>
                  <Td>{row.bizNo ?? '-'}</Td>
                  <Td>
                    <span className="block max-w-[280px] truncate">{row.address ?? '-'}</span>
                  </Td>

                  {/* 단가는 줄이 길어 따로 화면을 둡니다 */}
                  <Td center>
                    <Link
                      href={`/design/users/${row.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md border border-[#DDE2EA] px-2.5 py-1 text-[13px] font-semibold text-[#4A5567] hover:border-[#5546C8] hover:text-[#5546C8]"
                    >
                      {row.overrideCount > 0 ? `개별 ${row.overrideCount}` : '기본가'}
                    </Link>
                  </Td>

                  <Td center>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(row);
                      }}
                      title={row.isActive ? '누르면 거래중지' : '누르면 거래중'}
                      className={
                        'rounded-full px-2.5 py-1 text-[13px] font-semibold ' +
                        (row.isActive
                          ? 'text-[#12855B] hover:bg-[#E6F4EE]'
                          : 'text-[#98A2B3] hover:bg-[#F4F6F9]')
                      }
                    >
                      {row.isActive ? '거래중' : '거래중지'}
                    </button>
                  </Td>

                  <Td center>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        ask(row);
                      }}
                      aria-label={`${row.name} 지우기`}
                      title="지우기"
                      className="grid h-7 w-7 place-items-center rounded text-[#C4CBD6] hover:bg-[#FDF2F2] hover:text-[#D8453F] disabled:cursor-not-allowed"
                    >
                      <TrashIcon />
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- 페이징 ---------- */}
      <div className="flex items-center justify-end gap-4 px-5 py-3.5 text-[13.5px] text-[#4A5567]">
        <span>
          페이지당 행 수: <b className="font-semibold">{PER_PAGE}</b>
        </span>
        <span>
          {filtered.length === 0
            ? '0'
            : `${(current - 1) * PER_PAGE + 1}-${Math.min(current * PER_PAGE, filtered.length)}`}{' '}
          / 총 {filtered.length}
        </span>

        <span className="flex items-center gap-0.5">
          <Pager label="|<" onClick={() => setPage(1)} disabled={current === 1} />
          <Pager label="‹" onClick={() => setPage(current - 1)} disabled={current === 1} />
          <Pager label="›" onClick={() => setPage(current + 1)} disabled={current === pages} />
          <Pager label=">|" onClick={() => setPage(pages)} disabled={current === pages} />
        </span>
      </div>

      {editing && (
        <PartnerDialog
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="px-7 pb-5 pt-7 text-center">
              <span
                className={
                  'mx-auto grid h-12 w-12 place-items-center rounded-full ' +
                  (plan?.blocked ? 'bg-[#FDF0E0] text-[#E09A1B]' : 'bg-[#FDF2F2] text-[#D8453F]')
                }
              >
                {plan?.blocked ? (
                  <b className="text-[20px] font-extrabold leading-none">!</b>
                ) : (
                  <TrashIcon big />
                )}
              </span>

              <h3 className="mt-4 text-[15.5px] font-bold tracking-tight text-[#1A2130]">
                {plan?.blocked ? `${asking.name} 은(는) 지울 수 없습니다` : `${asking.name} 을(를) 지울까요?`}
              </h3>

              {/* ★ 세는 동안에는 아무 숫자도 안 적습니다 — 잠깐 보인 0 이 거짓말이 됩니다 */}
              {!plan ? (
                <p className="mt-3 text-[13.5px] text-[#98A2B3]">무엇이 걸리는지 보고 있습니다…</p>
              ) : plan.blocked ? (
                <>
                  <p className="mt-3 rounded-md border border-[#F0DCBB] bg-[#FEFAF3] px-3 py-2.5 text-left text-[13.5px] leading-relaxed text-[#8A6314]">
                    {plan.blocked}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#98A2B3]">
                    거래중지로 내리면 목록에는 남고 새 주문만 막힙니다. 지난 주문과 청구서는
                    그대로입니다.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[#98A2B3]">
                    목록에서 사라지고, 이 거래처에 넣어 둔 개별 단가도 함께 지워집니다.
                  </p>

                  {/* ★ 계정을 함께 내리는 일은 반드시 미리 밝힙니다 */}
                  {plan.members > 0 && (
                    <p className="mt-3 rounded-md border border-[#F5C6C4] bg-[#FDF2F2] px-3 py-2.5 text-left text-[13px] leading-relaxed text-[#B3312C]">
                      이 거래처의 <b className="font-bold">계정 {plan.members}개</b>도 함께
                      내려갑니다. 그 사람은 다음 로그인부터 소속이 없어져 &lsquo;승인
                      대기&rsquo; 화면을 봅니다.
                    </p>
                  )}

                  <p className="mt-3 rounded-md bg-[#F8F9FB] px-3 py-2 text-left text-[13px] leading-relaxed text-[#4A5567]">
                    살아 있는 주문 {plan.orders}건 · 정산 기록 {plan.periods}건 — 걸리는 것이
                    없습니다. 거래만 끊을 때는{' '}
                    <b className="font-semibold text-[#1A2130]">거래중지</b> 로 내려 주세요.
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setAsking(null)}
                disabled={busy}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                {plan?.blocked ? '닫기' : '취소'}
              </button>

              {!plan?.blocked && (
                <button
                  type="button"
                  onClick={() => remove(asking)}
                  disabled={busy || !plan}
                  className="h-11 flex-1 rounded-md bg-[#D8453F] text-[13.5px] font-bold text-white hover:bg-[#C03A34] disabled:opacity-60"
                >
                  {busy ? '지우는 중…' : '지우기'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 조각들 ----------

function Th({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <th
      className={
        'whitespace-nowrap px-3 py-3 font-semibold ' + (center ? 'text-center' : 'text-left')
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <td
      className={
        'whitespace-nowrap px-3 py-3.5 text-[#4A5567] ' + (center ? 'text-center' : 'text-left')
      }
    >
      {children}
    </td>
  );
}

function Pager({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid h-7 w-7 place-items-center rounded text-[#98A2B3] hover:bg-[#F4F6F9] disabled:cursor-not-allowed disabled:text-[#DDE2EA] disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}

function TrashIcon({ big }: { big?: boolean }) {
  const size = big ? 20 : 15;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.6h4V4" />
      <path d="M4 4l.7 9.4h6.6L12 4" />
      <path d="M6.6 6.6v4.4M9.4 6.6v4.4" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1" />
      <path d="M13.7 2v3.3h-3.3" />
    </svg>
  );
}
