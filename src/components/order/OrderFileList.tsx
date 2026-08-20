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
// ★ 긴 이름은 가운데를 접습니다.
//   `김지영2026-08-11_15-47-06.dxd` 처럼 뒤쪽에 시각이 붙는 이름이 많아,
//   끝을 자르면 두 파일이 똑같아 보입니다. 앞과 뒤를 남기고 가운데를
//   `…` 로 접으면 어느 것이 어느 것인지 알아볼 수 있습니다.
//
// ★ 안 올라간 파일도 보여 줍니다.
//   줄은 올리기 전에 만들어집니다. pending 으로 남아 있으면 올리다 끊긴
//   것입니다 — 이름은 알지만 파일이 없습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getOrderFileUrl, submitDeleteOrderFile } from '@/server/actions/order-file';
import { formatBytes, middleEllipsis } from '@/lib/format/order';
import { isFileBlockedFor } from '@/server/domain/file-access';
import type { Sector } from '@/server/domain/order-status';

export interface OrderFileRow {
  id: string;
  kind: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  upload_status?: 'pending' | 'uploaded' | 'failed';
}

export interface OrderFileListProps {
  files: OrderFileRow[];
  /** 지울 수 있는가. 규칙은 domain/order-status 의 canDeleteFile 이 정합니다 */
  deletable?: boolean;
  /**
   * 보는 사람의 소속. 기공소면 스캔 원본에 자물쇠가 붙습니다.
   *
   * ★ 여기서 감추는 것은 **거들 뿐**입니다. 진짜 문은 서버에 있습니다
   *   (actions/order-file 의 fileBlockedFor). 목록만 고치면 파일 id 로
   *   그대로 새어 나갑니다.
   */
  sector?: Sector;
}

