// =========================================================
// 놓을 위치: src/components/order/ClinicPicker.tsx
//
// 대리등록에서 '어느 치과 주문인가' 를 고릅니다.
// 사용자탭에 등록된 거래처 치과가 나옵니다.
//
// ★ 거래중지 치과는 목록에 없습니다.
//   끊은 치과에 새 주문이 들어가면 청구할 데가 없습니다.
//   서버와 RLS(order_insert) 가 한 번 더 막지만, 고를 수 있게 두면
//   다 적고 나서 저장 단계에서 튕깁니다.
//
// ★ 고르면 주소가 바뀝니다 (?clinic=).
//   치과마다 즐겨찾기(임플란트 · 제작옵션)가 달라 서버에서 다시 읽어야 합니다.
//   그 치과 원장의 즐겨찾기가 나와야 대리등록이 제 몫을 합니다.
// =========================================================

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export interface ClinicOption {
  id: string;
  name: string;
  ceoName: string | null;
  address: string | null;
}

export interface ClinicPickerProps {
  clinics: ClinicOption[];
}

export default function ClinicPicker({ clinics }: ClinicPickerProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');

  const found = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return clinics;

    return clinics.filter((c) =>
      [c.name, c.ceoName, c.address]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(k)),
    );
  }, [clinics, keyword]);

  return (
    <div className="mx-auto max-w-[640px] pt-6">
      <div className="rounded-lg border border-[#E8EBF0] bg-white p-6">
        <h2 className="text-[16px] font-bold tracking-tight text-[#1A2130]">
          어느 치과 주문인가요?
        </h2>
        <p className="mt-1 text-[12.5px] text-[#98A2B3]">
          고른 치과의 주문으로 등록됩니다. 정산도 그 치과로 잡힙니다.
        </p>

        <div className="relative mt-4">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]">
            <SearchIcon />
          </span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="치과명 · 대표자명 · 주소로 검색"
            autoFocus
            className="h-11 w-full rounded-md border border-[#DDE2EA] pl-9 pr-3 text-[13.5px] outline-none focus:border-[#5546C8]"
          />
        </div>

        <div className="mt-3 max-h-[420px] overflow-y-auto">
          {clinics.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[#98A2B3]">
              거래중인 치과가 없습니다. 사용자탭에서 먼저 등록해 주세요.
            </p>
          ) : found.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[#98A2B3]">
              &lsquo;{keyword}&rsquo; 로 찾은 치과가 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-[#F0F2F5]">
              {found.map((clinic) => (
                <li key={clinic.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/design/orders/new?clinic=${clinic.id}`)}
                    className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-[#F8F9FB]"
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold text-[#1A2130]">
                        {clinic.name}
                      </b>
                      <span className="block truncate text-[12px] text-[#98A2B3]">
                        {[clinic.ceoName, clinic.address].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[#C4CBD6]">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {clinics.length > 0 && (
          <p className="mt-3 border-t border-[#F0F2F5] pt-3 text-[11.5px] text-[#98A2B3]">
            거래중인 치과 {clinics.length}곳. 거래중지한 곳은 나오지 않습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}
