// =========================================================
// 놓을 위치: src/app/design/account/audit/page.tsx
//
// 열람 기록 (설계서 §3.5). 관리자만 봅니다 — RLS 가 잡습니다.
//
// ★ 권한이 없으면 빈 표가 나옵니다.
//   RLS 는 오류가 아니라 0행으로 막습니다. 그래서 여기서 역할을 먼저
//   보고 안내를 띄웁니다 — 안 그러면 "왜 아무것도 없지" 만 남습니다.
// =========================================================

import { requireSession } from '@/server/policies/session';
import { listAuditLogs, summarize } from '@/server/repositories/audit';
import type { AuditAction } from '@/server/audit';
import AuditLogTable from '@/components/account/AuditLogTable';

export const dynamic = 'force-dynamic';

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; action?: string }>;
}) {
  const session = await requireSession();
  const query = await searchParams;

  const isAdmin = session.role === 'owner' || session.role === 'admin';

  if (!isAdmin) {
    return (
      <p className="mx-auto max-w-[900px] rounded-lg border border-[#E8EBF0] bg-white px-6 py-16 text-center text-[13px] text-[#98A2B3]">
        열람 기록은 관리자만 볼 수 있습니다.
        <span className="mt-1 block text-[12px]">
          누가 누구를 들여다봤는지가 보이는 자료라 범위를 좁혀 두었습니다.
        </span>
      </p>
    );
  }

  const days = Number(query.days) > 0 ? Number(query.days) : 7;
  const action = (query.action ?? 'all') as AuditAction | 'all';

  const rows = await listAuditLogs({ days, action });

  return (
    <AuditLogTable rows={rows} summary={summarize(rows)} days={days} action={action} />
  );
}
