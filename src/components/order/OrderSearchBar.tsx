// =========================================================
// 놓을 위치: src/components/order/OrderSearchBar.tsx
//
// 주문목록 검색줄. (기능명세서 §4.3, 시안 .listbar .lb-row)
//
// 배치 — 한 줄입니다.
//   왼쪽: 기간 라벨 · 시작일 ~ 종료일 · 프리셋(3개월/6개월/1년/전체)
//   오른쪽 끝: 치과명 · 환자명 · 검색  (시안 `.lb-right { margin-left:auto }`)
//
// 조건을 주소에 남기려고 GET 폼을 씁니다.
// 새로고침·뒤로가기·링크 공유가 모두 그대로 동작합니다.
// =========================================================

import Link from 'next/link';
import { RANGE_PRESETS, type RangePreset } from '@/server/domain/order-list';

export interface OrderSearchBarProps {
  basePath: string;
  params: Record<string, string>;
  range: RangePreset;
  from: string;
  to: string;
  clinic: string;
  patient: string;
  /** 치과 계정은 자기 치과뿐이라 치과명 칸이 필요 없습니다 */
  showClinicSearch: boolean;
  children?: React.ReactNode;
}

const CTL =
  'h-9 rounded border border-[#DDE2EA] px-3 text-[13px] outline-none focus:border-blue-500';

export default function OrderSearchBar({
  basePath,
  params,
  range,
  from,
  to,
  clinic,
  patient,
  showClinicSearch,
  children,
}: OrderSearchBarProps) {
  function rangeHref(preset: RangePreset): string {
    const next = new URLSearchParams(params);
    next.set('range', preset);
    // 프리셋을 고르면 직접 넣은 날짜는 지웁니다
    next.delete('from');
    next.delete('to');
    next.delete('page');
    return `${basePath}?${next.toString()}`;
  }

  const customDate = Boolean(from || to);

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-[18px] pb-3 pt-3.5">
      <form method="get" className="flex flex-wrap items-center gap-2.5">
        {/* 아이콘 필터·정렬은 검색해도 유지되어야 합니다 */}
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.issue && <input type="hidden" name="issue" value={params.issue} />}
        {params.sort && <input type="hidden" name="sort" value={params.sort} />}
        {params.dir && <input type="hidden" name="dir" value={params.dir} />}

        <span className="text-[13px] font-bold text-[#4A5567]">기간</span>

        <input type="date" name="from" defaultValue={from} className={`${CTL} w-[172px]`} />
        <span className="text-[#98A2B3]">~</span>
        <input type="date" name="to" defaultValue={to} className={`${CTL} w-[172px]`} />

        <div className="ml-1 flex items-center gap-1">
          {RANGE_PRESETS.map((preset) => {
            const on = range === preset && !customDate;

            return (
              <Link
                key={preset}
                href={rangeHref(preset)}
                className={
                  'rounded px-3 py-1.5 text-[13px] transition-colors ' +
                  (on
                    ? 'bg-[#EDF3FE] font-semibold text-[#1279E8]'
                    : 'text-[#4A5567] hover:bg-[#F4F6F9]')
                }
              >
                {preset}
              </Link>
            );
          })}
        </div>

        {/* 오른쪽 끝 — 시안 .lb-right */}
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          {showClinicSearch && (
            <>
              <span className="text-[13px] font-bold text-[#4A5567]">치과명</span>
              <input name="clinic" defaultValue={clinic} className={`${CTL} w-[180px]`} />
            </>
          )}

          <span className="text-[13px] font-bold text-[#4A5567]">환자명</span>
          <input name="patient" defaultValue={patient} className={`${CTL} w-[180px]`} />

          <button className="h-9 rounded bg-[#1279E8] px-5 text-[13px] font-semibold text-white hover:bg-[#0F68C9]">
            검색
          </button>

          {(from || to || clinic || patient) && (
            <Link href={basePath} className="text-[12px] text-[#98A2B3] hover:text-[#4A5567]">
              지우기
            </Link>
          )}
        </div>
      </form>

      {children}
    </div>
  );
}
