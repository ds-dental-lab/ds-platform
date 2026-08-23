// =========================================================
// 놓을 위치: src/components/shade/ShadeHome.tsx
//
// S1 — 오늘 의뢰 목록. 시안(shade-photo-prototype.html)을 그대로 옮깁니다.
//
// ★ 문구는 시안 것을 씁니다 — '쉐이드 대기', '촬영 완료',
//   '바로 촬영 · 나중에 분류' (CLAUDE.md 코드 컨벤션).
//
// ★ 날짜로 묶습니다. 진료실은 '오늘 것' 만 보면 됩니다 —
//   어제 것이 섞여 있으면 오늘 찍을 것을 못 찾습니다.
// =========================================================

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import DenFlowLogo from '@/components/brand/DenFlowLogo';
import ShadeQuickShot from '@/components/shade/ShadeQuickShot';
import PhotoQueueBar from '@/components/shade/PhotoQueueBar';
import { SHADE_STATUS_LABEL, type ShadeStatus } from '@/server/domain/shade-photo';
import { matchesAny } from '@/server/domain/hangul';
import type { ShadeCase } from '@/server/repositories/shade-photo';

const CHIP: Record<ShadeStatus, string> = {
  waiting: 'bg-[#FEF3E2] text-[#B45309]',
  done: 'bg-[#EAF6F4] text-[#0E9384]',
};

/**
 * 그 날짜의 이름표.
 *
 * ★★ **toISOString() 을 쓰면 안 됩니다.** 그건 UTC 라, 한국 시각으로
 *   오전 9시 이전에 만든 주문은 전날로 계산됩니다. 실제로 오전 8:50
 *   주문이 '어제 · 8월 21일' 이라는 말이 안 되는 묶음으로 떨어졌습니다.
 *   진료실은 아침 일찍 시작합니다 — 매일 겪을 버그였습니다.
 *
 * ★ 그래서 **폰의 날짜**로 셉니다. 보는 사람이 한국에 있고, 묶는
 *   기준도 그 사람의 '오늘' 입니다.
 */
function dayKey(d: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** '오늘 · 8월 21일 (금)' */
function dayLabel(iso: string, today: string, yesterday: string): string {
  const d = new Date(iso);
  const key = dayKey(d);
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const body = `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`;

  if (key === today) return `오늘 · ${body}`;
  if (key === yesterday) return `어제 · ${body}`;
  return body;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const half = h < 12 ? '오전' : '오후';
  const hour = h % 12 === 0 ? 12 : h % 12;

  return `${half} ${hour}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ShadeHome({
  cases,
  clinicName,
  keyword,
  clinicOrgId,
  unsortedCount = 0,
}: {
  cases: ShadeCase[];
  clinicName: string;
  keyword: string;
  /** 미분류 사진이 올라갈 자리. 없으면 '바로 촬영' 을 안 그립니다(시연 화면) */
  clinicOrgId?: string;
  unsortedCount?: number;
}) {
  const [q, setQ] = useState(keyword);

  /*
    ★★ **치는 대로 즉시** 좁힙니다. 서버에 물으면 글자마다 왕복이
      생기고, 진료실에서는 그게 느림으로 느껴집니다.
      최근 7일은 백 줄 남짓이라 브라우저가 거르는 편이 빠릅니다.

    ★ 초성으로 찾습니다 — 'ㄱㅁㅅ' 로 김민서 (명세서 S1).
      이름을 다 치고 있을 시간이 없습니다.
  */
  const shown = useMemo(
    () => cases.filter((c) => matchesAny([c.patientLabel, c.orderNo], q)),
    [cases, q],
  );

  const now = new Date();
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);

  // 날짜별로 묶습니다 — 이미 최신순으로 왔으므로 순서가 유지됩니다
  const groups: { label: string; rows: ShadeCase[] }[] = [];
  for (const c of shown) {
    const label = dayLabel(c.createdAt, today, yesterday);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(c);
    else groups.push({ label, rows: [c] });
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-28 pt-6">
      {/*
        ★ 못 보낸 사진이 있으면 **맨 위에** 붙습니다. 안 보이면
          아무도 다시 안 보냅니다.
      */}
      <PhotoQueueBar />

      <div className="flex items-center justify-between">
        <DenFlowLogo markHeight={20} fontSize={19} />
        <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[12.5px] font-semibold text-[var(--muted)]">
          {clinicName}
        </span>
      </div>

      <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.5px] text-[var(--ink)]">
        쉐이드 촬영
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[var(--muted)]">
        환자를 선택하면 사진이 해당 의뢰서에 자동 첨부됩니다
      </p>

      {/*
        ★ 미분류함이 비어 있으면 안 그립니다. 늘 0 인 입구는 자리만
          차지하고 눈을 흐립니다.
      */}
      {unsortedCount > 0 && (
        <Link
          href="/m/unsorted"
          className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#FEF3E2] px-4 py-3 active:bg-[#FDE9CC]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#B45309" strokeWidth="1.8" />
            <path
              d="M4.5 17l4.5-4.5 3.5 3 3-2.5 4 4"
              stroke="#B45309"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="flex-1 text-[13.5px] font-bold text-[#B45309]">
            미분류함에 사진 {unsortedCount}장
          </span>
          <span className="text-[13px] text-[#B45309]" aria-hidden="true">
            &#8250;
          </span>
        </Link>
      )}

      <div className="relative mt-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="환자명 검색 (ㄱㅁㅅ 가능)"
          className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 pr-10 text-[14.5px] outline-none placeholder:text-[#9FB0C0] focus:border-[var(--teal)]"
        />

        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="지우기"
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[15px] text-[#9FB0C0]"
          >
            &#10005;
          </button>
        )}
      </div>

      {groups.length === 0 && (
        <p className="mt-12 text-center text-[14px] text-[var(--muted)]">
          {q.trim() ? '찾는 의뢰가 없습니다' : '아직 촬영할 의뢰가 없습니다'}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.label} className="mt-6">
          <h2 className="mb-2 text-[12.5px] font-bold tracking-[0.2px] text-[var(--muted)]">
            {g.label}
          </h2>

          <ul className="space-y-2.5">
            {g.rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/m/${c.id}`}
                  className="flex items-center gap-3.5 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(22,50,79,0.06)] active:bg-[#F7FAFC]"
                >
                  {/* 치아 아이콘 — 브랜드 심볼의 능선을 작게 */}
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                    style={{ background: c.shade === 'done' ? 'var(--mist)' : '#F1F5F9' }}
                  >
                    <svg width="22" height="14" viewBox="3.5 27 113 60" fill="none" aria-hidden="true">
                      <path
                        d="M8 82 H 24 C 33 82, 27 44, 44 34 C 51 30, 55 40, 60 40 C 65 40, 69 30, 76 34 C 93 44, 87 82, 96 82"
                        stroke={c.shade === 'done' ? '#14B8A6' : '#94A3B8'}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[16px] font-bold text-[var(--ink)]">
                      {c.patientLabel}
                    </b>
                    <span className="mt-0.5 block truncate text-[12.5px] text-[var(--muted)]">
                      {c.workLabel} · {timeLabel(c.createdAt)} 작성
                    </span>
                  </span>

                  <span
                    className={
                      'shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ' + CHIP[c.shade]
                    }
                  >
                    {SHADE_STATUS_LABEL[c.shade]}
                    {c.shade === 'done' && c.photoCount > 1 ? ` ${c.photoCount}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {clinicOrgId && <ShadeQuickShot clinicOrgId={clinicOrgId} />}
    </main>
  );
}
