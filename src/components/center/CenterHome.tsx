// =========================================================
// 놓을 위치: src/components/center/CenterHome.tsx
//
// 센터 관리자의 폰 홈. (사용자 요청 2026-09-06)
//
// ★★ 책상에 없을 때 폰으로 처리하는 세 가지 — 문의에 전화, 가입 승인,
//   치과가 전화했을 때 케이스 찾기. 카드 셋이 전부이고 위가 급한 것입니다.
//
// ★ 진료실 폰 홈(ShadeHome)과 같은 껍데기 안에 삽니다 — 같은 색·같은
//   여백. 계정이 다를 뿐 같은 앱이어야 합니다.
// =========================================================

import Link from 'next/link';
import DenFlowLogo from '@/components/brand/DenFlowLogo';
import LogoutButton from '@/components/logout-button';
import { PushBell } from '@/components/layout/PushToggle';
import { centerCards, type CenterCounts } from '@/server/domain/center-mobile';

export default function CenterHome({
  orgName,
  counts,
  manager,
  pushKey,
}: {
  orgName: string;
  counts: CenterCounts;
  manager: boolean;
  /** 웹푸시 공개키. 없으면 스위치가 안 그려집니다 */
  pushKey: string | null;
}) {
  const cards = centerCards(counts, manager);

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-6">
      {/* ★ relative — 종을 누르면 알림 카드가 이 줄 아래로 펼쳐집니다 */}
      <div className="relative flex items-center justify-between">
        <DenFlowLogo markHeight={20} fontSize={19} />
        <div className="flex items-center gap-2.5">
          <PushBell vapidKey={pushKey} description="치과의 대화와 가입·문의 신청이 이 폰으로 옵니다" />
          <LogoutButton className="whitespace-nowrap text-[12px] text-[#9FB0C0] underline underline-offset-4" />
        </div>
      </div>

      {/*
        ★ 누구 계정인지는 제목 위 한 줄로 (2026-09-07). 머리줄에 로고·이름표·
          종·로그아웃 넷을 세우면 폰 폭(390px)에 안 들어가 로그아웃이 잘렸습니다.
      */}
      <span className="mt-5 inline-block max-w-full truncate rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[12.5px] font-semibold text-[var(--muted)]">
        {orgName}
      </span>
      <h1 className="mt-2 text-[26px] font-extrabold tracking-[-0.5px] text-[var(--ink)]">
        {manager ? '처리할 일' : '주문 찾기'}
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[var(--muted)]">
        {manager ? '폰으로 바로 전화하고 승인합니다' : '치과가 전화하면 여기서 케이스를 찾습니다'}
      </p>

      <ul className="mt-6 space-y-3">
        {cards.map((card) => (
          <li key={card.key}>
            <Link
              href={card.href}
              className="flex items-center gap-3.5 rounded-2xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(22,50,79,0.06)] active:bg-[#F7FAFC]"
            >
              <span className="min-w-0 flex-1">
                <b className="block text-[17px] font-bold text-[var(--ink)]">{card.title}</b>
                <span className="mt-0.5 block text-[12.5px] text-[var(--muted)]">{card.hint}</span>
              </span>

              {/*
                ★ 숫자는 **기다리는 것**일 때만 색을 입힙니다. 0 은 회색 —
                  0 이 빨갛게 서 있으면 매번 눈이 갑니다.
              */}
              {card.count !== null && (
                <b
                  className={
                    'grid h-8 min-w-8 place-items-center rounded-full px-2 text-[14px] font-extrabold tabular-nums ' +
                    (card.count > 0 ? 'bg-[#E8912B] text-white' : 'bg-[#EEF1F5] text-[#9FB0C0]')
                  }
                >
                  {card.count}
                </b>
              )}
              <span className="text-[16px] text-[#C4CBD6]" aria-hidden="true">
                &#8250;
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* ★ 주문을 만들고 고치는 일은 PC 에서 — 되돌아갈 길을 둡니다 */}
      <p className="mt-9 text-center">
        <Link href="/design" className="text-[12.5px] text-[#9FB0C0] underline underline-offset-4">
          주문등록 · 정산은 전체 화면에서
        </Link>
      </p>
    </main>
  );
}
