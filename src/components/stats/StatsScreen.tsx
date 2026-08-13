// =========================================================
// 놓을 위치: src/components/stats/StatsScreen.tsx
//
// 관리 통계 (초안). 디자인센터만 봅니다.
//
// ★ 이 화면은 **어디를 들여다볼지 고르는 자리**입니다.
//   평가표가 아닙니다. 리메이크가 곧 디자인 잘못은 아닙니다 —
//   쉐이드가 안 맞았을 수도, 치과에서 다시 뜬 것일 수도 있습니다.
//   화면에 그렇게 적어 둡니다. 안 적으면 숫자가 혼자 걸어다닙니다.
//
// ★ 비율 옆에 늘 건수를 붙입니다.
//   '33.3%' 만 있으면 세 건 중 한 건인지 서른 건 중 열 건인지 모릅니다.
//   모수가 적으면 표를 답니다.
//
// ★ 차례는 일한 양으로 잡습니다 (domain/stats).
//   리메이크율로 줄 세우면 화면을 열자마자 사람이 맨 위에 섭니다.
// =========================================================

import Link from 'next/link';
import { formatPercent, isSmallSample } from '@/server/domain/stats';
import type { DesignStats } from '@/server/repositories/stats';

export interface StatsScreenProps {
  stats: DesignStats;
  /** 기간 고르개가 쓰는 값들 */
  months: { value: string; label: string }[];
  month: string;
}

