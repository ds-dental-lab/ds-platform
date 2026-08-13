// =========================================================
// 놓을 위치: src/components/order/OrderUnavailable.tsx
//
// 주문을 못 여는 이유를 사람 말로 알려 줍니다.
// (사용자 요청 2026-08-13 — "404페이지보다는 … 알림창 띄어주는게 좋아보인다")
//
// ★ 404 는 "이 주소는 없다" 는 말입니다.
//   그런데 여기서 못 여는 이유는 대개 **주소가 틀려서가 아닙니다.**
//   지워졌거나, 내 조직 것이 아니거나입니다. 그 둘을 404 로 뭉뚱그리면
//   보는 사람은 자기가 뭘 잘못 눌렀는지 알 수가 없습니다.
//   특히 HOME 의 목록에서 눌러 들어온 경우, 목록에는 있는데 404 가
//   뜨므로 "이 프로그램이 이상하다" 로 읽힙니다.
//
// ★ 없는 주문과 못 보는 주문을 나눠 말하지 않습니다.
//   "없거나 볼 수 없습니다" 로 묶습니다. 나눠 말하면 남의 주문번호를
//   넣어 보며 **있는지 없는지를 알아낼 수 있습니다.**
//   지워진 것만 따로 말하는데, 그건 이미 볼 수 있던 사람에게만
//   그렇게 보입니다 (RLS 가 남의 것은 애초에 안 돌려줍니다).
// =========================================================

import Link from 'next/link';

export type OrderAbsence = 'deleted' | 'hidden';

const MESSAGE: Record<OrderAbsence, { title: string; body: string }> = {
  deleted: {
    title: '지워진 주문입니다',
    body:
      '이 주문은 삭제되었습니다. 목록과 카드에서 곧 사라집니다.\n' +
      '실수로 지운 것이라면 디자인센터에 알려 주세요.',
  },
  hidden: {
    title: '열 수 없는 주문입니다',
    body:
      '없는 주문이거나, 지금 로그인한 계정으로는 볼 수 없는 주문입니다.\n' +
      '다른 치과의 주문이거나, 계정을 바꿔 들어오셔야 하는 건일 수 있습니다.',
  },
};

export interface OrderUnavailableProps {
  reason: OrderAbsence;
  /** 돌아갈 목록 — '/clinic/orders' */
  ordersPath: string;
}

export default function OrderUnavailable({ reason, ordersPath }: OrderUnavailableProps) {
  const message = MESSAGE[reason];

  return (
    <div className="mx-auto max-w-[520px] py-16">
      <div className="rounded-[10px] border border-[#E8EBF0] bg-white px-7 py-8 text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#F4F6F9] text-[#98A2B3]"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.4v.2" />
          </svg>
        </span>

        <h1 className="mt-4 text-[17px] font-bold tracking-tight text-[#1A2130]">
          {message.title}
        </h1>

        <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[#4A5567]">
          {message.body}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href={ordersPath}
            className="grid h-[38px] place-items-center rounded-[7px] bg-[#1279E8] px-6 text-[14px] font-bold text-white hover:bg-[#1554C8]"
          >
            주문목록으로
          </Link>

          {/*
            ★ 계정이 달라서 막힌 경우가 흔합니다 (사용자 요청 2026-08-13).
              목록으로 보내 봐야 거기도 안 보입니다 — 나갈 길을 같이 냅니다.
          */}
          {reason === 'hidden' && (
            <Link
              href="/login"
              className="grid h-[38px] place-items-center rounded-[7px] border border-[#DDE2EA] bg-white px-5 text-[14px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
            >
              다른 계정으로 로그인
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
