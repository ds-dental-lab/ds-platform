// =========================================================
// 놓을 위치: src/app/(dev)/playground/tooth-chart/page.tsx
//
// 치식도 시연 화면. 내부 확인용이며 운영 배포에서는 제외합니다.
// (구현계획서 Sprint 2 — (dev)/playground/tooth-chart)
// =========================================================

'use client';

import { useState } from 'react';
import ToothChart from '@/components/dental/ToothChart';
import { addPlacement, type Placement } from '@/server/domain/duplicate';
import { linkKey, type ToothPlacement } from '@/server/domain/bridge';
import { PROSTHESIS_TYPES, getMaterials, buildAbbr } from '@/server/domain/prosthesis';
import { getShades, getDefaultSystem } from '@/server/domain/shade';

export default function ToothChartPlayground() {
  const [typeCode, setTypeCode] = useState('crown');
  const [materialCode, setMaterialCode] = useState('zirconia');
  const [shade, setShade] = useState('A3');
  const [ponticMode, setPonticMode] = useState(false);

  const [placements, setPlacements] = useState<ToothPlacement[]>([]);
  const [severedKeys, setSeveredKeys] = useState<string[]>([]);

  const materials = getMaterials(typeCode);
  const shades = getShades(getDefaultSystem().code);

  // 종류를 바꾸면 재료를 초기화합니다 (명세서 §4.2.2)
  function changeType(next: string) {
    setTypeCode(next);
    setMaterialCode(getMaterials(next)[0]?.code ?? '');
    if (next === 'inlay') setPonticMode(false);   // 인레이 폰틱은 없습니다
  }

  function handleToothClick(tooth: number) {
    const current: Placement[] = placements
      .filter((p) => p.tooth === tooth)
      .map(({ typeCode, materialCode }) => ({ typeCode, materialCode }));

    const result = addPlacement(current, { typeCode, materialCode });

    setPlacements((prev) => [
      ...prev.filter((p) => p.tooth !== tooth),
      ...result.placements.map((p) => ({
        tooth,
        typeCode: p.typeCode,
        materialCode: p.materialCode,
        isPontic: ponticMode,
      })),
    ]);
  }

  function handleSever(key: string) {
    setSeveredKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function reset() {
    setPlacements([]);
    setSeveredKeys([]);
  }

  const canPontic = typeCode !== 'inlay';

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold">치식도 시연</h1>
      <p className="mt-1 text-sm text-gray-500">
        보철 종류와 재료를 고른 뒤 치아를 누르세요. 같은 조건으로 다시 누르면 해제됩니다.
      </p>

      {/* ---------- 조작부 ---------- */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PROSTHESIS_TYPES.map((t) => (
          <button
            key={t.code}
            onClick={() => changeType(t.code)}
            className={`rounded border px-3 py-1.5 text-sm ${
              typeCode === t.code
                ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
                : 'border-gray-300 bg-white'
            }`}
          >
            {t.name}
          </button>
        ))}

        <span className="mx-2 text-gray-300">|</span>

        <select
          value={materialCode}
          onChange={(e) => setMaterialCode(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          {materials.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          value={shade}
          onChange={(e) => setShade(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          {shades.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          onClick={() => setPonticMode(!ponticMode)}
          disabled={!canPontic}
          title={canPontic ? undefined : '인레이 폰틱은 존재하지 않습니다'}
          className={`rounded border px-3 py-1.5 text-sm ${
            !canPontic
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              : ponticMode
                ? 'border-amber-600 bg-amber-50 font-semibold text-amber-700'
                : 'border-gray-300 bg-white'
          }`}
        >
          폰틱 {ponticMode ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={reset}
          className={`ml-auto rounded border px-3 py-1.5 text-sm ${
            placements.length > 0
              ? 'border-red-500 font-semibold text-red-600'
              : 'border-gray-300 text-gray-400'
          }`}
        >
          초기화
        </button>
      </div>

      {/* ---------- 치식도 ---------- */}
      <div className="mt-6 rounded-lg border bg-white p-6">
        <ToothChart
          placements={placements}
          severedKeys={severedKeys}
          onToothClick={handleToothClick}
          onSeverLink={handleSever}
        />
      </div>

      {/* ---------- 요약 ---------- */}
      <div className="mt-6 rounded-lg border bg-gray-50 p-5 text-sm">
        <h2 className="font-semibold">요약</h2>
        {placements.length === 0 ? (
          <p className="mt-2 text-gray-500">선택된 치아가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {groupForSummary(placements).map((line) => (
              <li key={line.key} className="font-mono">
                {line.abbr} | {line.teeth} ({shade})
              </li>
            ))}
          </ul>
        )}
        {severedKeys.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            끊어 둔 연결 — {severedKeys.join(', ')}
          </p>
        )}
      </div>
    </main>
  );
}

/** 요약 카드 형식으로 정리합니다 — `Zir-Cr | 42, X, 31` */
function groupForSummary(placements: ToothPlacement[]) {
  const map = new Map<string, ToothPlacement[]>();

  for (const p of placements) {
    const key = `${p.typeCode}|${p.materialCode}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  return [...map.entries()].map(([key, list]) => {
    const [typeCode, materialCode] = key.split('|');
    return {
      key,
      abbr: buildAbbr(typeCode, materialCode),
      teeth: list.map((p) => (p.isPontic ? 'X' : String(p.tooth))).join(', '),
    };
  });
}
