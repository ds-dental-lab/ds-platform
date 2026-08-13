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
  /** 손으로 넣은 날짜. 프리셋으로 보고 있으면 빈 문자열입니다 */
  from: string;
  to: string;
  /**
   * 칸에 **보여 줄** 날짜 — 프리셋으로 보고 있을 때도 채웁니다.
   *
   * ★ from/to 와 나눠 받습니다. 이 둘을 합치면 '프리셋으로 보는 중' 과
   *   '손으로 넣은 중' 을 구별할 수 없어, 아래 프리셋 단추가 늘 꺼진
   *   것처럼 보입니다.
   */
  shownFrom: string;
  shownTo: string;
  clinic: string;
  patient: string;
  /** 치과 계정은 자기 치과뿐이라 치과명 칸이 필요 없습니다 */
  showClinicSearch: boolean;
  children?: React.ReactNode;
}

const CTL =
  'h-9 rounded border border-[#DDE2EA] px-3 text-[14px] outline-none focus:border-blue-500';

export default function OrderSearchBar({
  basePath,
  params,
  range,
  from,
  to,
  shownFrom,
  shownTo,
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

        <span className="text-[14px] font-bold text-[#4A5567]">기간</span>

        {/*
          ★ 프리셋으로 보고 있을 때도 **실제 날짜를 채워 둡니다**
            (사용자 지적 2026-08-13 — "기간에 숫자가 전부 비워져 있다").
            전에는 손으로 넣은 날짜가 있을 때만 채워서, '1년' 으로 보는
            평소에는 두 칸이 늘 비어 있었습니다. 지금 어느 구간을 보고
            있는지 화면 어디에도 안 적혀 있었던 셈입니다.

          ★ '전체' 는 시작 칸이 빕니다. 시작이 없는 것이 사실입니다.
            없는 날짜를 지어내면 그 날짜 이전 주문이 없는 것처럼 보입니다.
        */}
        <input type="date" name="from" defaultValue={shownFrom} className={`${CTL} w-[172px]`} />
        <span className="text-[#98A2B3]">~</span>
        <input type="date" name="to" defaultValue={shownTo} className={`${CTL} w-[172px]`} />

        <div className="ml-1 flex items-center gap-1">
          {RANGE_PRESETS.map((preset) => {
            const on = range === preset && !customDate;

            return (
              <Link
                key={preset}
                href={rangeHref(preset)}
                className={
                  'rounded px-3 py-1.5 text-[14px] transition-colors ' +
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
              <span className="text-[14px] font-bold text-[#4A5567]">치과명</span>
              <input name="clinic" defaultValue={clinic} className={`${CTL} w-[180px]`} />
            </>
          )}

          <span className="text-[14px] font-bold text-[#4A5567]">환자명</span>
          <input name="patient" defaultValue={patient} className={`${CTL} w-[180px]`} />

          <button className="h-9 rounded bg-[#1279E8] px-5 text-[14px] font-semibold text-white hover:bg-[#0F68C9]">
            검색
          </button>

          {(from || to || clinic || patient) && (
            <Link href={basePath} className="text-[13px] text-[#98A2B3] hover:text-[#4A5567]">
              지우기
            </Link>
          )}
        </div>
      </form>

      {children}
    </div>
  );
}
