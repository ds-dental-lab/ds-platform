// =========================================================
// 놓을 위치: src/app/(mobile)/m/unsorted/page.tsx
//
// S6 — 미분류함. (명세서 SPEC_shade-photo S6)
// =========================================================

import { listUnsortedBoxes } from '@/server/repositories/unsorted-photo';
import UnsortedBoxList from '@/components/shade/UnsortedBoxList';

export const dynamic = 'force-dynamic';

export default async function UnsortedBoxPage() {
  const boxes = await listUnsortedBoxes();

  return <UnsortedBoxList boxes={boxes} />;
}
