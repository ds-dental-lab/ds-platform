// =========================================================
// 놓을 위치: src/app/(dev)/playground/alimtalk-card/page.tsx
//
// 계정정보의 알림톡 카드를 로그인 없이 눈으로 보는 시연 화면 (2026-09-11).
// 번호는 가짜입니다. 저장 단추는 로그인이 없어 실패하는 게 맞습니다.
// =========================================================

import AlimtalkCard from '@/components/account/AlimtalkCard';

export const dynamic = 'force-dynamic';

const EVENTS = ['새 주문 접수', '리메이크 접수', '리페어 접수 · 수거 요청'];

export default function AlimtalkCardPlayground() {
  return (
    <main className="mx-auto max-w-[860px] space-y-8 bg-[#F4F6F9] p-8">
      <AlimtalkCard
        phone="01012345678"
        on
        events={EVENTS}
        recent={[
          { title: '[DenFlow] 새 주문 접수', body: 'ORD-260911-001 · 김OO', at: '2026-09-11T14:02:00', status: 'pending' },
          { title: '[DenFlow] 새 주문 접수', body: 'ORD-260910-002 · dxd테스트', at: '2026-09-11T14:59:00', status: 'sent' },
          { title: '[DenFlow] 리페어 접수', body: 'ORD-260909-004 · 이OO', at: '2026-09-09T10:12:00', status: 'failed' },
        ]}
      />
    </main>
  );
}
