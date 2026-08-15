// =========================================================
// 놓을 위치: src/components/layout/SectorShell.tsx
//
// 세 섹터가 공유하는 껍데기. (시안 .topbar / .sidebar / .main)
//
// 치수는 시안 CSS 를 그대로 옮겼습니다.
//   상단바 48px · 사이드바 200px (접으면 56px)
//   메뉴 항목 padding 11px 12px, 아이콘과 글자 간격 13px
//   켜진 항목은 --brand-soft 배경에 --brand 글자
//
// ★ 섹터 색은 CSS 변수로만 갈아끼웁니다.
//   같은 마크업이 치과·디자인센터·기공소에서 색만 달리 보입니다.
// =========================================================

'use client';

import { useState } from 'react';
import { visibleNav, type NavIcon } from '@/server/domain/nav';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { clearedKeepCookies } from '@/server/domain/login';
import DenFlowMark from '@/components/brand/DenFlowMark';

export type Sector = 'clinic' | 'design_center' | 'lab';

const THEME: Record<Sector, { brand: string; soft: string; label: string }> = {
  clinic: { brand: '#1B63E8', soft: '#EDF3FE', label: '치과' },
  design_center: { brand: '#5546C8', soft: '#EFEDFB', label: '디자인센터' },
  lab: { brand: '#12855B', soft: '#E6F4EE', label: '기공소' },
};

// ---------- 메뉴 아이콘 (시안 nav) ----------

