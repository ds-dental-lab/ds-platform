// =========================================================
// 놓을 위치: src/app/(dev)/playground/implant/page.tsx
// 임플란트 선택 시연 화면. 내부 확인용입니다.
// 마스터는 DB 에서 옵니다 — page.tsx(서버)가 읽어 내려줍니다.
// =========================================================

'use client';

import { useState } from 'react';
import ImplantPicker from '@/components/dental/ImplantPicker';
import {
  EMPTY_SELECTION,
  isComplete,
  type ImplantCatalog,
  type ImplantSelection,
} from '@/server/domain/implant';

export default function ImplantPlayground({ catalog }: { catalog: ImplantCatalog }) {
  const [selection, setSelection] = useState<ImplantSelection>(EMPTY_SELECTION);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold">임플란트 선택 시연</h1>
      <p className="mt-1 text-sm text-gray-500">
        제조사를 고르면 그 제조사의 타입만 나옵니다. 사이즈와 스크류는 타입에 딸립니다.
      </p>

      <div className="mt-6">
        <ImplantPicker catalog={catalog} value={selection} onChange={setSelection} />
      </div>

      <div className="mt-6 rounded-lg border bg-gray-50 p-5 text-sm">
        <h2 className="font-semibold">저장될 값</h2>
        <pre className="mt-2 font-mono text-[14px] text-gray-700">
{JSON.stringify(selection, null, 2)}
        </pre>
        <p className="mt-2">
          주문 진행 —{' '}
          <b className={isComplete(catalog, selection) ? 'text-green-700' : 'text-gray-400'}>
            {isComplete(catalog, selection) ? '가능' : '불가'}
          </b>
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
        <h2 className="font-semibold">확인해 볼 것</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
          <li>Osstem → 타입에 KS · SS · TS · US 만. IS 는 없음</li>
          <li>Osstem TS → 사이즈 Mini · Regular / 스크류 Hex · Non-Hex</li>
          <li>Osstem SS → 사이즈 Mini · Regular · Wide / 스크류 Octa · Non-Octa</li>
          <li>Osstem US → 사이즈 칸이 비고, 그래도 진행 가능</li>
          <li>제조사를 Dentium 으로 바꾸면 아래가 전부 초기화</li>
        </ul>
      </div>
    </main>
  );
}
