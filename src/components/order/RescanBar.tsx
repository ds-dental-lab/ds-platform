// =========================================================
// 놓을 위치: src/components/order/RescanBar.tsx
//
// 스캔 파일 재등록. (시안 .rescan-bar + #rsDlg)
//
// 재스캔 상태일 때 스캔 파일 카드 안에 붉은 띠로 뜹니다.
// 누르면 창이 열리고, 파일을 정하면 주문이 접수로 돌아갑니다.
//
// ★ 새 파일을 먼저 올리고 나서 상태를 바꿉니다.
//   순서를 뒤집으면 업로드가 실패했을 때 접수로 돌아간 채
//   스캔이 없는 주문이 남습니다. 디자인센터가 열어 볼 것이 없습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitResubmitScan } from '@/server/actions/rescan';
import { uploadOrderFiles } from '@/lib/upload';
import UploadToast, { type UploadState } from '@/components/order/UploadToast';
import ScanDropZone from '@/components/order/ScanDropZone';
import type { OrderDetailFile } from '@/server/repositories/order';
import { statusChangeMessage } from '@/server/domain/order-status';
import { useToast } from '@/components/ui/Toast';

export interface RescanBarProps {
  orderId: string;
  /** 지금 붙어 있는 스캔 파일. 재사용하지 않으면 이 목록을 치웁니다 */
  scanFiles: OrderDetailFile[];
}

export default function RescanBar({ orderId, scanFiles }: RescanBarProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');

  const [open, setOpen] = useState(false);
  const [reuse, setReuse] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  /** 오른쪽 위 업로드 알림 */
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [error, setError] = useState('');

  const busy = saving || pending;
  const ready = reuse || files.length > 0;

  function openDialog() {
    setReuse(false);
    setFiles([]);
    setError('');
    setOpen(true);
  }

  async function handleSubmit() {
    setError('');
    setSaving(true);

    // ① 새 파일부터 올립니다
    if (files.length > 0) {
      setProgress('파일 올리는 중…');

      const upload = await uploadOrderFiles(orderId, files, (progress) =>
        setUpload({ phase: 'uploading', progress }),
      );

      setProgress('');
      setUpload(
        upload.ok
          ? { phase: 'done', total: files.length }
          : { phase: 'failed', total: files.length, failed: upload.failed, failures: upload.failures },
      );

      if (!upload.ok) {
        setSaving(false);
        setError(`파일 ${upload.failed.length}개를 올리지 못했습니다. 다시 시도해 주세요.`);
        return;
      }
    }

    // ② 파일이 자리를 잡은 뒤에 상태를 되돌립니다
    const result = await submitResubmitScan({
      orderId,
      reuse,
      replaceFileIds: reuse ? [] : scanFiles.map((f) => f.id),
      uploadedCount: files.length,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    // 재스캔이 풀려 접수로 돌아갑니다
    toast(statusChangeMessage('received'));
    startTransition(() => router.refresh());
  }

  return (
    <>
      <UploadToast state={upload} onClose={() => setUpload(null)} />

      {/* 시안 .rescan-bar */}
      <button
        type="button"
        onClick={openDialog}
        className="mb-3.5 flex w-full items-center justify-between gap-2.5 rounded-[7px] border border-[#F3C6C6] bg-[#FDECEA] px-[13px] py-[11px] text-[13.5px] font-bold text-[#C4383A] hover:bg-[#FBE0DC]"
      >
        <span className="flex items-center gap-[7px]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M8 1.8 15 14H1z" />
            <path d="M8 6.4v3.2M8 11.4v.6" />
          </svg>
          스캔파일을 다시 등록해 주세요
        </span>

        <svg
          width="15"
          height="15"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13V4M6.5 7.5 10 4l3.5 3.5M3.5 15.5h13" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[440px] rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-[22px] pb-2 pt-5">
              <h3 className="text-[17px] font-extrabold tracking-[-0.035em] text-[#1A2130]">
                스캔 파일 등록
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="grid h-7 w-7 place-items-center rounded text-[#98A2B3] hover:bg-[#F4F6F9]"
              >
                ✕
              </button>
            </div>

            <div className="px-[22px] pt-1">
              <label
                className={
                  'mb-3.5 flex items-center gap-2.5 text-[14px] ' +
                  (scanFiles.length === 0
                    ? 'cursor-not-allowed text-[#C4CBD6]'
                    : 'cursor-pointer text-[#1A2130]')
                }
                title={scanFiles.length === 0 ? '다시 쓸 이전 스캔이 없습니다' : undefined}
              >
                <input
                  type="checkbox"
                  checked={reuse}
                  disabled={scanFiles.length === 0}
                  onChange={(e) => setReuse(e.target.checked)}
                  className="h-4 w-4"
                />
                이전 스캔 데이터 그대로 사용
                {scanFiles.length > 0 && (
                  <span className="text-[12.5px] text-[#98A2B3]">
                    {scanFiles.length}개
                  </span>
                )}
              </label>

              <ScanDropZone files={files} onChange={setFiles} disabled={busy} />

              <p
                className={
                  'mt-2.5 text-[13px] ' + (ready ? 'text-[#98A2B3]' : 'text-[#C4383A]')
                }
              >
                {ready
                  ? reuse && files.length === 0
                    ? '이전 스캔 그대로 다시 봐 달라고 보냅니다.'
                    : '새 파일로 바꿔 보냅니다. 이전 스캔은 목록에서 내려갑니다.'
                  : '이전 스캔을 사용하거나 새 파일을 올려주세요.'}
              </p>

              {progress && <p className="mt-2 text-[13.5px] text-[#1279E8]">{progress}</p>}
              {error && <p className="mt-2 text-[13.5px] text-[#D8453F]">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 px-[22px] pb-5 pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-[34px] rounded-[7px] border border-[#DDE2EA] px-4 text-[14px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy || !ready}
                className="h-[34px] rounded-[7px] bg-[#1279E8] px-6 text-[14px] font-bold text-white hover:bg-[#1554C8] disabled:cursor-not-allowed disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
              >
                {busy ? '처리 중…' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