const icon = (children: React.ReactNode) => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const NAV_ICON = {
  home: icon(<path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1V8.5Z" />),
  new: icon(
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 6.6v6.8M6.6 10h6.8" />
    </>,
  ),
  list: icon(
    <>
      <path d="M7 5h10M7 10h10M7 15h10" />
      <circle cx="3.6" cy="5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="3.6" cy="10" r=".9" fill="currentColor" stroke="none" />
      <circle cx="3.6" cy="15" r=".9" fill="currentColor" stroke="none" />
    </>,
  ),
  delivery: icon(
    <>
      <path d="M1.8 5.5h9.4v8.2H1.8zM11.2 8.4h3.3L18.2 11v2.7h-7z" />
      <circle cx="5.6" cy="15.4" r="1.6" />
      <circle cx="14.3" cy="15.4" r="1.6" />
    </>,
  ),
  billing: icon(
    <>
      <rect x="2.2" y="4.6" width="15.6" height="10.8" rx="1.6" />
      <path d="M2.2 8.4h15.6" />
    </>,
  ),
  users: icon(
    <>
      <circle cx="7.6" cy="7" r="2.8" />
      <path d="M2.4 16c.6-2.5 2.7-3.8 5.2-3.8s4.6 1.3 5.2 3.8" />
      <path d="M13.4 4.5a2.8 2.8 0 0 1 0 5.3M15 12.6c1.6.5 2.5 1.7 2.9 3.4" />
    </>,
  ),
  board: icon(
    <>
      <path d="M10 2.5v1.4M4.6 4.6l1 1M15.4 4.6l-1 1M2.6 10H4M16 10h1.4" />
      <path d="M7.4 15.2h5.2M8.2 17.4h3.6" />
      <path d="M13.4 10.6a3.4 3.4 0 1 0-6.8 0c0 1.6 1.2 2.4 1.2 4h4.4c0-1.6 1.2-2.4 1.2-4Z" />
    </>,
  ),
  product: icon(
    <>
      <path d="M2.6 9.4V3.6a1 1 0 0 1 1-1h5.8l7.4 7.4a1.4 1.4 0 0 1 0 2l-4.8 4.8a1.4 1.4 0 0 1-2 0L2.6 9.4Z" />
      <circle cx="6.3" cy="6.3" r="1.1" />
    </>,
  ),
  holiday: icon(
    <>
      <rect x="2.6" y="4.2" width="14.8" height="13.2" rx="1.6" />
      <path d="M2.6 8.2h14.8M6.6 2.6v3.2M13.4 2.6v3.2" />
    </>,
  ),
  implant: icon(
    <>
      <rect x="2.6" y="5.4" width="14.8" height="11" rx="1.8" />
      <path d="M7.2 5.4V4a1.2 1.2 0 0 1 1.2-1.2h3.2A1.2 1.2 0 0 1 12.8 4v1.4" />
      <path d="M10 9v4M8 11h4" />
    </>,
  ),
  // 가입승인 — 사람 옆에 체크
  approve: icon(
    <>
      <path d="M8.2 9.4a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M2.6 17.4c0-3 2.5-4.8 5.6-4.8 1 0 2 .2 2.8.6" />
      <path d="M12.4 14.6 14.4 16.6 18 12.8" />
    </>,
  ),
};

export interface SectorShellProps {
  sector: Sector;
  orgName: string;
  userName: string;
  /** 관리자인가. 메뉴가 갈립니다 */
  isManager?: boolean;
  /**
   * 메뉴 옆에 붙일 숫자. 주소 → 건수.
   *
   * ★ 기다리는 일이 있는데 아무 표시가 없으면 아무도 안 들어갑니다.
   *   가입 승인이 그렇습니다 — 그동안 그 치과는 아무것도 못 합니다.
   *   0 이면 안 붙입니다. 0 을 띄우면 볼 것이 없는데도 눈이 갑니다.
   */
  navCounts?: Record<string, number>;
  bell?: React.ReactNode;
  children: React.ReactNode;
}

export default function SectorShell({
  sector,
  orgName,
  userName,
  navCounts,
  bell,
  children,
  isManager = true,
}: SectorShellProps) {
  const pathname = usePathname();

  /*
    ★ 사용자에게 감춘 메뉴는 아예 안 보입니다.
      흐리게 두면 "왜 안 눌리냐" 를 묻습니다. 없는 것이 낫습니다.
      숨기는 것만으로는 부족해서 그 화면마다 requireManagerSector 가
      또 봅니다 — 주소를 바로 치면 열리니까요.
  */
  /*
    ★ 무엇이 보이는지는 domain/nav 가 정합니다.
      전에는 이 표가 여기 있었는데, 그러면 "치과 사용자에게 정산이
      보이는가" 를 테스트가 못 봅니다 — 실제로 한 번 어긋났습니다.
      여기서는 그림만 붙입니다.
  */
  const items = visibleNav(sector, isManager);
  const router = useRouter();
  const theme = THEME[sector];

  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = collapsed ? 56 : 200;

  /** 이 섹터의 뿌리 주소 — /clinic · /design · /lab */
  const root = `/${sector === 'design_center' ? 'design' : sector}`;

  /**
   * 지금 켜져 있어야 할 메뉴 하나.
   *
   * ★ HOME 은 정확히 같을 때만입니다 — 그것을 뺀 모든 주소가 HOME 으로 시작합니다.
   *   나머지는 '앞이 같은 것 중 가장 긴 것' 이 이깁니다.
   */

  const activeHref = items
    .map((item) => item.href)
    .filter((href): href is string => Boolean(href))
    .filter((href) => (href === root ? pathname === href : pathname.startsWith(href)))
    .sort((a, b) => b.length - a.length)[0];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();

    // ★ '로그인 상태 유지' 표시도 같이 걷습니다. 남겨 두면 다음 사람이
    //   앞사람의 선택을 물려받습니다
    clearedKeepCookies(window.location.protocol === 'https:').forEach((c) => {
      document.cookie = c;
    });

    router.push('/login');
    router.refresh();
  }

  return (
    <div
      data-sector={sector}
      style={
        {
          '--brand': theme.brand,
          '--brand-soft': theme.soft,
        } as React.CSSProperties
      }
      className="min-h-screen bg-[#F4F6F9]"
    >
      {/* ---------- 상단바 ---------- */}
      {/* ★ data-screen-only — 인쇄할 때 사라집니다 (globals.css).
             없으면 종이 첫 장에 상단바가 그대로 찍힙니다 */}
      <header
        data-screen-only
        className="fixed inset-x-0 top-0 z-30 flex h-12 items-center border-b border-[#E8EBF0] bg-white"
      >
        <div
          className="flex shrink-0 items-center gap-1.5 pl-2 transition-[width] duration-200"
          style={{ width: sidebarWidth }}
        >
          <IconButton label="메뉴 접기" onClick={() => setCollapsed(!collapsed)}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={collapsed ? 'rotate-180' : ''}
            >
              <path d="M12 4 6 10l6 6" />
            </svg>
          </IconButton>

          {!collapsed && (
            <>
              {/*
                ★ 접으면 마크도 같이 사라집니다.
                  접힌 사이드바는 56px 이고 그 안에 메뉴 버튼(30px)만 겨우
                  들어갑니다. 마크를 남기면 버튼을 밀어냅니다.
              */}
              <DenFlowMark height={19} className="ml-0.5 mr-1.5" />

              <span className="flex items-baseline whitespace-nowrap text-[17px] font-extrabold leading-none tracking-[-0.045em]">
                <b className="text-[#1B2A4A]">Den</b>
                <i className="font-semibold not-italic tracking-[.01em] text-[#9AA3AE]">Flow</i>
              </span>
            </>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-1 pr-2.5">
          {bell}

          {/* 계정 정보 — 사업자 정보를 넣는 곳입니다. 청구서에 실립니다 */}
          <Link
            href={`${root}/account`}
            aria-label="계정 정보"
            title="계정 정보"
            className={
              'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md hover:bg-[#F4F6F9] ' +
              (pathname === `${root}/account`
                ? 'text-[color:var(--brand)]'
                : 'text-[#98A2B3] hover:text-[#4A5567]')
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <circle cx="10" cy="7" r="3.1" />
              <path d="M4 16.5c.7-2.8 3-4.2 6-4.2s5.3 1.4 6 4.2" />
            </svg>
          </Link>

          <div className="flex items-center gap-3 px-1.5 text-[14px] font-semibold text-[#4A5567]">
            <span>{orgName}</span>
            <span className="text-[#DDE2EA]">|</span>
            <span>{userName}</span>
          </div>

          <span
            className="rounded px-2 py-0.5 text-[11px] font-bold"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            {theme.label}
          </span>

          <button
            onClick={handleLogout}
            className="ml-1 rounded border border-[#DDE2EA] px-3 py-1 text-[13px] text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* ---------- 사이드바 ---------- */}
      <nav
        data-screen-only
        className="fixed bottom-0 left-0 top-12 z-20 overflow-y-auto border-r border-[#E8EBF0] bg-white p-2 transition-[width] duration-200"
        style={{ width: sidebarWidth }}
      >
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            // ★ 가장 긴 주소 하나만 켭니다.
            //   /design/orders/new 은 '주문목록'(/design/orders)에도 걸려
            //   둘이 함께 켜져 있었습니다. 더 깊은 쪽이 이깁니다.
            const active = item.href === activeHref;

            const count = (item.href && navCounts?.[item.href]) || 0;

            const inner = (
              <>
                {NAV_ICON[item.icon as NavIcon]}
                {!collapsed && <span>{item.label}</span>}

                {count > 0 && (
                  /* ★ 접었을 때도 보여야 합니다 — 접어 뒀다고 안 급해지지 않습니다 */
                  <span
                    title={`${count}건 기다리는 중`}
                    className={
                      'grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#D8453F] px-1 ' +
                      'text-[10.5px] font-extrabold leading-none text-white ' +
                      (collapsed ? 'absolute right-1 top-1' : 'ml-auto')
                    }
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </>
            );

            const base =
              'relative flex items-center gap-[13px] rounded-md text-[14px] font-semibold whitespace-nowrap transition-colors ' +
              (collapsed ? 'justify-center py-[11px]' : 'px-3 py-[11px]');

            if (!item.href) {
              return (
                <div
                  key={item.label}
                  title={collapsed ? item.label : `${item.soon} 에서 만듭니다`}
                  className={`${base} cursor-not-allowed text-[#C4CBD6]`}
                >
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={base + (active ? '' : ' text-[#4A5567] hover:bg-[#F4F6F9]')}
                style={
                  active
                    ? { background: 'var(--brand-soft)', color: 'var(--brand)' }
                    : undefined
                }
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ---------- 본문 ---------- */}
      {/* ★ data-print-area — 인쇄할 때 껍데기가 비워 뒀던 자리를 되돌립니다.
             안 그러면 종이 왼쪽에 사이드바 폭만큼 빈 띠가 남습니다 */}
      <main
        data-print-area
        className="pt-12 transition-[margin] duration-200"
        style={{ marginLeft: sidebarWidth }}
      >
        <div data-print-area className="p-3.5">
          {children}
        </div>
      </main>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md text-[#98A2B3] hover:bg-[#F4F6F9] hover:text-[#4A5567]"
    >
      {children}
    </button>
  );
}