export default function StatsScreen({ stats, months, month }: StatsScreenProps) {
  return (
    <div className="space-y-3.5">
      {/* ---------- 머리 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[15px] font-bold tracking-tight text-[#1A2130]">관리 통계</h1>
          <span className="rounded bg-[#FEF3E2] px-1.5 py-0.5 text-[11px] font-bold text-[#B5761B]">
            초안
          </span>

          <div className="ml-auto flex gap-1.5">
            {months.map((m) => (
              <Link
                key={m.value}
                href={`/design/stats?month=${m.value}`}
                className={
                  'h-8 rounded-md border px-3 text-[12.5px] font-semibold leading-8 ' +
                  (m.value === month
                    ? 'border-[#1279E8] bg-[#E7EEFA] text-[#1279E8]'
                    : 'border-[#DDE2EA] text-[#4A5567] hover:bg-[#F4F6F9]')
                }
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-1 text-[12px] text-[#98A2B3]">
          {stats.from} ~ {stats.to} · <b className="font-semibold">접수일</b> 기준입니다
        </p>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="접수" value={`${stats.orders}건`} />
          <Stat label="리메이크" value={`${stats.remakes}건`} />
          <Stat label="리페어" value={`${stats.repairs}건`} />
          <Stat
            label="리메이크율"
            value={formatPercent(stats.remakeRate)}
            warn={isSmallSample(stats.orders)}
          />
        </div>
      </section>

      {/* ---------- 디자이너별 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <header className="flex items-baseline gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">디자이너별 일량</h2>
          <span className="text-[12px] text-[#98A2B3]">{stats.designers.length}명</span>
        </header>

        <p className="border-b border-[#E8EBF0] bg-[#FBFCFD] px-5 py-2.5 text-[12px] leading-relaxed text-[#98A2B3]">
          <b className="font-semibold text-[#4A5567]">배정된 담당 디자이너</b>를 기준으로 셉니다.
          리메이크는 <b className="font-semibold text-[#4A5567]">원주문을 디자인한 사람</b>에게
          답니다 — 다만 리메이크 사유가 디자인 탓이 아닌 경우가 많습니다.
          <br />
          <b className="font-semibold text-[#4A5567]">완성 금액</b>은 그 기간에{' '}
          <b className="font-semibold text-[#4A5567]">배송된</b> 건의 치과 판매가입니다. 깎아 준
          조정은 빼지 않고, 리메이크·리페어는 0원입니다. 사람을 세우는 숫자가 아니라 어디를
          들여다볼지 고르는 숫자로 봐 주세요.
        </p>

        {stats.designers.length === 0 ? (
          <Empty>이 기간에 디자인을 잡은 기록이 없습니다.</Empty>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-[12px] text-[#98A2B3]">
                <Th className="pl-5">디자이너</Th>
                <Th right>잡음</Th>
                <Th right>넘김</Th>
                <Th right>완성 금액</Th>
                <Th right>평균 소요</Th>
                <Th right>리메이크</Th>
                <Th right className="pr-5">
                  리메이크율
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
              {stats.designers.map((row) => (
                <tr key={row.userId} className="hover:bg-[#F8F9FB]">
                  <Td className="pl-5 font-semibold text-[#1A2130]">{row.name}</Td>
                  <Td right>{row.picked}</Td>
                  <Td right>{row.handed}</Td>
                  {/*
                    ★ 단가 미정이 섞이면 그 사실을 답니다 (2026-08-13).
                      0원으로 조용히 세면 그 사람 능률이 낮아 보입니다.
                  */}
                  <Td right>
                    <span className="font-semibold tabular-nums text-[#1A2130]">
                      {row.amount.toLocaleString('ko-KR')}
                    </span>
                    {row.amountUnpriced && (
                      <span
                        title="단가를 안 정한 제품이 섞여 있어 실제보다 적습니다"
                        className="ml-1 font-bold text-[#B3312C]"
                      >
                        *
                      </span>
                    )}
                  </Td>
                  <Td right>{row.avgDays === null ? '—' : `${row.avgDays}일`}</Td>
                  <Td right>{row.remade}</Td>
                  <Td right className="pr-5">
                    <RateCell part={row.remade} whole={row.handed} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------- 치과별 ---------- */}
      <section className="rounded-lg border border-[#E8EBF0] bg-white">
        <header className="flex items-baseline gap-2 border-b border-[#E8EBF0] px-5 py-3.5">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1A2130]">치과별 주문</h2>
          <span className="text-[12px] text-[#98A2B3]">{stats.clinics.length}곳</span>
        </header>

        {stats.clinics.length === 0 ? (
          <Empty>이 기간에 들어온 주문이 없습니다.</Empty>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-[12px] text-[#98A2B3]">
                <Th className="pl-5">치과</Th>
                <Th right>주문</Th>
                <Th right>리메이크</Th>
                <Th right>리페어</Th>
                <Th right className="pr-5">
                  리메이크율
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
              {stats.clinics.map((row) => (
                <tr key={row.orgId} className="hover:bg-[#F8F9FB]">
                  <Td className="pl-5 font-semibold text-[#1A2130]">{row.name}</Td>
                  <Td right>{row.orders}</Td>
                  <Td right>{row.remakes}</Td>
                  <Td right>{row.repairs}</Td>
                  <Td right className="pr-5">
                    <RateCell part={row.remakes} whole={row.orders} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------- 아직 못 넣은 것 ---------- */}
      <section className="rounded-lg border border-dashed border-[#DDE2EA] bg-[#FBFCFD] px-5 py-4">
        <h2 className="text-[13px] font-bold tracking-tight text-[#4A5567]">
          아직 못 넣은 것
        </h2>
        <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-[#98A2B3]">
          <li>· 제품별·재료별 물량, 기공소별 납기 지킴률</li>
          <li>· 달끼리 견주기 (지난달 대비 ↑↓)</li>
          <li>· 내려받기 (엑셀)</li>
        </ul>
      </section>
    </div>
  );
}

// ---------- 조각들 ----------

function RateCell({ part, whole }: { part: number; whole: number }) {
  const value = whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

  return (
    <span className={value !== null && value >= 10 ? 'font-bold text-[#C77700]' : ''}>
      {formatPercent(value)}
      {/* ★ 모수가 적으면 비율을 믿을 수 없습니다 — 세 건 중 하나가 33.3% 입니다 */}
      {isSmallSample(whole) && (
        <span className="ml-1 text-[11px] font-normal text-[#C4CBD6]" title="건수가 적어 비율을 믿기 어렵습니다">
          ({whole}건)
        </span>
      )}
    </span>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md border border-[#E8EBF0] px-3 py-2.5">
      <p className="text-[11.5px] text-[#98A2B3]">{label}</p>
      <p className="mt-0.5 text-[18px] font-extrabold tracking-[-0.03em] tabular-nums text-[#1A2130]">
        {value}
        {warn && <span className="ml-1 text-[11px] font-normal text-[#C4CBD6]">건수 적음</span>}
      </p>
    </div>
  );
}

function Th({
  children,
  right,
  className = '',
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th className={`px-2 py-2 font-medium ${right ? 'text-right' : ''} ${className}`}>{children}</th>
  );
}

function Td({
  children,
  right,
  className = '',
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-2 py-2.5 tabular-nums ${right ? 'text-right' : ''} ${className}`}>
      {children}
    </td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center text-[13px] text-[#98A2B3]">{children}</p>;
}
