// =========================================================
// 놓을 위치: src/lib/stl-preview-upload.ts
//
// 올린 디자인 STL 마다 여섯 방향 미리보기를 만들어 저장소에 붙입니다 (2026-09-28).
//
// ★ 올리기가 끝난 **뒤에** 합니다. 그림 만들기가 실패해도 파일은 이미 올라가 있어야 합니다 —
//   미리보기는 거들 뿐이고, 없으면 그냥 안 보일 뿐입니다.
// ★ 경로는 원본 옆(같은 주문 폴더)에 `<원본경로>.preview.png`. 저장소 문지기가
//   폴더의 두 번째 칸(주문 id)으로 권한을 보므로 규칙이 그대로 걸립니다.
// =========================================================

'use client';

import { createClient } from '@/lib/supabase/client';
import { isStl, stlPreviewBlob } from '@/lib/stl-preview';
import { saveStlPreview } from '@/server/actions/stl-preview';

const BUCKET = 'order-files';

export interface PreviewTarget {
  /** order_files 줄 id */
  id: string;
  /** 원본 저장소 경로 */
  path: string;
  name: string;
}

/** 파일 하나. 실패하면 false 만 돌려줍니다 — 부르는 쪽 일을 멈추지 않습니다 */
export async function attachPreview(target: PreviewTarget, buffer: ArrayBuffer): Promise<boolean> {
  try {
    const blob = await stlPreviewBlob(buffer);
    if (!blob) return false;

    const supabase = createClient();
    const path = `${target.path}.preview.png`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/png',
      upsert: true,
    });
    if (error) return false;

    // ★ 표에 적는 것은 서버가 합니다 — 지난 주문(제작·배송)에는 update 정책이 닫혀 있습니다
    const saved = await saveStlPreview(target.id, path);
    return saved.ok;
  } catch {
    return false;
  }
}

/**
 * 방금 올린 것들 중 STL 만 골라 미리보기를 붙입니다.
 * onStep 으로 '3개 중 2개' 를 알려 줍니다.
 */
export async function attachPreviews(
  targets: PreviewTarget[],
  read: (target: PreviewTarget) => Promise<ArrayBuffer | null>,
  onStep?: (done: number, total: number) => void,
): Promise<number> {
  const stls = targets.filter((t) => isStl(t.name));
  let done = 0;

  for (const target of stls) {
    const buffer = await read(target);
    if (buffer && (await attachPreview(target, buffer))) done += 1;
    onStep?.(done, stls.length);
  }

  return done;
}
