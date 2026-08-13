// =========================================================
// 놓을 위치: src/components/order/OrderPager.tsx
//
// 페이지 이동. (기능명세서 §4.3 — 페이지당 10건, 시안 .pager)
//   가운데 정렬, 원형 버튼. 한 번에 10개 번호씩 보여주고 « ‹ › » 로 건너뜁니다.
// =========================================================

import Link from 'next/link';

const WINDOW = 10;

export interface OrderPagerProps {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pages: number;
  total: number;
}

export default function OrderPager({
  basePath,
  params,
  page,
  pages,
  total,
}: OrderPagerProps) {
  function href(p: number): string {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    return `${basePath}?${next.toString()}`;
  }

  const start = Math.floor((page - 1) / WINDOW) * WINDOW + 1;
  const numbers: number[] = [];
  for (let i = start; i < start + WINDOW && i <= pages; i++) numbers.push(i);

  return (
    <div className="relative flex items-center justify-center gap-1 px-3 py-[18px]">
      <Step href={href(1)} disabled={page === 1} label="«" title="첫 쪽" />
      <Step href={href(page - 1)} disabled={page === 1} label="‹" title="이전 쪽" />

      {numbers.map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={n === page ? 'page' : undefined}
          className={
            'grid h-[31px] min-w-[31px] place-items-center rounded-full px-2 text-[14px] ' +
            (n === page
              ? 'bg-[#1279E8] font-bold text-white'
              : 'font-semibold text-[#4A5567] hover:bg-[#F4F6F9]')
          }
        >
          {n}
        </Link>
      ))}

      <Step href={href(page + 1)} disabled={page === pages} label="›" title="다음 쪽" />
      <Step href={href(pages)} disabled={page === pages} label="»" title="마지막 쪽" />

      <span className="absolute right-4 text-[13px] text-[#98A2B3]">전체 {total}건</span>
    </div>
  );
}

function Step({
  href,
  disabled,
  label,
  title,
}: {
  href: string;
  disabled: boolean;
  label: string;
  title: string;
}) {
  if (disabled) {
    return (
      <span
        aria-hidden="true"
        className="grid h-[31px] min-w-[31px] place-items-center rounded-full px-2 text-[14px] text-[#CDD4DE]"
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      title={title}
      className="grid h-[31px] min-w-[31px] place-items-center rounded-full px-2 text-[14px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
    >
      {label}
    </Link>
  );
}
