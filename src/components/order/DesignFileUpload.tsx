// =========================================================
// 놓을 위치: src/components/order/DesignFileUpload.tsx
//
// 디자인센터가 디자인 파일을 올립니다. (설계서 §8.3 권한 매트릭스)
//
// 파일은 서버를 거치지 않고 브라우저에서 Storage 로 바로 갑니다.
// STL 은 10~50MB 라 서버가 중계하면 낭비입니다. (설계서 §5.3 결정 3)
// =========================================================

'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadOrderFiles } from '@/lib/upload';

const MAX_SIZE = 100 * 1024 * 1024;

export default function DesignFileUpload({ orderId }: { orderId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [refreshing, startTransition] = useTransition();

  const [picked, setPicked] = useState<File[]>([]);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const busy = uploading || refreshing;

  function handlePick(list: FileList | null) {
    if (!list) return;
    setError('');

    const next: File[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_SIZE) {
        setError(file.name + ' 은 100MB 를 넘어 올릴 수 없습니다');
        continue;
      }
      next.push(file);
    }

    setPicked((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleUpload() {
    if (picked.length === 0) return;

    setError('');
    setUploading(true);

    const result = await uploadOrderFiles(
      orderId,
      picked,
      (done, total) => setProgress(`올리는 중 ${done} / ${total}`),
      'design',
    );

    setUploading(false);
    setProgress('');

    if (!result.ok) {
      setError(`파일 ${result.failed.length}개를 올리지 못했습니다. 다시 시도해 주세요.`);
      setPicked((prev) => prev.filter((f) => result.failed.includes(f.name)));
      return;
    }

    setPicked([]);
    startTransition(() => router.refresh());
  }

  return (
    <div className="border-t border-gray-100 px-5 py-4">
      <p className="mb-2 text-[13px] font-semibold text-gray-500">디자인 파일 올리기</p>

      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={busy}
        onChange={(e) => handlePick(e.target.files)}
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100"
      />

      {picked.length > 0 && (
        <>
          <ul className="mt-3 space-y-1">
            {picked.map((file, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded bg-gray-50 px-3 py-2 text-[13px]"
              >
                <span className="flex-1 truncate">{file.name}</span>
                <button
                  onClick={() => setPicked((prev) => prev.filter((_, n) => n !== i))}
                  disabled={busy}
                  className="text-gray-400 hover:text-red-500"
                >
                  x
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={handleUpload}
            disabled={busy}
            className="mt-3 rounded bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {busy ? '올리는 중…' : `${picked.length}개 올리기`}
          </button>
        </>
      )}

      {progress && <p className="mt-2 text-[13px] text-blue-600">{progress}</p>}
      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
