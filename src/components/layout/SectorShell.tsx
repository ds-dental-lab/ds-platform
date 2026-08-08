'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export type Sector = 'clinic' | 'design_center' | 'lab';

const THEME: Record<Sector, { brand: string; soft: string; label: string }> = {
  clinic:        { brand: '#1279E8', soft: '#E7F1FD', label: '치과' },
  design_center: { brand: '#5546C8', soft: '#EFEDFB', label: '디자인센터' },
  lab:           { brand: '#12855B', soft: '#E6F4EE', label: '기공소' },
};

interface NavItem {
  label: string;
  href?: string;
  sprint?: string;
}

const NAV: Record<Sector, NavItem[]> = {
  clinic: [
    { label: 'HOME', href: '/clinic' },
    { label: '주문등록', href: '/clinic/orders/new' },
    { label: '주문목록', sprint: 'Sprint 4' },
    { label: '배송조회', sprint: 'Sprint 7' },
    { label: '청구내역', sprint: 'Sprint 8' },
    { label: '구성원', sprint: 'Sprint 9' },
    { label: '설정', sprint: 'Sprint 9' },
  ],
  design_center: [
    { label: 'HOME', href: '/design' },
    { label: '주문관리', sprint: 'Sprint 5' },
    { label: '임플란트', sprint: 'Sprint 6' },
    { label: '배송관리', sprint: 'Sprint 7' },
    { label: '정산', sprint: 'Sprint 8' },
    { label: '구성원', sprint: 'Sprint 9' },
    { label: '설정', sprint: 'Sprint 9' },
  ],
  lab: [
    { label: 'HOME', href: '/lab' },
    { label: '작업목록', sprint: 'Sprint 7' },
    { label: '출고', sprint: 'Sprint 7' },
    { label: '설정', sprint: 'Sprint 9' },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  owner: '대표',
  admin: '관리자',
  staff: '직원',
  designer: '디자이너',
  technician: '기공사',
};

export interface SectorShellProps {
  sector: Sector;
  orgName: string;
  email: string;
  role: string | null;
  children: React.ReactNode;
}

export default function SectorShell({
  sector,
  orgName,
  email,
  role,
  children,
}: SectorShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = THEME[sector];
  const items = NAV[sector];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
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
      <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-3 border-b border-[#E8EBF0] bg-white px-4">
        <div className="flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center rounded text-[11px] font-extrabold text-white"
            style={{ background: 'var(--brand)' }}
          >
            DS
          </span>
          <span className="text-[15px] font-extrabold tracking-tight text-[#1B2A4A]">
            DS <span className="font-semibold text-[#9AA3AE]">FLOW</span>
          </span>
        </div>

        <span
          className="rounded px-2 py-0.5 text-[11px] font-bold"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          {theme.label}
        </span>

        <div className="ml-auto flex items-center gap-2 text-[13px] text-[#4A5567]">
          <span className="font-semibold text-[#1A2130]">{orgName}</span>
          <span className="text-[#DDE2EA]">|</span>
          <span className="hidden sm:inline">{email}</span>
          {role && (
            <span className="rounded bg-[#F4F6F9] px-2 py-0.5 text-[11px] font-semibold">
              {ROLE_LABEL[role] ?? role}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="ml-2 rounded border border-[#DDE2EA] px-3 py-1 text-[12px] hover:bg-[#F4F6F9]"
          >
            로그아웃
          </button>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 top-12 z-20 w-[200px] overflow-y-auto border-r border-[#E8EBF0] bg-white p-2">
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.href === pathname;

            if (!item.href) {
              return (
                <div
                  key={item.label}
                  className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold text-[#C4CBD6]"
                  title={`${item.sprint} 에서 만듭니다`}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] font-medium">{item.sprint}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2.5 text-sm font-semibold transition-colors"
                style={
                  active
                    ? { background: 'var(--brand-soft)', color: 'var(--brand)' }
                    : { color: '#4A5567' }
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-6 border-t border-[#E8EBF0] pt-3">
          <p className="px-3 pb-1 text-[10px] font-bold text-[#98A2B3]">시연 (개발용)</p>
          {[
            { label: '치식도', href: '/playground/tooth-chart' },
            { label: '쉐이드', href: '/playground/shade' },
            { label: '임플란트', href: '/playground/implant' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-[13px] text-[#98A2B3] hover:bg-[#F4F6F9]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="ml-[200px] pt-12">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}


