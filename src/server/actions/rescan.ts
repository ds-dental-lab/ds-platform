// =========================================================
// 놓을 위치: src/server/actions/rescan.ts
//
// 스캔 재등록 창구. 검증은 서비스 계층에서 합니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import {
  resubmitScan,
  type ResubmitScanInput,
  type ResubmitScanResult,
} from '@/server/services/rescan';

export async function submitResubmitScan(
  input: ResubmitScanInput,
): Promise<ResubmitScanResult> {
  const result = await resubmitScan(input);

  if (result.ok) {
    // 재스캔이 풀려 접수로 돌아갑니다 — 치과와 디자인센터 양쪽이 달라집니다
    revalidatePath('/clinic/orders', 'layout');
    revalidatePath('/design/orders', 'layout');
  }

  return result;
}
