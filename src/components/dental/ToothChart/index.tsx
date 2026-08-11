// =========================================================
// 놓을 위치: src/components/dental/ToothChart/index.tsx
//
// 치식도. (기능명세서 §4.2.5 §4.2.6, 시안 .arch)
//   상악 18~28 / 하악 48~38
//
// 조작 (시안 arch-hint)
//   왼쪽 클릭 — 지금 고른 보철을 그 치아에 찍습니다
//   우클릭   — 그 치아를 폰틱으로 지정 · 해제
//   휠클릭   — 치은포셀린 추가 · 해제 (인레이에는 붙지 않습니다)
//
// 연결된 치아는 하나의 상자로 묶이고, 이음매의 − 버튼으로 끊습니다.
// 끊어 둔 자리에는 + 가 남아 다시 붙일 수 있습니다.
// =========================================================

'use client';

import { getAllTeeth, getToothType, getArch } from '@/server/domain/tooth';
import { computeBridges, canSever, linkKey, type ToothPlacement } from '@/server/domain/bridge';
import {
  colorOfType,
  FALLBACK_TYPES,
  type ProsthesisCatalog,
} from '@/server/domain/prosthesis';
import { getShape } from './toothShapes';

/** 치식도가 다루는 한 치아. 중복 등록된 치아는 두 줄이 됩니다 */
export interface ChartPlacement extends ToothPlacement {
  /** 치은포셀린이 붙었는가 */
  hasGingival?: boolean;
}

export interface ToothChartProps {
  placements?: ChartPlacement[];
  /** 사용자가 − 로 끊어 둔 연결 지점 */
  severedKeys?: string[];
  onToothClick?: (tooth: number) => void;
  /** 우클릭 — 폰틱 토글 */
  onTogglePontic?: (tooth: number) => void;
  /** 휠클릭 — 치은포셀린 토글 */
  onToggleGingival?: (tooth: number) => void;
  onSeverLink?: (key: string) => void;
  readOnly?: boolean;
  /**
   * 제품 목록. 종류의 색을 여기서 읽습니다.
   *
   * ★ 안 주면 최소 목록으로 봅니다. 새로 만든 종류는 회색으로 나오지만
   *   화면이 깨지지는 않습니다.
   */
  catalog?: ProsthesisCatalog;
}

export default function ToothChart({
  placements = [],
  severedKeys = [],
  onToothClick,
  onTogglePontic,
  onToggleGingival,
  onSeverLink,
  readOnly = false,
  catalog = FALLBACK_TYPES,
}: ToothChartProps) {
  const { upper, lower } = getAllTeeth();
  const bridges = computeBridges(placements, severedKeys);

  return (
    <div className="w-full overflow-x-auto px-2.5 pb-4 pt-1.5">
      <div className="min-w-[860px]">
        <ArchRow
          teeth={upper}
          placements={placements}
          bridges={bridges}
          severedKeys={severedKeys}
          onToothClick={onToothClick}
          onTogglePontic={onTogglePontic}
          onToggleGingival={onToggleGingival}
          onSeverLink={onSeverLink}
          readOnly={readOnly}
          catalog={catalog}
        />

        <div className="h-7" />

        <ArchRow
          teeth={lower}
          placements={placements}
          bridges={bridges}
          severedKeys={severedKeys}
          onToothClick={onToothClick}
          onTogglePontic={onTogglePontic}
          onToggleGingival={onToggleGingival}
          onSeverLink={onSeverLink}
          readOnly={readOnly}
          catalog={catalog}
          lower
        />
      </div>
    </div>
  );
}

// ---------- 한 줄 (상악 또는 하악) ----------

interface RowProps {
  teeth: number[];
  placements: ChartPlacement[];
  bridges: ReturnType<typeof computeBridges>;
  severedKeys: string[];
  onToothClick?: (tooth: number) => void;
  onTogglePontic?: (tooth: number) => void;
  onToggleGingival?: (tooth: number) => void;
  onSeverLink?: (key: string) => void;
  readOnly: boolean;
  lower?: boolean;
  catalog: ProsthesisCatalog;
}

