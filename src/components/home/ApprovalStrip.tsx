// =========================================================
// 놓을 위치: src/components/home/ApprovalStrip.tsx
//
// 센터 HOME 맨 위 — **처리해야 할 일** 띠. 가입 신청·수가표 문의.
// (사용자 지적 2026-09-05 — "실제로 해보니까 알림이 오는 게 없어")
//
// ★★ 이 둘은 늦으면 잃는 일입니다. 신청하고 하루 넘게 소식이 없으면
//   "여기 운영은 하나" 가 되고, 그건 거래 전에 잃는 것입니다.
//   종·푸시·메일이 같이 가지만, HOME 을 여는 순간 눈앞에 있는 것이
//   제일 확실합니다.
//
// ★ 안 읽은 대화 띠(UnreadChatBanner)와 같은 주황 결입니다 — '기다리는
//   일' 의 색. 빨강은 고장에만 씁니다.
//
// ★ 관리자만 봅니다. 승인·문의 응대는 관리자 일이고, 사용자에게
//   보여 봐야 그 사람은 눌러도 404 입니다.
//
// ★ 서버 컴포넌트입니다. 스스로 읽어 오므로 HOME 은 한 줄만 얹습니다.
// =========================================================

import Link from 'next/link';
import { countApprovalQueue } from '@/server/repositories/approval-alert';
import { approvalSummary, hasApprovalWork } from '@/server/domain/approval-alert';

export default async function ApprovalStrip({ manager }: { manager: boolean }) {
  if (!manager) return null;

  const counts = await countApprovalQueue();
  if (!hasApprovalWork(counts)) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-[#F3C98B] bg-[#FFF8EC] shadow-[0_1px_3px_rgba(194,114,27,0.10)]">
      <div className="h-1 bg-[#E8912B]" />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8912B] opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#E8912B]" />
          </span>
          <b className="text-[15px] font-extrabold tracking-[-0.02em] text-[#8A5A12]">
            {approvalSummary(counts)}이 기다립니다
          </b>
        </span>

        {counts.signups > 0 && (
          <Link
            href="/design/signups"
            className="rounded-full border border-[#F0D3A4] bg-white px-3.5 py-1.5 text-[14px] font-bold text-[#5A4318] transition-colors hover:border-[#E8912B] hover:bg-[#FFF3DE]"
          >
            승인하러 가기 ›
          </Link>
        )}

        {counts.contacts > 0 && (
          <Link
            href="/design/contacts"
            className="rounded-full border border-[#F0D3A4] bg-white px-3.5 py-1.5 text-[14px] font-bold text-[#5A4318] transition-colors hover:border-[#E8912B] hover:bg-[#FFF3DE]"
          >
            문의 보러 가기 ›
          </Link>
        )}
      </div>
    </div>
  );
}
