// =========================================================
// 놓을 위치: src/components/fit-value/FitValueBoard.tsx
//
// 내면값 관리탭 표. (사용자가 준 시안 — EXOCAD 내면값 관리 화면)
//
// 표 칸은 시안 그대로 —
//   치과명 · 자연치 · CNC · Inlay · PLA · PMMA · 맞결 · 단일 ·
//   Hook · 임플란트 · 등록여부
//
// ★ 시안의 '기공소 · 담당자' 칸은 뺐습니다.
//   그 시스템은 치과에 기공소가 고정으로 붙지만, 우리는 주문마다
//   디자인센터가 배정합니다 — 여기 적어 두면 거짓말이 됩니다.
//
// ★ 음수는 빨갛게 찍습니다 (시안 그대로).
//   컨택 음수는 '그만큼 꽉' 이라는 뜻이라, 한눈에 갈려야 합니다.
//
// ★ 줄을 누르면 수정 창입니다. 값이 일곱에 글이 둘이라
//   표에서 바로 고치게 하면 칸이 좁아 오타를 냅니다.
//
// ★ 비고(치과 특징)도 표에 보입니다 (2026-08-19).
//   손으로 적는 글이라 '누가 적혀 있고 누가 비었는지' 가 한눈에
//   보여야 채우게 됩니다. 줄바꿈은 표에서 ' · ' 로 이어 한 줄로
//   보여 주고, 원문은 마우스를 올리면 뜹니다.
// =========================================================

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  FIT_NUMBER_FIELDS,
  formatFit,
  isRegistered,
} from '@/server/domain/fit-value';
import type { FitBoardRow } from '@/server/repositories/fit-value';
import FitValueDialog from '@/components/fit-value/FitValueDialog';

/** 표에서는 여러 줄을 한 줄로 잇습니다 */
const NEWLINE = String.fromCharCode(10);

export interface FitValueBoardProps {
  rows: FitBoardRow[];
}

export default function FitValueBoard({ rows }: FitValueBoardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<FitBoardRow | null>(null);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;

    return rows.filter((r) => r.clinicName.toLowerCase().includes(k));
  }, [rows, keyword]);

  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white">
      {/* ---------- 머리줄 ---------- */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <span className="text-[13.5px] text-[#98A2B3]">
          등록 {rows.filter((r) => isRegistered(r.values)).length} / 치과 {rows.length}
        </span>

        <div className="ml-auto">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="치과명 검색..."
            className="h-9 w-[240px] rounded-md border border-[#DDE2EA] px-3 text-[14px] outline-none focus:border-[#5546C8]"
          />
        </div>
      </div>

      {/* ---------- 표 ---------- */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] border-collapse">
          <thead>
            <tr className="border-y border-[#E8EBF0] text-[13.5px] text-[#4A5567]">
              <Th left>치과명</Th>
              {FIT_NUMBER_FIELDS.map((f) => (
                <Th key={f.key}>{f.label}</Th>
              ))}
              <Th>Hook</Th>
              <Th>임플란트</Th>
              {/* ★ 손으로 적는 치과 특징. 주문상세 카드에 그대로 나갑니다 */}
              <Th left>비고 · 치과 특징</Th>
              <Th>등록여부</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-16 text-center text-[14px] text-[#98A2B3]">
                  {keyword ? '찾는 치과가 없습니다.' : '등록된 치과가 없습니다.'}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const registered = isRegistered(row.values);

                return (
                  <tr
                    key={row.clinicOrgId}
                    onClick={() => setEditing(row)}
                    className={
                      'cursor-pointer border-b border-[#F0F2F5] text-[14px] hover:bg-[#F8F9FB] ' +
                      (row.isActive ? '' : 'opacity-55')
                    }
                  >
                    <Td left>
                      <b className="font-semibold text-[#1A2130]">{row.clinicName}</b>
                      {!row.isActive && (
                        <span className="ml-1.5 text-[12px] text-[#98A2B3]">(거래중지)</span>
                      )}
                    </Td>

                    {FIT_NUMBER_FIELDS.map((f) => (
                      <Td key={f.key}>
                        <Num value={row.values?.[f.key] ?? null} />
                      </Td>
                    ))}

                    <Td>
                      <b
                        className={
                          'text-[13.5px] font-bold ' +
                          (row.values?.hook ? 'text-[#12855B]' : 'text-[#98A2B3]')
                        }
                      >
                        {row.values?.hook ? 'O' : 'X'}
                      </b>
                    </Td>

                    <Td>
                      <span className="block max-w-[130px] truncate text-[13.5px]">
                        {row.values?.implantNote || '-'}
                      </span>
                    </Td>

                    <Td left>
                      {row.values?.note ? (
                        /* 줄바꿈이 있어도 표에서는 한 줄로 — 자세히는 눌러서 봅니다 */
                        <span
                          title={row.values.note}
                          className="block max-w-[260px] truncate text-[13px] text-[#4A5567]"
                        >
                          {row.values.note.split(NEWLINE).map((l) => l.trim()).filter(Boolean).join(' · ')}
                        </span>
                      ) : (
                        <span className="text-[13px] text-[#C4CBD6]">-</span>
                      )}
                    </Td>

                    <Td>
                      <span
                        className={
                          'rounded px-2 py-0.5 text-[12.5px] font-bold ' +
                          (registered
                            ? 'bg-[#E6F4EE] text-[#12855B]'
                            : 'bg-[#F4F6F9] text-[#98A2B3]')
                        }
                      >
                        {registered ? '등록' : '미등록'}
                      </span>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <FitValueDialog
          clinicOrgId={editing.clinicOrgId}
          clinicName={editing.clinicName}
          values={editing.values}
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

/** 음수는 빨갛게 — 시안 그대로 */
function Num({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[#C4CBD6]">-</span>;

  return (
    <span className={'tabular-nums ' + (value < 0 ? 'text-[#D8453F]' : 'text-[#4A5567]')}>
      {formatFit(value)}
    </span>
  );
}

function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return (
    <th
      className={
        'whitespace-nowrap px-3 py-3 font-semibold ' + (left ? 'text-left' : 'text-center')
      }
    >
      {children}
    </th>
  );
}

function Td({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return (
    <td
      className={
        'whitespace-nowrap px-3 py-3.5 ' + (left ? 'text-left' : 'text-center')
      }
    >
      {children}
    </td>
  );
}
