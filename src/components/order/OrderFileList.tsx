// =========================================================
// 놓을 위치: src/components/order/OrderFileList.tsx
//
// 주문상세의 파일 목록. 파일명을 누르면 내려받습니다.
//
// ★ 주소를 미리 만들어 두지 않습니다.
//   누른 순간 서버에 물어 1분짜리 주소를 받아 씁니다.
//   화면 소스에 파일 주소가 박혀 있으면 로그인 없이도 새어 나갑니다.
//
// ★ 열다섯 개까지 들어옵니다 (사용자 경험담 2026-08-12).
//   칸을 고정 높이로 두고 안에서 굴립니다. 카드가 늘어나면 그 아래
//   제작옵션·요청사항이 통째로 밀려 화면이 무너집니다.
//
// ★ 한 줄을 얇게 잡았습니다.
//   시각 · 종류 · 크기가 이름과 같은 줄에서 자리를 다투고 있었습니다.
//   이름이 가장 중요하므로 이름에 폭을 몰아주고 나머지는 아래로 내렸습니다.
//
// ★ 안 올라간 파일도 보여 줍니다.
//   줄은 올리기 전에 만들어집니다. pending 으로 남아 있으면 올리다 끊긴
//   것입니다 — 이름은 알지만 파일이 없습니다. 회색으로 눕히고 눌리지 않게 합니다.
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
  upload_status?: 'pending' | 'uploaded' | 'failed';
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
      {/* 열다섯 개가 들어와도 카드 높이는 그대로입니다 */}
      <ul className="max-h-[168px] space-y-px overflow-y-auto pr-0.5">
        {files.map((file) => {
          const missing = file.upload_status && file.upload_status !== 'uploaded';

          return (
            <li
              key={file.id}
              className={
                'flex items-baseline gap-2 rounded px-2 py-1 text-[12.5px] ' +
                (missing ? 'bg-[#FDF2F2]' : 'bg-white hover:bg-[#F4F8FE]')
              }
            >
              {missing ? (
                <span className="min-w-0 flex-1 truncate text-[#B3312C] line-through" title={file.file_name}>
                  {file.file_name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => download(file)}
                  disabled={busyId === file.id}
                  title={`${file.file_name} · ${formatBytes(file.file_size)} · 눌러서 내려받기`}
                  className="min-w-0 flex-1 truncate text-left font-semibold text-[#1279E8] underline-offset-2 hover:underline disabled:text-[#98A2B3]"
                >
                  {busyId === file.id ? '준비 중…' : file.file_name}
                </button>
              )}

              {/* 이름에 폭을 몰아주고 곁가지는 작게 붙입니다 */}
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[#C4CBD6]">
                {missing ? (
                  <b className="font-bold text-[#B3312C]">안 올라감</b>
                ) : (
                  <>
                    {formatBytes(file.file_size)}
                    <span className="ml-1.5">{shortStamp(file.created_at)}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-[12px] text-[#D8453F]">{error}</p>}
    </>
  );
}

/** '08-11 11:10' — 목록 안에서는 연도가 군더더기입니다 */
function shortStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 종류 딱지 — 스캔·디자인이 한 목록에 섞이는 화면에서만 씁니다 */
export function fileKindLabel(kind: string): string {
  return FILE_KIND_LABEL[kind] ?? kind;
}
