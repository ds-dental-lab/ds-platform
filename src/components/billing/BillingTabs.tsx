// =========================================================
// 놓을 위치: src/components/billing/BillingTabs.tsx
//
// 정산관리 위쪽 탭. (사용자가 쓰던 화면 그대로 — 정산 · 청구 내역 ·
// 정산 내역 · 조정 내역)
//
// ★ 넷이 서로 다른 것을 봅니다.
//     정산      아직 안 굳은 이번 기간. 마감하러 오는 자리
//     청구 내역 이미 나간 문서. 번호가 붙어 있습니다
//     정산 내역 들어온 돈
//     조정 내역 깎거나 더한 금액과 그 사유
//   섞으면 "이건 보낸 건가 아직인가" 가 흐려집니다.
// =========================================================

import Link from 'next/link';

const TABS = [
  { href: '/design/billing', label: '정산' },
  { href: '/design/billing/invoices', label: '청구 내역' },
  { href: '/design/billing/payments', label: '정산 내역' },
  { href: '/design/billing/adjustments', label: '조정 내역' },
];

export default function BillingTabs({ active }: { active: string }) {
  return (
    <nav className="flex gap-1 border-b border-[#E8EBF0] print:hidden">
      {TABS.map((tab) => {
        const on = tab.href === active;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={
              '-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold ' +
              (on
                ? 'border-[#1279E8] text-[#1279E8]'
                : 'border-transparent text-[#98A2B3] hover:text-[#4A5567]')
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