function ArchRow({
  teeth,
  placements,
  bridges,
  severedKeys,
  onToothClick,
  onTogglePontic,
  onToggleGingival,
  onSeverLink,
  readOnly,
  lower = false,
  catalog,
}: RowProps) {
  /**
   * 이 줄을 [묶음 | 낱개] 덩어리로 나눕니다.
   * 묶음은 한 상자 안에 들어가고, 그 사이에는 이음매가 생깁니다.
   */
  const chunks: { teeth: number[]; bridge: (typeof bridges)[number] | null }[] = [];
  let index = 0;

  while (index < teeth.length) {
    const tooth = teeth[index];
    const bridge = bridges.find((b) => b.teeth.includes(tooth) && b.teeth.every((t) => teeth.includes(t)));

    if (bridge) {
      // 묶음은 통째로 담고 그만큼 건너뜁니다
      const run = teeth.slice(index, index + bridge.teeth.length);
      chunks.push({ teeth: run, bridge });
      index += bridge.teeth.length;
    } else {
      chunks.push({ teeth: [tooth], bridge: null });
      index += 1;
    }
  }

  return (
    <div className={'flex flex-nowrap items-center justify-center ' + (lower ? 'items-start' : '')}>
      {chunks.map((chunk, ci) => {
        const prev = chunks[ci - 1];

        // 덩어리 사이의 틈 — 끊어 둔 자리면 + 로 되붙일 수 있습니다
        const gapKey =
          prev && prev.teeth.length && chunk.teeth.length
            ? linkKey(prev.teeth[prev.teeth.length - 1], chunk.teeth[0])
            : null;

        const rejoinable = gapKey !== null && severedKeys.includes(gapKey);

        return (
          <div key={chunk.teeth[0]} className="flex items-center">
            {ci > 0 && (
              <span className="relative grid h-[22px] w-[13px] shrink-0 place-items-center self-center">
                {rejoinable && !readOnly && (
                  <button
                    type="button"
                    onClick={() => onSeverLink?.(gapKey!)}
                    aria-label={`${prev!.teeth[prev!.teeth.length - 1]}번과 ${chunk.teeth[0]}번 다시 연결`}
                    title="다시 연결"
                    className="grid h-[17px] w-[17px] place-items-center rounded-full border-[1.6px] border-[#1B63E8] bg-white p-0 text-[12px] font-extrabold leading-none text-[#1B63E8] opacity-40 transition hover:scale-110 hover:opacity-100"
                  >
                    +
                  </button>
                )}
              </span>
            )}

            {chunk.bridge ? (
              <BridgeBox
                bridge={chunk.bridge}
                placements={placements}
                onToothClick={onToothClick}
                onTogglePontic={onTogglePontic}
                onToggleGingival={onToggleGingival}
                onSeverLink={onSeverLink}
                readOnly={readOnly}
                lower={lower}
                catalog={catalog}
              />
            ) : (
              <Tooth
                tooth={chunk.teeth[0]}
                placements={placements.filter((p) => p.tooth === chunk.teeth[0])}
                onClick={onToothClick}
                onTogglePontic={onTogglePontic}
                onToggleGingival={onToggleGingival}
                readOnly={readOnly}
                catalog={catalog}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- 연결된 묶음 ----------

function BridgeBox({
  bridge,
  placements,
  onToothClick,
  onTogglePontic,
  onToggleGingival,
  onSeverLink,
  readOnly,
  lower,
  catalog,
}: {
  bridge: ReturnType<typeof computeBridges>[number];
  placements: ChartPlacement[];
  onToothClick?: (tooth: number) => void;
  onTogglePontic?: (tooth: number) => void;
  onToggleGingival?: (tooth: number) => void;
  onSeverLink?: (key: string) => void;
  readOnly: boolean;
  lower: boolean;
  catalog: ProsthesisCatalog;
}) {
  const color = colorOfType(catalog, bridge.typeCode);

  return (
    <div
      className="relative flex items-center rounded-xl border-2 px-2.5 py-2"
      style={{
        borderColor: color.line,
        background: color.soft,
        boxShadow: '0 1px 3px rgba(26,33,48,.07)',
      }}
    >
      {bridge.teeth.map((tooth, i) => {
        const prev = bridge.teeth[i - 1];
        const key = prev !== undefined ? linkKey(prev, tooth) : null;
        const severable = key !== null && canSever(bridge, key);

        return (
          <div key={tooth} className="flex items-center">
            {i > 0 && (
              <span className="relative w-1 shrink-0 self-stretch">
                {severable && !readOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeverLink?.(key!);
                    }}
                    aria-label={`${prev}번과 ${tooth}번 연결 끊기`}
                    title="연결 끊기"
                    className={
                      'absolute left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full border-2 border-white bg-[#5C6779] p-0 text-[13px] font-extrabold leading-none text-white shadow transition hover:scale-110 hover:bg-[#C4383A] ' +
                      (lower ? '-bottom-[19px]' : '-top-[19px]')
                    }
                  >
                    −
                  </button>
                )}
              </span>
            )}

            <Tooth
              tooth={tooth}
              placements={placements.filter((p) => p.tooth === tooth)}
              onClick={onToothClick}
              onTogglePontic={onTogglePontic}
              onToggleGingival={onToggleGingival}
              readOnly={readOnly}
              catalog={catalog}
            />
          </div>
        );
      })}

      <span
        className={
          'absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-[7px] py-px text-[9.5px] font-extrabold tracking-[-0.02em] text-white ' +
          (lower ? '-top-[9px]' : '-bottom-[9px]')
        }
        style={{ background: color.line }}
      >
        연결
      </span>
    </div>
  );
}

// ---------- 치아 하나 ----------

function Tooth({
  tooth,
  placements,
  onClick,
  onTogglePontic,
  onToggleGingival,
  readOnly,
  catalog,
}: {
  tooth: number;
  placements: ChartPlacement[];
  onClick?: (tooth: number) => void;
  onTogglePontic?: (tooth: number) => void;
  onToggleGingival?: (tooth: number) => void;
  readOnly: boolean;
  catalog: ProsthesisCatalog;
}) {
  const arch = getArch(tooth);
  const shape = getShape(getToothType(tooth), arch);

  const primary = placements[0];
  const color = primary ? colorOfType(catalog, primary.typeCode) : null;
  const isPontic = placements.some((p) => p.isPontic);
  const isDuplicate = placements.length >= 2;
  const hasGingival = placements.some((p) => p.hasGingival);

  const label = [
    `${tooth}번`,
    primary ? '선택됨' : '',
    isPontic ? '폰틱' : '',
    hasGingival ? '치은포셀린' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => onClick?.(tooth)}
      // 우클릭 = 폰틱
      onContextMenu={(e) => {
        if (readOnly) return;
        e.preventDefault();
        onTogglePontic?.(tooth);
      }}
      // 휠(가운데) 클릭 = 치은포셀린
      // ★ 우클릭은 contextmenu 에서만 받습니다. 두 곳에서 받으면 두 번 토글돼 서로 취소됩니다.
      onAuxClick={(e) => {
        if (readOnly || e.button !== 1) return;
        e.preventDefault();
        onToggleGingival?.(tooth);
      }}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault(); // 가운데 클릭의 자동 스크롤을 막습니다
      }}
      aria-label={label}
      className={
        'relative grid shrink-0 place-items-center border-none bg-transparent p-0 transition-transform ' +
        (readOnly ? '' : 'hover:-translate-y-0.5')
      }
    >
      <svg
        width={shape.width}
        height={shape.height}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="block overflow-visible"
        style={arch === 'upper' ? { transform: 'scaleY(-1)' } : undefined}
        aria-hidden="true"
      >
        <path
          d={shape.path}
          fill={color ? color.soft : '#fff'}
          stroke={color ? color.line : '#7C8595'}
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* 폰틱은 번호 대신 X (명세서 §4.2.5) */}
      <span
        className={
          'pointer-events-none absolute tabular-nums tracking-[-0.02em] ' +
          (isPontic ? 'text-[14px] font-extrabold tracking-normal' : 'text-[12px] font-semibold')
        }
        style={{
          color: color ? color.line : '#1E3A6E',
          textShadow: '0 0 3px #fff, 0 0 3px #fff',
        }}
      >
        {isPontic ? 'X' : tooth}
      </span>

      {/* 중복 등록 2 배지 (명세서 §4.2.7) */}
      {isDuplicate && (
        <span
          className="pointer-events-none absolute -right-1 -top-1 grid h-[15px] w-[15px] place-items-center rounded-full text-[9px] font-extrabold text-white"
          style={{ background: color?.line ?? '#5C6779' }}
        >
          2
        </span>
      )}

      {/* 치은포셀린 표시 */}
      {hasGingival && (
        <span
          className="pointer-events-none absolute -bottom-1 left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full border border-white bg-[#E0409A]"
          title="치은포셀린"
        />
      )}
    </button>
  );
}


