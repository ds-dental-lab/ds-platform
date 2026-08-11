// =========================================================
// 놓을 위치: src/app/(dev)/playground/tooth-chart/page.tsx
//              ← 기존 내용을 통째로 교체합니다
//
// 치식도 + 요약 카드를 함께 시연합니다.
// =========================================================

'use client';

import { useState } from 'react';
import ToothChart from '@/components/dental/ToothChart';
import ProsthesisSummary from '@/components/dental/ProsthesisSummary';
import { addPlacement, type Placement } from '@/server/domain/duplicate';
import type { ToothPlacement } from '@/server/domain/bridge';
import { FALLBACK_TYPES, getMaterials } from '@/server/domain/prosthesis';
import { getShades, getDefaultSystem, type ToothShade } from '@/server/domain/shade';
import type { SummaryLine } from '@/server/domain/summary';

export default function ToothChartPlayground() {
  const [typeCode, setTypeCode] = useState('crown');
  const [materialCode, setMaterialCode] = useState('zirconia');
  const [shadeCode, setShadeCode] = useState('A3');
  const [ponticMode, setPonticMode] = useState(false);

  const [placements, setPlacements] = useState<ToothPlacement[]>([]);
  const [shades, setShades] = useState<Record<number, ToothShade>>({});
  const [severedKeys, setSeveredKeys] = useState<string[]>([]);

  const materials = getMaterials(FALLBACK_TYPES, typeCode);
  const shadeList = getShades(getDefaultSystem().code);
  const canPontic = typeCode !== 'inlay';

  // 종류를 바꾸면 재료를 초기화합니다 (명세서 §4.2.2)
  function changeType(next: string) {
    setTypeCode(next);
    setMaterialCode(getMaterials(FALLBACK_TYPES, next)[0]?.code ?? '');
    if (next === 'inlay') setPonticMode(false);
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

    // 폰틱이 아니면 지금 고른 쉐이드를 치아 전체에 넣습니다
    if (!ponticMode && result.action !== 'remove') {
      setShades((prev) => ({
        ...prev,
        [tooth]: { cervical: shadeCode, incisal: shadeCode },
      }));
    }
  }

  function handleSever(key: string) {
    setSeveredKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  /** 요약에서 한 줄을 지우면 그 종류·재료 조합만 빠집니다 */
  function handleRemoveLine(line: SummaryLine) {
    setPlacements((prev) =>
      prev.filter(
        (p) => !(p.typeCode === line.typeCode && p.materialCode === line.materialCode),
      ),
    );
  }

  function handleReset() {
    setPlacements([]);
    setShades({});
    setSeveredKeys([]);
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold">치식도 시연</h1>
      <p className="mt-1 text-sm text-gray-500">
        보철 종류와 재료를 고른 뒤 치아를 누르세요. 같은 조건으로 다시 누르면 해제됩니다.
      </p>

      {/* ---------- 조작부 ---------- */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FALLBACK_TYPES.map((t: (typeof FALLBACK_TYPES)[number]) => (
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

        <span className="mx-1 text-gray-300">|</span>

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
          value={shadeCode}
          onChange={(e) => setShadeCode(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          {shadeList.map((s) => (
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
      <div className="mt-6">
        <ProsthesisSummary
          placements={placements}
          shades={shades}
          onRemoveLine={handleRemoveLine}
          onReset={handleReset}
        />
      </div>

      {severedKeys.length > 0 && (
        <p className="mt-3 text-xs text-gray-500">끊어 둔 연결 — {severedKeys.join(', ')}</p>
      )}
    </main>
  );
}
