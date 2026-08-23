// =========================================================
// 놓을 위치: src/app/(mobile)/m/today/page.tsx
//
// 오늘 도착할 보철물. (사용자 요청 2026-08-24)
// =========================================================

import { requireSector } from '@/server/policies/session';
import { listArrivingToday } from '@/server/repositories/arrival';
import ArrivalList from '@/components/shade/ArrivalList';

export const dynamic = 'force-dynamic';

export default async function ArrivalPage() {
  await requireSector('clinic');

  return <ArrivalList rows={await listArrivingToday()} />;
}
