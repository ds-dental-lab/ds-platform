// =========================================================
// 놓을 위치: src/components/order/OrderSection.tsx
//
// 주문등록의 카드 한 장. (시안 .sec / .sec-head / .sec-body)
//   아이콘 + 제목이 위에 오고 아래에 내용이 들어갑니다.
//   제목줄 오른쪽에 버튼을 놓을 수 있습니다 (치식선택의 폰틱·초기화).
// =========================================================

export interface OrderSectionProps {
  icon: React.ReactNode;
  title: string;
  /** 제목줄 오른쪽에 붙일 것 */
  action?: React.ReactNode;
  /** 카드 안쪽 여백을 직접 다루고 싶을 때 */
  bare?: boolean;
  children: React.ReactNode;
}

export default function OrderSection({
  icon,
  title,
  action,
  bare = false,
  children,
}: OrderSectionProps) {
  return (
    <section className="rounded-lg border border-[#E8EBF0] bg-white">
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <div className="flex items-center gap-[7px]">
          <span className="text-[#1279E8]" aria-hidden="true">
            {icon}
          </span>
          <h3 className="text-[14px] font-bold tracking-tight text-[#1A2130]">{title}</h3>
        </div>

        {action}
      </div>

      <div className={bare ? '' : 'px-5 pb-5 pt-2'}>{children}</div>
    </section>
  );
}

// ---------- 시안에서 쓰는 아이콘들 ----------

const svg = (children: React.ReactNode) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const SECTION_ICON = {
  patient: svg(
    <>
      <circle cx="10" cy="6.6" r="3" />
      <path d="M4.2 16.4c.7-2.7 2.9-4.1 5.8-4.1s5.1 1.4 5.8 4.1" />
    </>,
  ),
  prosthesis: svg(
    <>
      <rect x="2.6" y="5.4" width="14.8" height="11" rx="1.8" />
      <path d="M7.2 5.4V4a1.2 1.2 0 0 1 1.2-1.2h3.2A1.2 1.2 0 0 1 12.8 4v1.4" />
      <path d="M10 9v4M8 11h4" />
    </>,
  ),
  teeth: svg(
    <>
      <path d="M2.4 3.4h2.2l2 8.6h8.4l1.6-6H5.6" />
      <circle cx="8.4" cy="15.6" r="1.2" />
      <circle cx="14.4" cy="15.6" r="1.2" />
    </>,
  ),
  option: svg(
    <>
      <circle cx="10" cy="10" r="2.7" />
      <path d="M10 1.8v2.4M10 15.8v2.4M18.2 10h-2.4M4.2 10H1.8M15.8 4.2l-1.7 1.7M5.9 14.1l-1.7 1.7M15.8 15.8l-1.7-1.7M5.9 5.9 4.2 4.2" />
    </>,
  ),
  notes: svg(
    <>
      <path d="M4.4 2.6h7.2L16 7v10.4H4.4z" />
      <path d="M11.4 2.6V7H16" />
      <path d="M7 11h6M7 13.8h4" />
    </>,
  ),
  file: svg(
    <>
      <path d="M2.4 15.6V5.2a1.2 1.2 0 0 1 1.2-1.2h3.6l1.6 2h7.6a1.2 1.2 0 0 1 1.2 1.2v8.4a1.2 1.2 0 0 1-1.2 1.2H3.6a1.2 1.2 0 0 1-1.2-1.2Z" />
      <path d="M10 13.4V8.8M8 10.6l2-2 2 2" />
    </>,
  ),
};
