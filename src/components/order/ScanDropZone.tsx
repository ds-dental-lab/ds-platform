// =========================================================
// 놓을 위치: src/components/order/ScanDropZone.tsx
//
// 스캔/쉐이드 파일 드롭존. (기능명세서 §4.2.9, 시안 .drop)
//   끌어 넣거나 눌러서 고릅니다. 지원 형식을 배지로 보여 줍니다.
//
// 실제 업로드는 주문이 만들어진 뒤에 일어납니다 (lib/upload).
// 여기서는 고른 파일을 들고만 있습니다.
// =========================================================

'use client';

import { useRef, useState } from 'react';
import { checkUploadBatch } from '@/server/domain/upload';
import type { ExistingOrderFile } from '@/components/order/orderFormInitial';

/** 명세서 §4.2.9 */
const EXTS = ['PLY', 'OBJ', 'STL', 'DXD', 'ZIP', 'PNG', 'JPG'];
const ACCEPT = '.ply,.obj,.stl,.dxd,.dcm,.zip,.png,.jpg,.jpeg';

// ★ 상한은 domain/upload 한 곳에 있습니다. 전에는 이 파일과
//   DesignFileUpload 에 같은 값이 따로 적혀 있었습니다 —
//   그런 것은 언젠가 한쪽만 고쳐집니다. 버킷에도 같은 값이 걸려 있습니다.

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface ScanDropZoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /**
   * 이미 올라가 있는 파일 (수정 화면).
   *
   * ★ 여기서 지우지는 못합니다. 지우기는 주문상세의 파일 목록이
   *   맡습니다 — 누가 언제 지울 수 있는지의 규칙이 거기 있습니다.
   *   여기서는 "이미 이만큼 있다" 만 보여 줍니다.
   */
  existing?: ExistingOrderFile[];
}

export default function ScanDropZone({ files, onChange, disabled, existing = [] }: ScanDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  function add(list: FileList | null) {
    if (!list) return;
    setError('');

    const next = [...files, ...Array.from(list)];

    /*
      ★ 이미 고른 것까지 **합쳐서** 잽니다 (작업지시서 §3-1).
        새로 고른 것만 재면, 300MB 를 세 번 나눠 고르는 식으로 총량
        상한을 그냥 지나갑니다. 폴더째 끌어다 놓는 사고가 그렇게 옵니다.

      ★ 수정 화면에서는 **이미 올라가 있는 것까지** 함께 잽니다.
        총량 상한은 주문 하나에 걸린 값이라, 새로 고른 것만 재면
        수정을 몇 번 반복하는 것으로 상한을 지나갑니다.
    */
    const problem = checkUploadBatch([
      ...existing
        .filter((f) => f.status === 'uploaded')
        .map((f) => ({ name: f.name, size: f.size })),
      ...next,
    ]);

    if (problem) {
      setError(problem);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 transition-colors ' +
          (disabled
            ? 'cursor-not-allowed border-[#E8EBF0] bg-[#F8F9FB]'
            : over
              ? 'border-[#1279E8] bg-[#EDF3FE]'
              : 'border-[#DDE2EA] bg-white hover:border-[#1279E8]')
        }
      >
        <svg
          width="42"
          height="42"
          viewBox="0 0 44 44"
          fill="none"
          stroke="#8E99AB"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 4.5h13L34 13.5v26H12z" />
          <path d="M25 4.5v9h9" />
          <path d="M23 33V22M18.5 26.5 23 22l4.5 4.5" />
        </svg>

        <p className="mt-3 text-[14px] text-[#4A5567]">
          파일을 끌어 넣거나 여기를 클릭해주세요
        </p>
        <p className="mt-2 text-[12.5px] text-[#98A2B3]">지원 되는 파일형식</p>

        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {EXTS.map((ext) => (
            <span
              key={ext}
              className="rounded border border-[#E8EBF0] bg-[#F4F6F9] px-2 py-0.5 text-[10.5px] font-bold text-[#8E99AB]"
            >
              {ext}
            </span>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={ACCEPT}
          disabled={disabled}
          onChange={(e) => add(e.target.files)}
        />
      </label>

      {error && <p className="mt-2 text-[13px] text-[#D8453F]">{error}</p>}

      {/*
        ★ 이미 올라가 있는 것을 **먼저** 보여 줍니다.
          없으면 드롭존이 빈 칸으로 보여 "안 올라갔나" 하고 같은
          파일을 또 올립니다 (사용자 지적 2026-08-21).
      */}
      {existing.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[12.5px] font-semibold text-[#8E99AB]">
            이미 올라간 파일 {existing.length}개
          </p>

          <ul className="space-y-1.5">
            {existing.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded border border-[#E8EBF0] bg-[#F8F9FB] px-3 py-2 text-[14px]"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke={file.status === 'uploaded' ? '#12855B' : '#D8453F'}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  {file.status === 'uploaded' ? (
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  ) : (
                    <>
                      <path d="M8 3v6" />
                      <path d="M8 12.5v.5" />
                    </>
                  )}
                </svg>

                <span className="min-w-0 flex-1 truncate text-[#4A5567]">{file.name}</span>

                <span className="shrink-0 text-[12.5px] text-[#98A2B3]">
                  {file.status === 'uploaded' ? formatSize(file.size) : '올라가지 않음'}
                </span>
              </li>
            ))}
          </ul>

          {files.length > 0 && (
            <p className="mt-3 mb-1.5 text-[12.5px] font-semibold text-[#8E99AB]">
              이번에 더 올릴 파일 {files.length}개
            </p>
          )}
        </div>
      )}

      {files.length > 0 && (
        <ul className={(existing.length > 0 ? 'mt-0 ' : 'mt-3 ') + 'space-y-1.5'}>
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded border border-[#E8EBF0] bg-white px-3 py-2 text-[14px]"
            >
              <span className="min-w-0 flex-1 truncate text-[#1A2130]">{file.name}</span>
              <span className="shrink-0 text-[12.5px] text-[#98A2B3]">
                {formatSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, n) => n !== i))}
                disabled={disabled}
                aria-label={`${file.name} 빼기`}
                className="shrink-0 text-[#C4CBD6] hover:text-[#D8453F]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
