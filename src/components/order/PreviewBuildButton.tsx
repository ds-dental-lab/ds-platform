'use client';

// =========================================================
// 놓을 위치: src/components/order/PreviewBuildButton.tsx
//
// 이미 올라간 디자인 STL 에 여섯 방향 미리보기를 만들어 붙입니다 (2026-09-28).
//
// ★ 새로 올리는 것은 올리는 그 자리에서 자동으로 만듭니다(DesignFileUpload).
//   이 단추는 **그 전에 올라간 파일들**을 위한 것이라, 만들 것이 없으면 사라집니다.
// ★ 원본을 브라우저가 한 번 내려받아 그립니다 — 몇 MB 라 몇 초면 끝납니다.
// =========================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { prepareStlPreview } from '@/server/actions/stl-preview';
import { attachPreview } from '@/lib/stl-preview-upload';
import { isStl } from '@/lib/stl-preview';

export interface PreviewBuildButtonProps {
  files: { id: string; file_name: string; preview_url?: string | null; upload_status?: string }[];
}

export default function PreviewBuildButton({ files }: PreviewBuildButtonProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');

  const todo = files.filter(
    (f) => isStl(f.file_name) && !f.preview_url && f.upload_status !== 'pending' && f.upload_status !== 'failed',
  );

  if (todo.length === 0) return null;

  async function build() {
    setError('');
    setBusy(true);
    setDone(0);
    let made = 0;

    for (const file of todo) {
      const ready = await prepareStlPreview(file.id);
      if (!ready.ok) {
        setError(ready.error);
        continue;
      }
      try {
        const buffer = await (await fetch(ready.url)).arrayBuffer();
        if (await attachPreview({ id: file.id, path: ready.previewPath.replace(/\.preview\.png$/, ''), name: file.file_name }, buffer)) {
          made += 1;
          setDone(made);
        }
      } catch {
        setError('원본을 읽지 못했습니다');
      }
    }

    setBusy(false);
    if (made > 0) startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={build}
      disabled={busy || refreshing}
      title={`${todo.length}개의 디자인 STL 에 여섯 방향 미리보기를 만듭니다`}
      className="rounded-md px-2 py-0.5 text-[11.5px] font-bold text-[#5546C8] hover:bg-[#EFEDFB] disabled:text-[#C4CBD6]"
    >
      {busy ? `미리보기 ${done}/${todo.length}` : error ? '다시 시도' : '미리보기 만들기'}
    </button>
  );
}
