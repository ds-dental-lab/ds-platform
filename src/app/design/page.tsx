// =========================================================
// 놓을 위치: src/app/design/page.tsx
//
// HOME. 화면은 HomeScreen 하나로 세 섹터가 나눠 씁니다.
// 무엇을 세는지는 RLS 가 정합니다 — 이 조직이 볼 수 있는 주문만 돌아옵니다.
// =========================================================

import { getHomeSummary } from '@/server/repositories/home';
import { getRetentionNudge } from '@/server/repositories/retention';
import { getStorageUsed } from '@/server/repositories/storage-usage';
import { canManage } from '@/server/domain/retention';
import { getSession } from '@/server/policies/session';
import { canSeeMoney, type MemberRole } from '@/server/domain/member';
import HomeScreen from '@/components/home/HomeScreen';
import AutoRefresh from '@/components/layout/AutoRefresh';
import UnreadChatStrip from '@/components/home/UnreadChatStrip';
import ApprovalStrip from '@/components/home/ApprovalStrip';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  /*
    ★ 셋을 함께 보냅니다 — 서로를 안 쓰는데 줄줄이 기다릴 이유가 없습니다.
    ★ 파기 알림은 관리자가 아니면 null 입니다 (repositories/retention).
  */
  const [summary, session, retention] = await Promise.all([
    getHomeSummary(),
    getSession(),
    getRetentionNudge(),
  ]);

  /*
    ★★ **센터 관리자만** 봅니다 (사용자 요청 2026-08-25). 요금제를
      쥔 사람이 그 사람뿐입니다 — 치과·기공소에 띄우면 자기가 어쩔
      수 없는 일로 걱정만 합니다. 그래서 이 값은 /design 에서만
      읽습니다.
  */
  const storageUsed = canManage(session?.role ?? null) ? await getStorageUsed() : null;

  return (
    <>
      {/* ★ 접수가 들어오면 새로고침 없이 올라옵니다 (사용자 요청 2026-08-13) */}
      <AutoRefresh />
      {/*
        ★ 가입 신청·수가표 문의가 기다리면 맨 위에 띠가 섭니다 (2026-09-05).
          사장님이 "알림이 오는 게 없어" — 실제로 아무것도 없었습니다.
          관리자만 봅니다 (승인·응대는 관리자 일입니다).
      */}
      <ApprovalStrip manager={canManage(session?.role ?? null)} />
      {/* 안 읽은 대화가 있으면 맨 위에 띠가 섭니다 (2026-08-19) */}
      <UnreadChatStrip orderPath="/design/orders" />
      <HomeScreen
        sector="design_center"
        summary={summary}
        canSeeMoney={canSeeMoney(session?.role as MemberRole | null)}
        retention={retention}
        storageUsed={storageUsed}
      />
    </>
  );
}
