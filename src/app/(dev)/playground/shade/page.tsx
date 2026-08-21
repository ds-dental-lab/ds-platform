// =========================================================
// 놓을 위치: src/app/(dev)/playground/shade/page.tsx
//
// 진료실 모바일 화면 시연. (명세서 SPEC_shade-photo)
//
// ★ 진짜 화면(/m)은 치과 로그인이 필요해서, 모양은 여기서 봅니다.
//   시안(prototype/shade-photo-prototype.html)과 나란히 놓고 맞춥니다.
// =========================================================

'use client';

import { useState } from 'react';
import ShadeHome from '@/components/shade/ShadeHome';
import ShadeCaseScreen from '@/components/shade/ShadeCaseScreen';
import ShadeMatch from '@/components/shade/ShadeMatch';
import UnsortedBoxList from '@/components/shade/UnsortedBoxList';
import type { ShadeCase, ShadeCaseDetail } from '@/server/repositories/shade-photo';

const NOW = new Date();
const at = (h: number, m: number, dayBack = 0) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - dayBack);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const CASES: ShadeCase[] = [
  {
    id: '1', orderNo: 'ORD-260821-001', patientLabel: '김민서',
    workLabel: '#26 · 1개', status: 'received', shade: 'waiting',
    createdAt: at(10, 42), photoCount: 0,
  },
  {
    id: '2', orderNo: 'ORD-260821-002', patientLabel: '박정호',
    workLabel: '#36 · 1개', status: 'received', shade: 'waiting',
    createdAt: at(9, 15), photoCount: 0,
  },
  {
    id: '3', orderNo: 'ORD-260821-003', patientLabel: '이수아',
    workLabel: '#46 · 1개', status: 'designing', shade: 'done',
    createdAt: at(8, 50), photoCount: 3,
  },
  {
    id: '4', orderNo: 'ORD-260820-007', patientLabel: '최유진',
    workLabel: '#11 #12 · 2개', status: 'designing', shade: 'done',
    createdAt: at(16, 5, 1), photoCount: 2,
  },
];

const DETAIL: ShadeCaseDetail = {
  ...CASES[0],
  labName: '덴플로우 치과기공소',
  photos: [],
};

const DETAIL_DONE: ShadeCaseDetail = {
  ...CASES[2],
  labName: '덴플로우 치과기공소',
  photos: [
    // 시연용 — 진짜 화면에서는 저장소가 줄여 준 주소가 들어옵니다
    { id: 'p1', fileName: 'shade1.jpg', createdAt: at(8, 55), thumbUrl: '', viewUrl: '' },
    { id: 'p2', fileName: 'shade2.jpg', createdAt: at(8, 56), thumbUrl: '', viewUrl: '' },
    { id: 'p3', fileName: 'shade3.jpg', createdAt: at(8, 56), thumbUrl: '', viewUrl: '' },
  ],
};

const FRAME =
  'w-[375px] shrink-0 overflow-hidden rounded-[28px] border-[6px] border-[#1A2130] bg-[#F4F7FA]';

export default function ShadePlayground() {
  const [tab, setTab] = useState<'home' | 'detail' | 'done' | 'match' | 'box'>('home');

  return (
    <main
      className="min-h-screen bg-[#E7ECF2] p-6"
      style={
        {
          '--ink': '#16324F',
          '--teal': '#14B8A6',
          '--muted': '#5B7186',
          '--line': '#E3E9EF',
          '--mist': '#EAF6F4',
        } as React.CSSProperties
      }
    >
      <h1 className="text-xl font-bold text-[#16324F]">진료실 모바일 — 쉐이드 촬영</h1>
      <p className="mt-1 text-[13px] text-[#5B7186]">
        진짜 주소는 /m 입니다(치과 로그인 필요). 폰 폭 375px 로 그렸습니다.
      </p>

      <div className="mt-4 flex gap-2">
        {(
          [
            ['home', 'S1 홈'],
            ['detail', 'S2 상세 (쉐이드 대기)'],
            ['done', 'S2 상세 (촬영 완료)'],
            ['match', 'S5 어디에 붙일까'],
            ['box', 'S6 미분류함'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              'rounded-lg px-3 py-2 text-[13px] font-semibold ' +
              (tab === key ? 'bg-[#16324F] text-white' : 'bg-white text-[#5B7186]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-6 overflow-x-auto pb-4">
        <div className={FRAME} style={{ height: 760 }}>
          <div className="h-full overflow-y-auto">
            {tab === 'home' && (
              <ShadeHome cases={CASES} clinicName="미사바른치과" keyword="" unsortedCount={4} />
            )}
            {tab === 'detail' && <ShadeCaseScreen data={DETAIL} />}
            {tab === 'done' && <ShadeCaseScreen data={DETAIL_DONE} />}
            {tab === 'match' && (
              <ShadeMatch
                sessionId="demo"
                count={2}
                cases={CASES}
                skipHref="/m/unsorted"
                skipLabel="나중에 분류 (미분류함으로)"
              />
            )}
            {tab === 'box' && (
              <UnsortedBoxList
                boxes={[
                  { sessionId: 'a', count: 3, takenAt: at(11, 20), thumbUrl: '' },
                  { sessionId: 'b', count: 1, takenAt: at(15, 40, 1), thumbUrl: '' },
                ]}
              />
            )}
          </div>
        </div>

        <div className="max-w-[380px] text-[13px] leading-[1.7] text-[#5B7186]">
          <b className="text-[#16324F]">맞춰 본 것</b>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>상태 칩 — 쉐이드 대기(#FEF3E2/#B45309) · 촬영 완료(#EAF6F4/#0E9384)</li>
            <li>날짜 묶음 — 오늘 · 어제</li>
            <li>상세 아래 고정 버튼 — 티일</li>
            <li>브랜드 토큰 — CLAUDE.md 그대로</li>
          </ul>

          <b className="mt-5 block text-[#16324F]">아직 안 만든 것</b>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>초성 검색 — 지금은 이름·주문번호로만</li>
            <li>사진 섬네일 — 원본이라 목록에 그대로 걸면 무겁습니다</li>
            <li>PWA 홈 화면 추가 (Phase 3)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
