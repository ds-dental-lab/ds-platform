// =========================================================
// 놓을 위치: src/server/actions/implant.ts
//
// 임플란트 마스터 편집 창구. 검증은 서비스 계층에서 합니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
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
