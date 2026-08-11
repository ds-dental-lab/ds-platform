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

/** 명세서 §4.2.9 */
const EXTS = ['PLY', 'OBJ', 'STL', 'DXD', 'ZIP', 'PNG', 'JPG'];
const ACCEPT = '.ply,.obj,.stl,.dxd,.dcm,.zip,.png,.jpg,.jpeg';
const MAX_SIZE = 100 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface ScanDropZoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export default function ScanDropZone({ files, onChange, disabled }: ScanDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  function add(list: FileList | null) {
    if (!list) return;
    setError('');

    const next: File[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_SIZE) {
        setError(`${file.name} 은 100MB 를 넘어 올릴 수 없습니다`);
        continue;
      }
      next.push(file);
    }

    onChange([...files, ...next]);
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

        <p className="mt-3 text-[13px] text-[#4A5567]">
          파일을 끌어 넣거나 여기를 클릭해주세요
        </p>
        <p className="mt-2 text-[11.5px] text-[#98A2B3]">지원 되는 파일형식</p>

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

      {error && <p className="mt-2 text-[12px] text-[#D8453F]">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded border border-[#E8EBF0] bg-white px-3 py-2 text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate text-[#1A2130]">{file.name}</span>
              <span className="shrink-0 text-[11.5px] text-[#98A2B3]">
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
