// =========================================================
// 놓을 위치: src/app/(mobile)/m/unsorted/[sessionId]/page.tsx
//
// S5 — 미분류 묶음을 의뢰서에 붙이는 화면. (명세서 SPEC_shade-photo)
// =========================================================

import { notFound } from 'next/navigation';
import { listShadeCases } from '@/server/repositories/shade-photo';
import { listUnsortedBoxes } from '@/server/repositories/unsorted-photo';
import ShadeMatch from '@/components/shade/ShadeMatch';

export const dynamic = 'force-dynamic';

export default async function UnsortedMatchPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const [boxes, cases] = await Promise.all([listUnsortedBoxes(), listShadeCases()]);
  const box = boxes.find((b) => b.sessionId === sessionId);

  // 이미 다 붙였거나 남의 묶음이면 없는 화면입니다
  if (!box) notFound();

  return (
    <ShadeMatch
      sessionId={sessionId}
      count={box.count}
      cases={cases}
      skipHref="/m/unsorted"
      skipLabel="나중에 분류 (미분류함으로)"
    />
  );
}
