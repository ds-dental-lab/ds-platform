'use client';

import { useState } from 'react';
import { PROSTHESIS_TYPES, getMaterials } from '@/server/domain/prosthesis';
import {
  SHADE_SYSTEMS,
  getShades,
  formatShade,
  EMPTY_SHADE,
  type ToothShade,
  type ShadeSystemCode,
} from '@/server/domain/shade';
import {
  EMPTY_SELECTION,
  formatSelection,
  isComplete as implantComplete,
  type ImplantCatalog,
  type ImplantSelection,
} from '@/server/domain/implant';
import ImplantPicker from '@/components/dental/ImplantPicker';
import type { ImplantFavorite } from '@/server/repositories/implant';

export interface Brush {
  typeCode: string;
  materialCode: string;
  isPontic: boolean;
  shadeSystem: ShadeSystemCode;
  shade: ToothShade;
  implant: ImplantSelection;
}

export const DEFAULT_BRUSH: Brush = {
  typeCode: 'crown',
  materialCode: 'zirconia',
  isPontic: false,
  shadeSystem: 'vita_classic',
  shade: EMPTY_SHADE,
  implant: EMPTY_SELECTION,
};

export interface ProsthesisPanelProps {
  value: Brush;
  onChange: (brush: Brush) => void;
  /** 임플란트 마스터. 서버 컴포넌트가 DB 에서 읽어 내려줍니다 */
  implantCatalog: ImplantCatalog;
  /** 이 치과의 자주 쓰는 조합 */
  implantFavorites?: ImplantFavorite[];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-gray-100 py-3 last:border-0">
      <span className="w-16 shrink-0 pt-1.5 text-[13px] font-semibold text-gray-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function chip(active: boolean): string {
  return active
    ? 'rounded border border-blue-600 bg-blue-50 px-3 py-1.5 text-[13px] font-semibold text-blue-700'
    : 'rounded border border-gray-300 bg-white px-3 py-1.5 text-[13px] hover:border-gray-400';
}

export default function ProsthesisPanel({
  value,
  onChange,
  implantCatalog,
  implantFavorites,
}: ProsthesisPanelProps) {
  const [implantOpen, setImplantOpen] = useState(false);

  const materials = getMaterials(value.typeCode);
  const shades = getShades(value.shadeSystem);
  const isImplant = value.typeCode === 'implant';
  const canPontic = value.typeCode !== 'inlay';

  function changeType(next: string) {
    onChange({
      ...value,
      typeCode: next,
      materialCode: getMaterials(next)[0]?.code ?? '',
      isPontic: next === 'inlay' ? false : value.isPontic,
      implant: next === 'implant' ? value.implant : EMPTY_SELECTION,
    });
  }

  function pickShade(code: string) {
    const next: ToothShade =
      value.shade.cervical === null
        ? { cervical: code, incisal: code }
        : { ...value.shade, cervical: code };
    onChange({ ...value, shade: next });
  }

  function pickIncisal(code: string) {
    onChange({ ...value, shade: { ...value.shade, incisal: code } });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <Row label="종류">
        <div className="flex flex-wrap gap-2">
          {PROSTHESIS_TYPES.map((t) => (
            <button key={t.code} onClick={() => changeType(t.code)} className={chip(value.typeCode === t.code)}>
              {t.name}
            </button>
          ))}
        </div>
      </Row>

      <Row label="재료">
        <div className="flex flex-wrap gap-2">
          {materials.map((m) => (
            <button key={m.code} onClick={() => onChange({ ...value, materialCode: m.code })} className={chip(value.materialCode === m.code)}>
              {m.name}
            </button>
          ))}
        </div>
      </Row>
      <Row label="쉐이드">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={value.shadeSystem}
            onChange={(e) =>
              onChange({
                ...value,
                shadeSystem: e.target.value as ShadeSystemCode,
                shade: EMPTY_SHADE,
              })
            }
            className="rounded border border-gray-300 px-2 py-1.5 text-[13px]"
          >
            {SHADE_SYSTEMS.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>

          <select
            value={value.shade.cervical ?? ''}
            onChange={(e) => pickShade(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-[13px]"
          >
            <option value="">치경부</option>
            {shades.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={value.shade.incisal ?? ''}
            onChange={(e) => pickIncisal(e.target.value)}
            disabled={value.shade.cervical === null}
            className="rounded border border-gray-300 px-2 py-1.5 text-[13px] disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">절단부</option>
            {shades.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {formatShade(value.shade) && (
            <span className="rounded bg-blue-50 px-2 py-1 font-mono text-[13px] font-semibold text-blue-700">
              {formatShade(value.shade)}
            </span>
          )}
        </div>
      </Row>
      {isImplant && (
        <Row label="모델">
          <div className="w-full">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setImplantOpen(!implantOpen)}
                className="rounded border border-gray-300 px-3 py-1.5 text-[13px] hover:bg-gray-50"
              >
                {implantOpen ? '접기' : '선택'}
              </button>

              <span
                className={
                  'font-mono text-[13px] ' +
                  (implantComplete(implantCatalog, value.implant)
                    ? 'text-gray-800'
                    : 'text-red-600')
                }
              >
                {formatSelection(implantCatalog, value.implant) ||
                  '제조사와 타입을 골라 주세요'}
              </span>
            </div>

            {implantOpen && (
              <div className="mt-3">
                <ImplantPicker
                  catalog={implantCatalog}
                  favorites={implantFavorites}
                  value={value.implant}
                  onChange={(implant) => onChange({ ...value, implant })}
                />
              </div>
            )}
          </div>
        </Row>
      )}

      <Row label="폰틱">
        <button
          onClick={() => onChange({ ...value, isPontic: !value.isPontic })}
          disabled={!canPontic}
          className={
            !canPontic
              ? 'cursor-not-allowed rounded border border-gray-200 bg-gray-100 px-3 py-1.5 text-[13px] text-gray-400'
              : value.isPontic
                ? 'rounded border border-amber-600 bg-amber-50 px-3 py-1.5 text-[13px] font-semibold text-amber-700'
                : 'rounded border border-gray-300 px-3 py-1.5 text-[13px]'
          }
        >
          {value.isPontic ? 'ON - 누르는 치아가 폰틱이 됩니다' : 'OFF'}
        </button>
      </Row>
    </div>
  );
}
