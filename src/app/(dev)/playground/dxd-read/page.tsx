'use client';

// =========================================================
// 놓을 위치: src/app/(dev)/playground/dxd-read/page.tsx
//
// 브라우저가 dxd 를 제대로 읽는지 보는 자리 (2026-10-02).
// 손으로 올린 파일에서 환자·차트·치식을 읽어 주문서를 채우는 길의 확인용입니다.
// =========================================================

import { useState } from 'react';
import { readDxd } from '@/lib/dxd-read';
import type { DxdCase } from '@/server/domain/dxd';

export default function DxdReadPlayground() {
  const [result, setResult] = useState<DxdCase | null>(null);
  const [ms, setMs] = useState(0);
  const [note, setNote] = useState('');

  async function run(file: File) {
    setNote(`${file.name} · ${Math.round(file.size / 1e6)}MB`);
    const t0 = performance.now();
    const read = await readDxd(file);
    setMs(Math.round(performance.now() - t0));
    setResult(read);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-6">
      <h1 className="text-[19px] font-extrabold text-[#1A2130]">dxd 읽기 확인</h1>

      <p className="text-[13px] text-[#7C8595]">
        dxd 를 고르면 안의 환자·차트·치식을 읽습니다. 통째로 안 읽고 조각만 꺼냅니다 —
        실측 181MB 파일이 3ms (2026-10-02).
      </p>

      <div className="flex gap-2">
        <label className="cursor-pointer rounded-md bg-[#1279E8] px-3 py-2 text-[13.5px] font-bold text-white">
          파일 고르기
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void run(f);
            }}
          />
        </label>
      </div>

      {note && <p className="text-[13px] text-[#7C8595]">{note} · 읽는 데 {ms}ms</p>}

      {result && (
        <pre className="whitespace-pre-wrap rounded-lg border border-[#E8EBF0] bg-white p-4 text-[13px] text-[#1A2130]">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
