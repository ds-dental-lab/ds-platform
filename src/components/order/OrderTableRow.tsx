// =========================================================
// 놓을 위치: src/components/order/OrderTableRow.tsx
//
// 클릭되는 표 한 줄. (시안 `.otbl tbody tr { cursor:pointer }`)
//
// ★ 목록에서는 줄 아무 데나 눌러도 상세로 갑니다.
//   글자 몇 개만 링크로 만들어 두면 어디를 눌러야 할지 매번 찾아야 합니다.
//
// 줄 전체를 링크로 감쌀 수는 없습니다(표 구조가 깨집니다). 그래서
// 클릭은 여기서 처리하고, 키보드로도 갈 수 있게 줄 자체를 tab 대상으로 둡니다.
// =========================================================

'use client';

import { useRouter } from 'next/navigation';

export interface OrderTableRowProps {
  href: string;
  /** 스크린리더가 읽을 줄 이름 */
  label: string;
  children: React.ReactNode;
}

export default function OrderTableRow({ href, label, children }: OrderTableRowProps) {
  const router = useRouter();

  return (
    <tr
      onClick={() => router.push(href)}
      /*
        ★ 줄에 마우스를 올리면 상세를 미리 받습니다 (2026-09-06 — "주문상세
          누를 때 느리다"). 줄을 훑다가 누르기까지의 틈에 내용이 옵니다.
          목록에 열 줄이 있어도 올린 줄만 받으니 서버를 더 두드리지 않습니다.
      */
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(href);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={label}
      className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-[#FAFBFD] focus-visible:bg-[#FAFBFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      {children}
    </tr>
  );
}
