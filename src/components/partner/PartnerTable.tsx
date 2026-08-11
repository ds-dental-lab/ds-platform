// =========================================================
// 놓을 위치: src/components/partner/PartnerTable.tsx
//
// 사용자탭 — 거래처(치과 · 기공소) 목록. (디자인센터, 시안 us-tbl)
//
// 표 여덟 칸 —
//   구분 · 상호 · 대표자명 · 대표 전화번호 · 사업자등록번호 ·
//   주소 · 단가 · 거래상태
//
// ★ 지우는 버튼을 두지 않습니다.
//   거래처를 지우면 그 치과의 지난 주문과 정산이 주인을 잃습니다.
//   끊을 때는 '거래중지' 로 내립니다 — 목록에는 남습니다.
//
// ★ 줄을 누르면 정보 창, '단가' 를 누르면 단가 화면으로 갑니다.
//   둘을 한 창에 넣으면 창이 너무 길어집니다 (제품이 수십 줄입니다).
// =========================================================

'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitTogglePartner } from '@/server/actions/partner';
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
          className="h-9 w-[150px] rounded-md border border-[#DDE2EA] px-3 text-[13px] outline-none focus:border-[#5546C8]"
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
              className="h-9 w-[240px] rounded-md border border-[#DDE2EA] pl-8 pr-3 text-[13px] outline-none focus:border-[#5546C8]"
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
            className="h-9 rounded-md bg-[#5546C8] px-4 text-[13px] font-bold text-white hover:bg-[#4536B8]"
          >
            + 추가 등록
          </button>
        </div>
      </div>

      {error && <p className="px-5 pb-2 text-[12.5px] text-[#D8453F]">{error}</p>}

      {/* ---------- 표 ---------- */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr className="border-y border-[#E8EBF0] text-[12.5px] text-[#4A5567]">
              <Th center>구분</Th>
              <Th>상호</Th>
              <Th>대표자명</Th>
              <Th>대표 전화번호</Th>
              <Th>사업자등록번호</Th>
              <Th>주소</Th>
              <Th center>단가</Th>
              <Th center>거래상태</Th>
            </tr>
          </thead>

          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-[13px] text-[#98A2B3]">
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
                    'cursor-pointer border-b border-[#F0F2F5] text-[13px] hover:bg-[#F8F9FB] ' +
                    (row.isActive ? '' : 'opacity-55')
                  }
                >
                  <Td center>
                    <span
                      className={
                        'rounded px-2 py-0.5 text-[11.5px] font-bold ' +
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
                      className="rounded-md border border-[#DDE2EA] px-2.5 py-1 text-[12px] font-semibold text-[#4A5567] hover:border-[#5546C8] hover:text-[#5546C8]"
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
                        'rounded-full px-2.5 py-1 text-[12px] font-semibold ' +
                        (row.isActive
                          ? 'text-[#12855B] hover:bg-[#E6F4EE]'
                          : 'text-[#98A2B3] hover:bg-[#F4F6F9]')
                      }
                    >
                      {row.isActive ? '거래중' : '거래중지'}
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- 페이징 ---------- */}
      <div className="flex items-center justify-end gap-4 px-5 py-3.5 text-[12.5px] text-[#4A5567]">
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

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1" />
      <path d="M13.7 2v3.3h-3.3" />
    </svg>
  );
}
