// =========================================================
// 놓을 위치: src/server/repositories/storage-usage.ts
//
// 저장소가 얼마나 찼나. (사용자 요청 2026-08-25)
//
// ★★ **지운 표시가 된 것도 셉니다.** `deleted_at` 은 화면에서 가릴
//   뿐이고 저장소의 덩어리는 그대로 있습니다. 안 세면 실제보다
//   적게 나오고, 그러면 이 눈금이 있으나 마나입니다.
//
// ★ 미분류 사진도 더합니다. 같은 버킷에 들어갑니다.
//
// ★★ 우리 표를 더한 값이라 **실제 버킷보다 조금 적습니다.** 표는
//   지워졌는데 저장소에 남은 고아 덩어리는 못 셉니다. 그래서 이
//   숫자는 '적어도 이만큼' 입니다 — 실제는 이보다 크지 결코 작지
//   않습니다. 경고용으로는 그 방향이 맞습니다.
//
// ★ 관리 키를 씁니다. 조직마다 자기 것만 보이면 전체 합이 안 나오고,
//   요금제는 조직별이 아니라 **프로젝트 전체**에 걸립니다.
// =========================================================

import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/** 못 세면 null — 그때는 아무것도 안 띄웁니다 */
export async function getStorageUsed(): Promise<number | null> {
  const admin = createAdminClient();

  const [files, unsorted] = await Promise.all([
    admin.from('order_files').select('file_size'),
    admin.from('unsorted_photos').select('file_size'),
  ]);

  if (files.error && unsorted.error) return null;

  const sum = (rows: { file_size: number | null }[] | null) =>
    (rows ?? []).reduce((total, r) => total + (r.file_size ?? 0), 0);

  return sum(files.data) + sum(unsorted.data);
}
