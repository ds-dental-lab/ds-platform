// =========================================================
// 놓을 위치: src/components/product/ProductTable.tsx
//
// 제품탭. (디자인센터, 사용자가 준 화면)
//
// 표 아홉 칸 —
//   보철물 종류 · 재료 · SHADE · PONTIC · 판매 가격 ·
//   가격(Pontic) · 가격(핑크 포셀린) · 표시 순서 · 판매 상태
//
// ★ 지우는 버튼을 두지 않습니다.
//   지난 주문이 이 제품을 가리키고 있어, 행을 없애면 그 주문의 보철
//   이름이 사라집니다. 안 팔 제품은 '판매중지' 로 내립니다 —
//   치과 주문등록에서만 빠지고 지난 주문은 그대로입니다.
//
// ★ '-' 와 '0' 을 구분해 찍습니다.
//   폰틱이 안 되는 제품은 '-', 되는데 값이 0 이면 '0' 입니다.
//   둘을 같게 보이면 "공짜인가 안 되는 건가" 를 알 수 없습니다.
//
// ★ 표시 순서가 곧 주문등록 칩의 순서입니다.
//   크라운 아래 지르코니아(1) · PMMA(2) 면 치과 화면에도 그 순서로 섭니다.
// =========================================================

'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitToggleProduct } from '@/server/actions/product';
import ProductDialog from '@/components/product/ProductDialog';
import TypeDialog from '@/components/product/TypeDialog';
import type { ProductRow, TypeOption } from '@/server/repositories/prosthesis';

const PER_PAGE = 15;

export interface ProductTableProps {
  rows: ProductRow[];
  types: TypeOption[];
}

export default function ProductTable({ rows, types }: ProductTableProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  /** 열려 있는 창 — 'new' 는 제품 등록, 행이면 수정 */
  const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
  const [typeDialog, setTypeDialog] = useState(false);

  const busy = saving || refreshing;

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;

    return rows.filter((r) =>
      [r.typeName, r.materialName, r.materialAbbr].some((v) => v.toLowerCase().includes(k)),
    );
  }, [rows, keyword]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  async function toggle(row: ProductRow) {
    setError('');
    setSaving(true);

    const result = await submitToggleProduct(row.materialId, !row.isActive);
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
              className="h-9 w-[240px] rounded-md border border-[#DDE2EA] pl-8 pr-3 text-[13px] outline-none focus:border-[#1279E8]"
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
            onClick={() => setTypeDialog(true)}
            className="h-9 rounded-md border border-[#DDE2EA] px-4 text-[13px] font-semibold text-[#4A5567] hover:border-[#5546C8] hover:text-[#5546C8]"
          >
            + 종류 등록
          </button>

          <button
            type="button"
            onClick={() => setEditing('new')}
            className="h-9 rounded-md bg-[#5546C8] px-4 text-[13px] font-bold text-white hover:bg-[#4536B8]"
          >
            + 제품 등록
          </button>
        </div>
      </div>

      {error && <p className="px-5 pb-2 text-[12.5px] text-[#D8453F]">{error}</p>}

      {/* ---------- 표 ---------- */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr className="border-y border-[#E8EBF0] text-[12.5px] text-[#4A5567]">
              <Th>보철물 종류</Th>
              <Th>재료</Th>
              <Th center>SHADE</Th>
              <Th center>PONTIC</Th>
              <Th right>판매 가격</Th>
              <Th right>가격(Pontic)</Th>
              <Th right>가격(핑크 포셀린)</Th>
              <Th center>표시 순서</Th>
              <Th center>판매 상태</Th>
            </tr>
          </thead>

          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-[13px] text-[#98A2B3]">
                  {keyword ? '찾는 제품이 없습니다.' : '등록된 제품이 없습니다.'}
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr
                  key={row.materialId}
                  onClick={() => setEditing(row)}
                  className={
                    'cursor-pointer border-b border-[#F0F2F5] text-[13px] hover:bg-[#F8F9FB] ' +
                    (row.isActive ? '' : 'opacity-55')
                  }
                >
                  <Td>
                    <b className="font-bold text-[#1A2130]">{row.typeName}</b>
                  </Td>
                  <Td>
                    <span className="text-[#5546C8]">{row.materialName}</span>
                  </Td>

                  <Td center>
                    <Flag on={row.hasShade} />
                  </Td>
                  <Td center>
                    <Flag on={row.hasPontic} />
                  </Td>

                  <Td right>{money(row.price)}</Td>
                  {/* 못 쓰는 항목은 '-', 쓸 수 있는데 0 이면 '0' */}
                  <Td right>{row.hasPontic ? money(row.ponticPrice) : '-'}</Td>
                  <Td right>{row.hasPink ? money(row.pinkPrice) : '-'}</Td>

                  <Td center>{row.sortOrder}</Td>

                  <Td center>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(row);
                      }}
                      title={row.isActive ? '누르면 판매중지' : '누르면 판매중'}
                      className={
                        'rounded-full px-2.5 py-1 text-[12px] font-semibold ' +
                        (row.isActive
                          ? 'text-[#12855B] hover:bg-[#E6F4EE]'
                          : 'text-[#98A2B3] hover:bg-[#F4F6F9]')
                      }
                    >
                      {row.isActive ? '판매중' : '판매중지'}
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
        <ProductDialog
          types={types}
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {typeDialog && (
        <TypeDialog
          nextSortOrder={types.length + 1}
          onClose={() => setTypeDialog(false)}
          onSaved={() => {
            setTypeDialog(false);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

// ---------- 조각들 ----------

/** 값이 없으면 '-'. 0 은 '0' 으로 찍습니다 */
function money(value: number | null): string {
  return value === null ? '-' : value.toLocaleString('ko-KR');
}

function Flag({ on }: { on: boolean }) {
  return (
    <span className={on ? 'font-bold text-[#5546C8]' : 'text-[#C4CBD6]'}>{on ? 'Y' : 'N'}</span>
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
        'whitespace-nowrap px-3 py-3.5 tabular-nums text-[#4A5567] ' +
        (center ? 'text-center' : right ? 'text-right' : 'text-left')
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