export default function OrderFileList({
  files,
  deletable = false,
  sector,
}: OrderFileListProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asking, setAsking] = useState<OrderFileRow | null>(null);
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

    save(result.url, result.fileName);

    // 기공소가 디자인 파일을 받으면 '제작' 으로 넘어갑니다 — 화면도 따라갑니다
    if (result.advanced) startTransition(() => router.refresh());
  }

  async function remove(file: OrderFileRow) {
    setError('');
    setAsking(null);
    setBusyId(file.id);

    const result = await submitDeleteOrderFile(file.id);
    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <>
      <ul className="max-h-[168px] space-y-px overflow-y-auto pr-0.5">
        {files.map((file) => {
          const missing = file.upload_status && file.upload_status !== 'uploaded';
          const busy = busyId === file.id || refreshing;

          return (
            <li
              key={file.id}
              className={
                'group flex items-baseline gap-2 rounded px-2 py-1 text-[13.5px] ' +
                (missing ? 'bg-[#FDF2F2]' : 'bg-white hover:bg-[#F4F8FE]')
              }
            >
              <span className="shrink-0 text-[11px] text-[#C4CBD6]">
                {shortStamp(file.created_at)}
              </span>

              {missing ? (
                <span
                  className="min-w-0 flex-1 truncate text-[#B3312C] line-through"
                  title={file.file_name}
                >
                  {middleEllipsis(file.file_name)}
                </span>
              ) : isFileBlockedFor(sector, { kind: file.kind, fileName: file.file_name }) ? (
                /*
                  ★ 감추지 않고 **자물쇠를 채웁니다** (2026-08-20).
                    아예 안 보이면 기공소는 "치과가 파일을 안 보냈나?" 하고
                    전화합니다. 있다는 건 알되 못 받는 편이 낫습니다.
                */
                <span
                  className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[#98A2B3]"
                  title={`${file.file_name} · 스캔 원본은 기공소에서 열 수 없습니다`}
                >
                  <span className="truncate">{middleEllipsis(file.file_name)}</span>
                  <b className="shrink-0 text-[11px] font-bold text-[#B6BECB]">스캔 원본</b>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => download(file)}
                  disabled={busy}
                  title={`${file.file_name} · ${formatBytes(file.file_size)} · 눌러서 내려받기`}
                  className="min-w-0 flex-1 truncate text-left font-semibold text-[#1279E8] underline-offset-2 hover:underline disabled:text-[#98A2B3]"
                >
                  {busyId === file.id ? '준비 중…' : middleEllipsis(file.file_name)}
                </button>
              )}

              {missing && (
                <b className="shrink-0 text-[11px] font-bold text-[#B3312C]">안 올라감</b>
              )}

              {deletable && (
                <button
                  type="button"
                  onClick={() => setAsking(file)}
                  disabled={busy}
                  aria-label={`${file.file_name} 지우기`}
                  title="지우기"
                  className="-my-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-[#C4CBD6] hover:bg-[#FDECEA] hover:text-[#D8453F] disabled:opacity-40"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-[13px] text-[#D8453F]">{error}</p>}

      {/* ★ 지우기는 되돌릴 수 없어 한 번 묻습니다 */}
      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[340px] overflow-hidden rounded-xl bg-white text-center shadow-xl">
            <div className="px-7 pb-6 pt-7">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FDECEA]">
                <b className="text-[22px] font-extrabold leading-none text-[#D8453F]">!</b>
              </span>

              <h3 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A2130]">
                이 파일을 지울까요?
              </h3>
              <p className="mt-2 break-all text-[13.5px] text-[#4A5567]">{asking.file_name}</p>
              <p className="mt-1.5 text-[13px] text-[#98A2B3]">되돌릴 수 없습니다.</p>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setAsking(null)}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => remove(asking)}
                className="h-11 flex-1 rounded-md bg-[#D8453F] text-[13.5px] font-bold text-white hover:bg-[#C13B36]"
              >
                지우기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- 전체 내려받기 ----------

export interface DownloadAllButtonProps {
  files: OrderFileRow[];
  /** 보는 사람의 소속. 기공소면 막힌 파일은 아예 안 셉니다 */
  sector?: Sector;
}

/**
 * 카드 머리줄의 ⬇ — 올라온 파일을 한 번에 받습니다.
 *
 * ★ 묶어서 하나로 주지 않고 하나씩 잇달아 받습니다.
 *   zip 으로 묶으려면 수백 MB 를 브라우저 메모리에 올려야 합니다.
 *   STL 이 열댓 개면 그대로 멈춥니다.
 *
 * ★ 사이를 조금 띄웁니다.
 *   한꺼번에 쏘면 브라우저가 "여러 파일 내려받기" 를 막습니다.
 */
export function DownloadAllButton({ files, sector }: DownloadAllButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  /*
    ★ 막힌 파일은 여기서도 빠집니다 (2026-08-20).
      목록만 고치고 이걸 두면, 기공소가 '전체 받기' 를 눌러 스캔
      원본을 그대로 가져갑니다. 서버가 막아 주긴 하지만 실패가
      줄줄이 뜨는 화면이 됩니다 — 애초에 안 세는 편이 맞습니다.
  */
  const ready = files.filter(
    (f) =>
      (!f.upload_status || f.upload_status === 'uploaded') &&
      !isFileBlockedFor(sector, { kind: f.kind, fileName: f.file_name }),
  );
  if (ready.length === 0) return null;

  async function downloadAll() {
    setBusy(true);
    setDone(0);
    let advanced = false;

    for (let i = 0; i < ready.length; i++) {
      const result = await getOrderFileUrl(ready[i].id);
      if (result.ok) {
        save(result.url, result.fileName);
        if (result.advanced) advanced = true;
      }

      setDone(i + 1);
      if (i < ready.length - 1) await new Promise((r) => setTimeout(r, 400));
    }

    setBusy(false);
    setDone(0);

    if (advanced) startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={downloadAll}
      disabled={busy}
      title={`파일 ${ready.length}개 한 번에 내려받기`}
      aria-label={`파일 ${ready.length}개 한 번에 내려받기`}
      className="grid h-7 w-7 place-items-center rounded-md text-[#4A5567] hover:bg-[#E7EEFA] hover:text-[#1279E8] disabled:text-[#C4CBD6]"
    >
      {busy ? (
        <span className="text-[10.5px] font-bold tabular-nums">
          {done}/{ready.length}
        </span>
      ) : (
        <DownloadIcon />
      )}
    </button>
  );
}

// ---------- 조각들 ----------

function save(url: string, fileName: string) {
  // 새 탭이 아니라 내려받기로 가야 STL 이 브라우저에 통째로 열리지 않습니다
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** '08-11 11:10' — 목록 안에서는 연도가 군더더기입니다 */
function shortStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DownloadIcon() {
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
      <path d="M10 3v9.5M6.5 9 10 12.5 13.5 9" />
      <path d="M3.5 13.5v1.8a1.2 1.2 0 0 0 1.2 1.2h10.6a1.2 1.2 0 0 0 1.2-1.2v-1.8" />
    </svg>
  );
}
