// =========================================================
// 놓을 위치: src/components/layout/NavLink.tsx
//
// 화면을 옮기는 링크 — 누르면 **그 자리에서 바로** 눌렸다는 표시가 나고,
// 마우스를 올리면 다음 화면을 미리 받아 둡니다.
//
// ★ 왜 (사용자 2026-10-20 — "버튼 반응속도가 전반적으로 좀 느려보여").
//   필터·정렬 링크는 같은 화면을 새 조건으로 다시 받는 것이라, 서버가
//   답할 때까지(운영 실측 0.3~0.5초) 화면에 아무 변화가 없었습니다.
//   실제 시간보다 "안 눌린 것 같은" 느낌이 문제였습니다.
//   · 누른 링크는 그 순간 옅어지며 깜빡입니다 (useLinkStatus).
//   · 마우스를 올린 링크는 내용까지 미리 받습니다 — 올렸다 누르기까지의
//     틈에 답이 와서, 누르면 바로 바뀝니다 (OrderTableRow 와 같은 방식).
// ★ Next 16 의 router.prefetch 는 기본이 'auto'(뼈대만)라 kind 'full' 을 줍니다.
// =========================================================

'use client';

import Link, { useLinkStatus } from 'next/link';
import { useRouter } from 'next/navigation';
import type { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';

export interface NavLinkProps {
  href: string;
  className?: string;
  title?: string;
  /** 토글형 링크(필터)의 켜짐 상태 */
  pressed?: boolean;
  children: React.ReactNode;
}

export default function NavLink({ href, className, title, pressed, children }: NavLinkProps) {
  const router = useRouter();
  const warm = () => router.prefetch(href, { kind: 'full' as PrefetchKind });

  return (
    <Link
      href={href}
      title={title}
      aria-pressed={pressed}
      className={'relative ' + (className ?? '')}
      onMouseEnter={warm}
      onFocus={warm}
    >
      {children}
      <Pending />
    </Link>
  );
}

/** 누른 뒤 새 화면이 올 때까지 링크 위를 옅게 덮습니다 */
function Pending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 animate-pulse rounded-[inherit] bg-white/60"
    />
  );
}
