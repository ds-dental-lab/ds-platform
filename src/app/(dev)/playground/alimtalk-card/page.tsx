// =========================================================
// 놓을 위치: src/app/(dev)/playground/alimtalk-card/page.tsx
//
// 계정정보의 기관 정보 폼과 알림톡 카드를 로그인 없이 눈으로 보는 시연 화면 (2026-09-11).
// 번호는 가짜입니다. 저장 단추는 로그인이 없어 실패하는 게 맞습니다.
// =========================================================

import AlimtalkCard from '@/components/account/AlimtalkCard';
import AccountForm from '@/components/account/AccountForm';

export const dynamic = 'force-dynamic';

const EVENTS = ['새 주문 접수', '리메이크 접수', '리페어 접수 · 수거 요청'];

export default function AlimtalkCardPlayground() {
  return (
    <main className="mx-auto max-w-[860px] space-y-8 bg-[#F4F6F9] p-8">
      {/* 치과 계정정보 — 정산서를 둘 다로 받는데 이메일·팩스가 비어 있는 경우 (경고 두 줄 정렬 확인) */}
      <AccountForm
        basePath="/clinic"
        editable
        org={{
          name: '테스트치과', code: null, orgType: 'clinic', ceoName: '홍길동', bizNo: null, tel: '02-000-0000',
          fax: null, address: null, invoiceEmail: null, taxEmail: null, invoiceMethod: 'all', closingDay: 26,
        }}
      />
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
