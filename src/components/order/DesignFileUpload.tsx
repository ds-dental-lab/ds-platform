// =========================================================
// 놓을 위치: src/components/order/DesignFileUpload.tsx
//
// 디자인센터가 디자인 파일을 올립니다. (설계서 §8.3 권한 매트릭스)
//
// 파일은 서버를 거치지 않고 브라우저에서 Storage 로 바로 갑니다.
// STL 은 10~50MB 라 서버가 중계하면 낭비입니다. (설계서 §5.3 결정 3)
//
// ★ 아이콘 하나로 바꿨습니다 (사용자 요청 2026-08-12).
//   전에는 카드 안에 파일 고르기 칸과 목록과 올리기 버튼이 늘어서서
//   디자인 파일 칸의 절반을 먹었습니다. 파일이 없을 때가 대부분인데
//   빈 칸을 도구가 채우고 있었습니다.
//   이제 카드 머리줄의 ⬆ 를 누르면 파일 창이 뜨고, 고르는 즉시 올라갑니다.
//
// ★ 고르면 바로 올립니다. '올리기' 를 한 번 더 누르지 않습니다.
//   진행 상황은 오른쪽 위 알림이 맡습니다.
// =========================================================

'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadOrderFiles } from '@/lib/upload';
import UploadToast, { type UploadState } from '@/components/order/UploadToast';
import { checkUploadBatch } from '@/server/domain/upload';

// ★ 상한은 domain/upload 한 곳에 있습니다 (ScanDropZone 과 같은 값).

export default function DesignFileUpload({ orderId }: { orderId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [refreshing, startTransition] = useTransition();

  const [upload, setUpload] = useState<UploadState | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const busy = uploading || refreshing;

  async function handlePick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError('');

    const picked = Array.from(list);

    // 입력칸을 비웁니다 — 같은 파일을 다시 골라도 change 가 뜨도록
    if (inputRef.current) inputRef.current.value = '';

    // 크기·총량은 한 곳에서 봅니다 (domain/upload 의 checkUploadBatch)
    const problem = checkUploadBatch(picked);

    if (problem) {
      setError(problem);
      return;
    }

    if (picked.length === 0) return;

    setUploading(true);

    const result = await uploadOrderFiles(
      orderId,
      picked,
      (progress) => setUpload({ phase: 'uploading', progress }),
      'design',
    );

    setUploading(false);
    setUpload(
      result.ok
        ? { phase: 'done', total: picked.length }
        : { phase: 'failed', total: picked.length, failed: result.failed, failures: result.failures },
    );

    if (!result.ok) {
      setError(`파일 ${result.failed.length}개를 올리지 못했습니다. 다시 시도해 주세요.`);
    }

    startTransition(() => router.refresh());
  }

  return (
    <>
      <UploadToast state={upload} onClose={() => setUpload(null)} />

      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={busy}
        onChange={(e) => handlePick(e.target.files)}
        className="hidden"
      />

      {error && (
        <span className="text-[11px] font-semibold text-[#D8453F]" role="alert">
          {error}
        </span>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="디자인 파일 올리기"
        aria-label="디자인 파일 올리기"
        className="grid h-7 w-7 place-items-center rounded-md text-[#5546C8] hover:bg-[#EFEDFB] disabled:cursor-not-allowed disabled:text-[#C4CBD6]"
      >
        {busy ? <Spinner /> : <UploadIcon />}
      </button>
    </>
  );
}

function UploadIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13.5V3.5M6.5 7 10 3.5 13.5 7" />
      <path d="M3.5 12.5v2.8a1.2 1.2 0 0 0 1.2 1.2h10.6a1.2 1.2 0 0 0 1.2-1.2v-2.8" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="animate-spin" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" stroke="#DDD8F5" strokeWidth={2} />
      <path d="M14.4 8A6.4 6.4 0 0 0 8 1.6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
