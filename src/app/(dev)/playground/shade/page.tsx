// =========================================================
// 놓을 위치: src/app/(dev)/playground/shade/page.tsx
// 쉐이드 선택 시연 화면. 내부 확인용입니다.
// =========================================================

'use client';

import { useState } from 'react';
import ShadePicker from '@/components/dental/ShadePicker';
import { EMPTY_SHADE, formatShade, type ToothShade } from '@/server/domain/shade';

export default function ShadePlayground() {
  const [shade, setShade] = useState<ToothShade>(EMPTY_SHADE);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">쉐이드 시연</h1>
      <p className="mt-1 text-sm text-gray-500">
        색조를 처음 누르면 치아 전체에 적용됩니다. 그다음 다른 색조를 누르고
        치아 그림의 위 또는 아래를 누르면 그 부위에만 들어갑니다.
      </p>

      <div className="mt-6">
        <ShadePicker value={shade} onChange={setShade} />
      </div>

      <div className="mt-6 rounded-lg border bg-gray-50 p-5 text-sm">
        <h2 className="font-semibold">저장될 값</h2>
        <pre className="mt-2 font-mono text-[13px] text-gray-700">
{JSON.stringify(shade, null, 2)}
        </pre>
        <p className="mt-2">
          요약 표기 — <b className="font-mono">{formatShade(shade) || '(없음)'}</b>
        </p>
      </div>
    </main>
  );
}
