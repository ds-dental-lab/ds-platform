// =========================================================
// 놓을 위치: src/app/(dev)/playground/home/page.tsx
//
// HOME 화면을 로그인 없이 혼자 띄워 봅니다. **개발 중에만 열립니다**
// ((dev)/layout 이 운영에서 404 를 냅니다).
//
// ★ 만든 이유: HOME 은 섹터마다·값이 있고 없고에 따라 모양이 크게
//   다른데, 그걸 보려면 계정 셋으로 번갈아 로그인해야 했습니다.
//   빈 화면(갓 가입한 치과)은 특히 만들기가 어렵습니다 — 주문을
//   전부 지워야 나옵니다. 열 맞춤이 틀어지는 곳이 대개 거기입니다.
//
// ★ 여기 자료는 **가짜**입니다. 열 맞춤과 빈 칸 모양만 봅니다.
//   숫자가 맞는지는 repositories/home 의 일입니다.
// =========================================================

import HomeScreen from '@/components/home/HomeScreen';
import type { Sector } from '@/server/domain/order-status';
import type { HomeSummary } from '@/server/repositories/home';

const EMPTY_BUCKET = { amount: 0, from: '', to: '', orderCount: 0, unpricedCount: 0 };

/** 갓 가입한 조직 — 어느 칸에도 값이 없습니다 */
const BLANK: HomeSummary = {
  statusCounts: {},
  issueCounts: {},
  todayDeliveries: [],
  pickups: [],
  money: { current: EMPTY_BUCKET, trend: [], basis: 'period', countBy: 'received' },
  worklist: [],
  notices: [],
};

/** 한창 도는 조직 */
const BUSY: HomeSummary = {
  statusCounts: {
    rescan: 2,
    received: 7,
    designing: 4,
    production_wait: 3,
    production: 5,
    shipping: 1,
  },
  issueCounts: { rescan: 2, remake: 1, repair: 3, analog: 1 },
  todayDeliveries: [
    { id: '1', patientLabel: '김O수 (M/54)', clinicName: '연세치과', status: 'shipping' },
    { id: '2', patientLabel: '박O영 (F/38)', clinicName: '연세치과', status: 'production' },
    { id: '3', patientLabel: '이O민 (M/29)', clinicName: '미소치과', status: 'production' },
  ],
  pickups: [
    {
      id: 'p1',
      clinicName: '연세치과',
      dueDate: '08-14',
      memo: '상악 모델',
      orderId: '1',
      status: 'open',
      kind: 'model',
      waiting: true,
    },
    {
      id: 'p2',
      clinicName: '미소치과',
      dueDate: '08-15',
      memo: '',
      orderId: '2',
      status: 'done',
      kind: 'impression',
      waiting: false,
    },
  ],
  money: {
    current: { amount: 1_240_000, from: '2026-07-26', to: '2026-08-25', orderCount: 17, unpricedCount: 2 },
    trend: [
      { amount: 980_000, from: '2026-02-26', to: '2026-03-25', orderCount: 12, unpricedCount: 0 },
      { amount: 1_450_000, from: '2026-03-26', to: '2026-04-25', orderCount: 19, unpricedCount: 0 },
      { amount: 1_120_000, from: '2026-04-26', to: '2026-05-25', orderCount: 15, unpricedCount: 0 },
      { amount: 1_680_000, from: '2026-05-26', to: '2026-06-25', orderCount: 22, unpricedCount: 0 },
      { amount: 1_310_000, from: '2026-06-26', to: '2026-07-25', orderCount: 18, unpricedCount: 0 },
      { amount: 1_240_000, from: '2026-07-26', to: '2026-08-25', orderCount: 17, unpricedCount: 2 },
    ],
    basis: 'period',
    countBy: 'received',
  },
  worklist: [
    {
      id: '1',
      clinicName: '연세치과',
      patientLabel: '김O수 (M/54)',
      dueDate: '2026-08-15',
      status: 'designing',
      designerName: '이대신',
      ownerId: 'u1',
      startedOn: '2026-08-11',
      dayCount: 3,
    },
    {
      id: '2',
      clinicName: '미소치과',
      patientLabel: '박O영 (F/38)',
      dueDate: '2026-08-16',
      status: 'designing',
      designerName: '',
      ownerId: null,
      startedOn: '2026-08-13',
      dayCount: 1,
    },
  ],
  notices: [
    {
      id: 'n1',
      title: '8월 26일 첫 정산 마감 안내',
      body: '',
      audience: 'all',
      isPinned: true,
      publishedAt: '2026-08-10',
      createdAt: '2026-08-10',
      authorName: '덴플로우 디지털 기공소',
    },
    {
      id: 'n2',
      title: '광복절 휴무 안내',
      body: '',
      audience: 'all',
      isPinned: false,
      publishedAt: '2026-08-08',
      createdAt: '2026-08-08',
      authorName: '덴플로우 디지털 기공소',
    },
  ],
};

const CASES: { key: string; label: string; sector: Sector; summary: HomeSummary; money?: boolean }[] = [
  { key: 'clinic-blank', label: '치과 · 값 없음', sector: 'clinic', summary: BLANK },
  { key: 'clinic-busy', label: '치과 · 값 있음', sector: 'clinic', summary: BUSY },
  { key: 'clinic-user', label: '치과 · 사용자(금액 없음)', sector: 'clinic', summary: BUSY, money: false },
  { key: 'design-busy', label: '디자인센터', sector: 'design_center', summary: BUSY },
  { key: 'lab-busy', label: '기공소', sector: 'lab', summary: BUSY },
];

export default function HomePlayground() {
  return (
    <div className="min-h-screen bg-[#F4F6F9] p-6">
      {CASES.map((c) => (
        <section key={c.key} className="mb-10">
          <h1 className="mb-2 text-[14px] font-bold text-[#4A5567]">{c.label}</h1>
          <HomeScreen
            sector={c.sector}
            summary={c.summary}
            
            canSeeMoney={c.money !== false}
          />
        </section>
      ))}
    </div>
  );
}
