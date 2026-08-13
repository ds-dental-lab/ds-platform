// =========================================================
// 놓을 위치: src/components/order/MissingFileBar.tsx
//
// 안 올라간 스캔 파일을 그 자리에서 다시 올립니다.
//
// ★ 주문을 지우고 새로 넣지 않습니다 (사용자 결정 2026-08-12).
//   전에는 (2/3) 이 뜨면 디자인센터가 치과에 전화해 새 주문을 받고
//   원래 주문을 지웠습니다. 그러면 —
//     치식·쉐이드·제작옵션을 처음부터 다시 입력하고
//     요청시한이 오늘 기준으로 다시 계산돼 하루가 밀리고
//     주문번호가 바뀌어 그 주문의 대화와 이력이 끊깁니다
//   빠진 파일 하나 때문에 치를 값이 아닙니다.
//
// ★ 이름으로 짝을 맞춥니다.
//   사람은 아까 고르려던 그 파일을 다시 고릅니다. 이름이 같으면 빈 줄을
//   채우고, 다르면 새 줄이 됩니다.
// =========================================================

'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retryOrderFiles, type MissingFile } from '@/lib/upload';
import UploadToast, { type UploadState } from '@/components/order/UploadToast';

export interface MissingFileBarProps {
  orderId: string;
  missing: MissingFile[];
  /** 올릴 수 있는 자리인가. 넘긴 뒤에는 못 올립니다 */
  editable: boolean;
}

export default function MissingFileBar({ orderId, missing, editable }: MissingFileBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [refreshing, startTransition] = useTransition();

  const [upload, setUpload] = useState<UploadState | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  if (missing.length === 0) return null;

  const busy = uploading || refreshing;

  async function handlePick(list: FileList | null) {
    if (!list || list.length === 0) return;

    const files = Array.from(list);
    if (inputRef.current) inputRef.current.value = '';

    setError('');
    setUploading(true);

    const result = await retryOrderFiles(orderId, missing, files, (progress) =>
      setUpload({ phase: 'uploading', progress }),
    );

    setUploading(false);
    setUpload(
      result.ok
        ? { phase: 'done', total: files.length }
        : { phase: 'failed', total: files.length, failed: result.failed },
    );

    if (!result.ok) {
      setError(`파일 ${result.failed.length}개를 또 올리지 못했습니다.`);
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="mb-2 rounded-md border border-[#F3C6C6] bg-[#FDECEA] px-[11px] py-[9px]">
      <UploadToast state={upload} onClose={() => setUpload(null)} />

      <p className="text-[12.5px] font-bold leading-relaxed text-[#C4383A]">
        ⚠ 파일 {missing.length}개가 올라오지 못했습니다. 올리는 중에 창을 닫았거나 연결이 끊긴
        것입니다.
      </p>

      <ul className="mt-1 space-y-0.5">
        {missing.map((file) => (
          <li key={file.id} className="truncate text-[12.5px] text-[#8C4A48]" title={file.fileName}>
            · {file.fileName}
          </li>
        ))}
      </ul>

      {editable ? (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => handlePick(e.target.files)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-2 h-8 rounded-md bg-[#D8453F] px-3.5 text-[13px] font-bold text-white hover:bg-[#C13B36] disabled:opacity-60"
          >
            {busy ? '올리는 중…' : '빠진 파일 다시 올리기'}
          </button>

          <p className="mt-1 text-[11px] text-[#A8706E]">
            같은 파일을 다시 고르면 됩니다. 주문은 그대로 있습니다.
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-[11px] text-[#A8706E]">
          치과에 이 파일을 다시 올려 달라고 알려 주세요.
        </p>
      )}

      {error && <p className="mt-1.5 text-[12.5px] font-semibold text-[#B3312C]">{error}</p>}
    </div>
  );
}
