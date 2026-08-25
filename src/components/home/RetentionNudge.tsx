// =========================================================
// 놓을 위치: src/components/home/RetentionNudge.tsx
//
// 파기할 때가 됐다는 알림. (사용자 요청 2026-08-25)
//
// ★★ **파기는 저절로 안 돕니다 — 사람이 눌러야 합니다.** 그렇게 정한
//   이유가 있습니다(밤사이 배치가 환자 파일을 지웠는데 뭐가 지워졌는지
//   아무도 모르는 상태가 더 나쁩니다). 그런데 그 화면은 계정정보
//   안쪽이라 **들어가 봐야만** 쌓인 줄 압니다.
//   실제로 이 시스템은 파기가 **한 번도 안 돌았습니다.**
//   버튼을 사람에게 맡겼으면, 누를 때가 됐다는 것은 우리가 알려야 합니다.
//
// ★★ **안 정한 것도 알립니다.** 기간을 안 정하면 셀 것이 없어서 배지가
//   영영 안 뜹니다 — 제일 위험한 상태가 제일 조용합니다.
//
// ★ 관리자만 봅니다. 지울 수 있는 사람에게만 알리는 것이 맞습니다
//   (부르는 쪽에서 이미 걸렀습니다).
//
// ★ 빨강이 아닙니다. 이건 사고가 아니라 **할 때가 된 일**입니다.
//   빨강을 여기 쓰면 진짜 사고가 났을 때 쓸 색이 없어집니다.
// =========================================================

import Link from 'next/link';
import type { RetentionNudge as Nudge } from '@/server/repositories/retention';

export default function RetentionNudge({ nudge, href }: { nudge: Nudge; href: string }) {
  if (!nudge.unset && nudge.due === 0) return null;

  return (
    <Link
      href={href}
      className="mb-3.5 flex items-center gap-2.5 rounded-[10px] border border-[#F0DCB4] bg-[#FFFAF0] px-4 py-3 hover:bg-[#FEF5E4]"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#B45309"
        strokeWidth={1.7}
        strokeLinecap="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M5 7h14M9 7V5.5h6V7M7 7l.8 12h8.4L17 7" />
      </svg>

      <span className="min-w-0 flex-1 text-[13px] text-[#7A5A22]">
        {nudge.unset ? (
          <>
            <b className="font-bold text-[#8A5A0B]">보관기간을 아직 안 정했습니다.</b> 정하기
            전까지는 오래된 파일과 기록이 계속 쌓입니다.
          </>
        ) : (
          <>
            <b className="font-bold text-[#8A5A0B]">파기할 것 {nudge.due}건</b>이 보관기간을
            지났습니다. 파기는 눌러야 실행됩니다.
          </>
        )}
      </span>

      <span className="shrink-0 text-[12.5px] font-semibold text-[#B45309]">
        {nudge.unset ? '정하러 가기' : '보러 가기'} &#8250;
      </span>
    </Link>
  );
}
