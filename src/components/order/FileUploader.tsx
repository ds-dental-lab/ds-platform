'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'order-files';
const MAX_SIZE = 100 * 1024 * 1024;

export interface UploadedFile {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface FileUploaderProps {
  orderId?: string | null;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
  pending: File[];
  onPendingChange: (updater: (prev: File[]) => File[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export default function FileUploader({ files, onChange, disabled, pending, onPendingChange }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const setPending = onPendingChange;
  const [error, setError] = useState('');

  function handlePick(picked: FileList | null) {
    if (!picked) return;
    setError('');

    const next: File[] = [];
    for (const file of Array.from(picked)) {
      if (file.size > MAX_SIZE) {
        setError(file.name + ' 은 100MB 를 넘어 올릴 수 없습니다');
        continue;
      }
      next.push(file);
    }

    setPending((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removePending(index: number) {
    setPending((prev) => prev.filter((_, i) => i !== index));
  }

  function removeUploaded(path: string) {
    onChange(files.filter((f) => f.path !== path));
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        onChange={(e) => handlePick(e.target.files)}
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
      />

      <p className="mt-2 text-[12px] text-gray-400">
        스캔 데이터를 선택하세요. 주문 등록을 누르면 함께 올라갑니다. 파일당 100MB 까지.
      </p>

      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}

      {pending.length > 0 && (
        <ul className="mt-3 space-y-1">
          {pending.map((file, i) => (
            <li key={i} className="flex items-center gap-2 rounded bg-gray-50 px-3 py-2 text-[13px]">
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-gray-400">{formatSize(file.size)}</span>
              <button onClick={() => removePending(i)} className="text-gray-400 hover:text-red-500">x</button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-1">
          {files.map((file) => (
            <li key={file.path} className="flex items-center gap-2 rounded bg-green-50 px-3 py-2 text-[13px]">
              <span className="text-green-600">완료</span>
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-gray-400">{formatSize(file.size)}</span>
              <button onClick={() => removeUploaded(file.path)} className="text-gray-400 hover:text-red-500">x</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


