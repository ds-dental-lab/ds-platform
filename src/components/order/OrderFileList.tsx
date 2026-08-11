// =========================================================
// 놓을 위치: src/components/order/OrderFileList.tsx
//
// 주문상세의 파일 목록. 파일명을 누르면 내려받습니다.
//
// ★ 주소를 미리 만들어 두지 않습니다.
//   누른 순간 서버에 물어 1분짜리 주소를 받아 씁니다.
//   화면 소스에 파일 주소가 박혀 있으면 로그인 없이도 새어 나갑니다.
// =========================================================

'use client';

import { useState } from 'react';
import { getOrderFileUrl } from '@/server/actions/order-file';
import { FILE_KIND_LABEL, formatBytes } from '@/lib/format/order';

export interface OrderFileRow {
  id: string;
  kind: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

export default function OrderFileList({ files }: { files: OrderFileRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function download(file: OrderFileRow) {
    setError('');
    setBusyId(file.id);

    const result = await getOrderFileUrl(file.id);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // 새 탭이 아니라 내려받기로 가야 STL 이 브라우저에 통째로 열리지 않습니다
    const link = document.createElement('a');
    link.href = result.url;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <>
      <ul className="space-y-1.5">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-[12.5px]"
          >
            <span className="shrink-0 text-[#98A2B3]">{shortStamp(file.created_at)}</span>

            <button
              type="button"
              onClick={() => download(file)}
              disabled={busyId === file.id}
              title={`${file.file_name} 내려받기`}
              className="min-w-0 flex-1 truncate text-left font-semibold text-[#1279E8] underline-offset-2 hover:underline disabled:text-[#98A2B3]"
            >
              {busyId === file.id ? '준비 중…' : file.file_name}
            </button>

            <span className="shrink-0 text-[#C4CBD6]">
              {FILE_KIND_LABEL[file.kind] ?? file.kind} · {formatBytes(file.file_size)}
            </span>
          </li>
        ))}
      </ul>

      {error && <p className="mt-2 text-[12px] text-[#D8453F]">{error}</p>}
    </>
  );
}

/** '26-08-11 11:10' — 목록 안에서는 연도 앞 두 자리가 군더더기입니다 */
function shortStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${pad(d.getFullYear() % 100)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
