// =========================================================
// 놓을 위치: src/server/actions/implant.ts
//
// 임플란트 마스터 편집 창구. 검증은 서비스 계층에서 합니다.
// =========================================================

'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { IMPLANT_CATALOG_TAG } from '@/server/repositories/implant';
import {
  addImplantNode,
  renameImplantNode,
  deactivateImplantNode,
  addImplantFavorite,
  removeImplantFavorite,
  type FavoriteSelection,
  type ImplantNode,
  type ImplantResult,
} from '@/server/services/implant';

/** 마스터가 바뀌면 주문 화면의 선택지도 달라집니다 */
function revalidateImplantConsumers(): void {
  /*
    ★ 목록을 캐시해 두었으므로 여기서 비웁니다.
      이 한 줄이 빠지면 "고쳤는데 화면이 안 바뀌네" 가 됩니다.

    ★ revalidateTag 가 아니라 updateTag 입니다 (Next 16).
      revalidateTag 는 '언젠가 새로 읽어라' 라서 방금 고친 사람이
      옛 목록을 그대로 봅니다. updateTag 는 **그 자리에서** 바꿉니다.
  */
  updateTag(IMPLANT_CATALOG_TAG);
  revalidatePath('/design/implants');
  revalidatePath('/clinic/orders/new');
  revalidatePath('/playground/implant');
}

export async function submitAddImplantNode(
  node: ImplantNode,
  name: string,
  parentCode?: string,
): Promise<ImplantResult> {
  const result = await addImplantNode(node, name, parentCode);
  if (result.ok) revalidateImplantConsumers();
  return result;
}

export async function submitRenameImplantNode(
  node: ImplantNode,
  code: string,
  name: string,
): Promise<ImplantResult> {
  const result = await renameImplantNode(node, code, name);
  if (result.ok) revalidateImplantConsumers();
  return result;
}

export async function submitDeactivateImplantNode(
  node: ImplantNode,
  code: string,
): Promise<ImplantResult> {
  const result = await deactivateImplantNode(node, code);
  if (result.ok) revalidateImplantConsumers();
  return result;
}

// ---------- 즐겨찾기 ----------

/** 즐겨찾기가 바뀌면 주문등록 화면의 빠른 선택도 달라집니다 */
function revalidateFavoriteConsumers(): void {
  revalidatePath('/clinic/orders/new');
  revalidatePath('/design/implants/distribution');
}

export async function submitAddImplantFavorite(
  selection: FavoriteSelection,
  clinicOrgId?: string,
): Promise<ImplantResult> {
  const result = await addImplantFavorite(selection, clinicOrgId);
  if (result.ok) revalidateFavoriteConsumers();
  return result;
}

export async function submitRemoveImplantFavorite(
  favoriteId: string,
): Promise<ImplantResult> {
  const result = await removeImplantFavorite(favoriteId);
  if (result.ok) revalidateFavoriteConsumers();
  return result;
}
