'use client';

// =========================================================
// 놓을 위치: src/components/contact/PriceSheetTabs.tsx
//
// 수가표 한 탭 안의 두 화면 (사용자 요청 2026-09-30 — "수가표 요청과 수가표를
// 같은 탭으로 묶고 싶다, 왼쪽 메뉴 항목이 너무 많아진다").
//
//   문의   /design/contacts     홈페이지로 들어온 수가표 요청
//   종이   /design/price-sheet  상담 갈 때 뽑아 가는 A4
//
// ★ 인쇄에는 안 나옵니다 — 종이에 탭이 찍히면 안 됩니다.
// =========================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/design/contacts', label: '문의' },
  { href: '/design/price-sheet', label: '상담용 종이' },
];

export default function PriceSheetTabs() {
  const path = usePathname();

  return (
    <nav className="mb-3 flex gap-1.5 print:hidden" aria-label="수가표">
      {TABS.map((tab) => {
        const on = path === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={
              'h-9 rounded-md px-3.5 text-[13.5px] font-semibold leading-9 ' +
              (on
                ? 'bg-[#EEF1F5] text-[#1A2130]'
                : 'text-[#7C8595] hover:bg-[#F4F6F9] hover:text-[#4A5567]')
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
