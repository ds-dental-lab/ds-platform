// =========================================================
// 놓을 위치: src/components/home/MoneyTrend.tsx
//
// HOME 왼쪽 아래 — 최근 여섯 구간의 금액.
//
// ★ 달력 월이 아니라 **정산 구간**입니다 (치과·기공소).
//   26일 기준 치과에게 '7월' 은 06-26~07-25 입니다. 그래프만 달력 월로
//   그리면 막대 하나하나가 정산서와 다른 것을 말하게 됩니다.
//   구간은 domain/billing 의 moneyRanges 가 정합니다.
//
// ★ 막대를 **가로로 눕힙니다.**
//   처음엔 세로로 세웠는데, 창을 1024 로 줄이면 카드가 225px 이 되고
//   여섯 칸이 한 칸에 24px 씩 남습니다. 금액 글자(`1,438만`)가 38px 이라
//   옆 막대 글자와 겹쳤습니다 — 재 보니 두 군데서 실제로 겹쳤습니다.
//   이 카드는 좁고 깁니다(225~350 × 300). 가로로 누우면 달 이름·막대·금액이
//   각자 제 칸을 갖고, 창을 줄이면 막대만 짧아집니다.
//
// ★ 마지막 줄은 **아직 안 끝난 구간**이라 달리 그립니다.
//   다 지난 달들과 똑같이 그려 놓으면 "이번 달은 왜 이렇게 적나" 로
//   읽힙니다. 실은 아직 안 끝났을 뿐입니다.
//
// ★ 그림 라이브러리를 쓰지 않습니다.
//   막대 여섯 개에 차트 라이브러리를 얹으면 그것만 수십 KB 이고,
//   'use client' 가 붙어 이 카드 하나 때문에 브라우저가 일을 합니다.
//   너비 %만 있으면 되는 그림입니다.
// =========================================================

import type { MoneyBucket } from '@/server/repositories/home-money';

export interface MoneyTrendProps {
  title: string;
  empty: string;
  /** 오래된 것부터. 마지막이 이번 구간입니다 */
  buckets: MoneyBucket[];
  /** 건수 앞에 붙는 말 — '접수' · '배송' */
  countLabel: string;
  /**
   * 바깥에서 주는 자리 지정.
   *
   * ★ HOME 왼쪽 칸에서 **남는 높이를 가져가는 카드**가 이것입니다(`flex-1`).
   *   그래서 높이를 여기에 박아 두지 않습니다 — 전에는 `min-h-[300px]`
   *   이었는데, 막대가 여섯 줄이라 실제로는 그보다 짧고 값이 없으면
   *   훨씬 짧습니다. 그 차이가 그대로 빈칸이 됐습니다.
   */
  className?: string;
}

export default function MoneyTrend({
  title,
  empty,
  buckets,
  countLabel,
  className = '',
}: MoneyTrendProps) {
  const max = Math.max(...buckets.map((b) => b.amount), 0);
  const nothing = buckets.length === 0 || max === 0;

  return (
    <section
      className={
        'flex flex-col rounded-lg border border-[#E8EBF0] bg-white px-5 py-4 ' + className
      }
    >
      <div className="flex items-baseline gap-2">
        <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">{title}</h2>
        {!nothing && (
          <span className="ml-auto shrink-0 text-[12.5px] text-[#98A2B3]">
            가장 많은 달 {compactWon(max)}
          </span>
        )}
      </div>

      {nothing ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-[14px] text-[#98A2B3]">
          {empty}
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-1">
            {buckets.map((bucket, i) => {
              const last = i === buckets.length - 1;

              /* ★ 0 이 아닌데 안 보이면 안 됩니다.
                 가장 큰 달의 1/200 짜리 달도 자국이 있어야 '있긴 있다' 가 보입니다 */
              const width =
                bucket.amount === 0 ? 0 : Math.max(2, Math.round((bucket.amount / max) * 100));

              return (
                <li
                  key={bucket.from}
                  title={`${bucket.from} ~ ${bucket.to} · ${countLabel} ${bucket.orderCount}건 · ₩${bucket.amount.toLocaleString('ko-KR')}`}
                  className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-[5px] hover:bg-[#F8F9FB]"
                >
                  <span
                    className={
                      'text-[12.5px] tabular-nums ' +
                      (last ? 'font-bold text-[#1279E8]' : 'text-[#98A2B3]')
                    }
                  >
                    {monthLabel(bucket.to)}
                  </span>

                  {/* 바탕을 깔아 둡니다 — 0원인 달도 줄이 있다는 게 보여야 합니다 */}
                  <span className="h-[9px] w-full rounded-full bg-[#F0F3F7]">
                    <span
                      style={{ width: `${width}%` }}
                      className={
                        'block h-full rounded-full ' +
                        // 아직 안 끝난 구간 — 옅게, 테두리만 진하게
                        (last ? 'border border-dashed border-[#1279E8] bg-[#DCEAFB]' : 'bg-[#1279E8]')
                      }
                    />
                  </span>

                  <span
                    className={
                      'text-right text-[12.5px] tabular-nums ' +
                      (last ? 'font-bold text-[#1279E8]' : 'font-semibold text-[#4A5567]')
                    }
                  >
                    {bucket.amount === 0 ? '-' : compactWon(bucket.amount)}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 px-1 text-[11px] text-[#98A2B3]">
            마지막 줄은 아직 안 끝난 구간입니다. 줄에 손을 얹으면 정확한 금액이 나옵니다.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * 구간의 이름은 **끝나는 달**입니다.
 *
 * 06-26~07-25 는 '7월 정산' 입니다 (domain/billing 의 periodRange 와 같은 약속).
 * 1월은 해가 바뀌었다는 것이 보여야 해서 연도를 붙입니다.
 */
function monthLabel(to: string): string {
  const month = Number(to.slice(5, 7));

  return month === 1 ? `${to.slice(2, 4)}.1` : `${month}월`;
}

/**
 * 좁은 칸에 들어가는 금액 — `143.8만`
 *
 * ★ 만 단위로 접습니다. 여섯 줄 오른쪽에 ₩14,380,000 을 그대로 쓰면
 *   막대가 설 자리가 없어집니다. 정확한 값은 줄에 손을 얹으면 나옵니다.
 */
function compactWon(amount: number): string {
  if (amount < 10000) return amount.toLocaleString('ko-KR');

  const man = amount / 10000;
  const shown = man >= 1000 ? Math.round(man) : Math.round(man * 10) / 10;

  return `${shown.toLocaleString('ko-KR')}만`;
}
