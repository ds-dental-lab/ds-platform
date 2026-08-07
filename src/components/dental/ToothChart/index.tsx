// =========================================================
// 놓을 위치: src/components/dental/ToothChart/index.tsx
//
// 치식도. (기능명세서 §4.2.5, §4.2.6)
//   상악 18~28 / 하악 48~38
//   치종별 외곽선 · 정중선 기준 좌우 반전 · 상악은 상하 반전
//   폰틱은 번호 대신 X · 중복 등록은 2 배지
//   브릿지 박스와 − 버튼
// =========================================================

'use client';

import { getAllTeeth, getToothType, getArch, getQuadrant } from '@/server/domain/tooth';
import {
  computeBridges,
  canSever,
  type ToothPlacement,
} from '@/server/domain/bridge';
import { getShape, MAX_TOOTH_HEIGHT } from './toothShapes';

// ---------- 보철 종류별 색 ----------

const TYPE_COLOR: Record<string, { fill: string; stroke: string; text: string }> = {
  crown:   { fill: '#DBEAFE', stroke: '#1279E8', text: '#0F4C96' },
  inlay:   { fill: '#DCFCE7', stroke: '#16A34A', text: '#14532D' },
  implant: { fill: '#FEF3C7', stroke: '#D97706', text: '#7C4A03' },
};

const EMPTY_STYLE = { fill: '#FFFFFF', stroke: '#4A5567', text: '#1A2130' };

// ---------- 배치 ----------

const GAP = 8;
const PAD_X = 12;
const TOP = 26;                                    // 브릿지 버튼 자리
const ROW_HEIGHT = TOP + MAX_TOOTH_HEIGHT + 18;

interface Slot {
  tooth: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 한 줄을 배치합니다.
 * 상악은 아래 끝을, 하악은 위 끝을 맞춰 서로 마주 보게 합니다.
 */
function layoutRow(teeth: number[]): { slots: Slot[]; totalWidth: number } {
  const slots: Slot[] = [];
  let x = PAD_X;

  for (const tooth of teeth) {
    const arch = getArch(tooth);
    const { width, height } = getShape(getToothType(tooth), arch);
    const y = arch === 'upper' ? TOP + (MAX_TOOTH_HEIGHT - height) : TOP;

    slots.push({ tooth, x, y, width, height });
    x += width + GAP;
  }

  return { slots, totalWidth: x - GAP + PAD_X };
}

// ---------- Props ----------

export interface ToothChartProps {
  /** 치식도에 올라간 보철 전부. 중복 등록된 치아는 두 줄이 됩니다 */
  placements?: ToothPlacement[];
  /** 사용자가 − 로 끊어 둔 연결 지점 */
  severedKeys?: string[];
  onToothClick?: (tooth: number) => void;
  onSeverLink?: (key: string) => void;
  readOnly?: boolean;
}

export default function ToothChart({
  placements = [],
  severedKeys = [],
  onToothClick,
  onSeverLink,
  readOnly = false,
}: ToothChartProps) {
  const { upper, lower } = getAllTeeth();
  const bridges = computeBridges(placements, severedKeys);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[860px] select-none">
        <ArchRow
          teeth={upper}
          placements={placements}
          bridges={bridges}
          onToothClick={onToothClick}
          onSeverLink={onSeverLink}
          readOnly={readOnly}
        />
        <div className="h-4" />
        <ArchRow
          teeth={lower}
          placements={placements}
          bridges={bridges}
          onToothClick={onToothClick}
          onSeverLink={onSeverLink}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

// ---------- 한 줄 (상악 또는 하악) ----------

function ArchRow({
  teeth,
  placements,
  bridges,
  onToothClick,
  onSeverLink,
  readOnly,
}: {
  teeth: number[];
  placements: ToothPlacement[];
  bridges: ReturnType<typeof computeBridges>;
  onToothClick?: (tooth: number) => void;
  onSeverLink?: (key: string) => void;
  readOnly: boolean;
}) {
  const { slots, totalWidth } = layoutRow(teeth);
  const slotOf = (tooth: number) => slots.find((s) => s.tooth === tooth);

  const rowBridges = bridges.filter((b) => b.teeth.every((t) => slotOf(t)));

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${ROW_HEIGHT}`}
      className="w-full"
      role="group"
      aria-label={getArch(teeth[0]) === 'upper' ? '상악 치식도' : '하악 치식도'}
    >
      {/* 브릿지 박스는 치아 뒤에 깔립니다 */}
      {rowBridges.map((bridge) => {
        const boxSlots = bridge.teeth.map((t) => slotOf(t)!);
        const left = Math.min(...boxSlots.map((s) => s.x)) - 5;
        const right = Math.max(...boxSlots.map((s) => s.x + s.width)) + 5;
        const color = TYPE_COLOR[bridge.typeCode] ?? EMPTY_STYLE;

        return (
          <g key={`${bridge.typeCode}-${bridge.materialCode}-${bridge.teeth[0]}`}>
            <rect
              x={left}
              y={TOP - 9}
              width={right - left}
              height={MAX_TOOTH_HEIGHT + 18}
              rx={9}
              fill="none"
              stroke={color.stroke}
              strokeWidth={1.5}
              strokeDasharray={bridge.hasPontic ? '0' : '5 3'}
            />

            {/* 연결 지점마다 − 버튼. 폰틱이 끼면 나오지 않습니다 */}
            {bridge.links.map((link) => {
              if (!canSever(bridge, link.key) || readOnly) return null;

              const a = slotOf(link.from)!;
              const b = slotOf(link.to)!;
              const cx = (a.x + a.width / 2 + b.x + b.width / 2) / 2;

              return (
                <g
                  key={link.key}
                  className="cursor-pointer"
                  onClick={() => onSeverLink?.(link.key)}
                  role="button"
                  aria-label={`${link.from}번과 ${link.to}번 연결 끊기`}
                >
                  <circle cx={cx} cy={TOP - 9} r={8.5} fill="#FFFFFF" stroke={color.stroke} strokeWidth={1.5} />
                  <line x1={cx - 4} y1={TOP - 9} x2={cx + 4} y2={TOP - 9} stroke={color.stroke} strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* 치아 */}
      {slots.map((slot) => (
        <Tooth
          key={slot.tooth}
          slot={slot}
          placements={placements.filter((p) => p.tooth === slot.tooth)}
          onClick={readOnly ? undefined : () => onToothClick?.(slot.tooth)}
        />
      ))}
    </svg>
  );
}

// ---------- 치아 하나 ----------

function Tooth({
  slot,
  placements,
  onClick,
}: {
  slot: Slot;
  placements: ToothPlacement[];
  onClick?: () => void;
}) {
  const { tooth, x, y, width, height } = slot;
  const arch = getArch(tooth);
  const shape = getShape(getToothType(tooth), arch);

  // 좌측 사분악(2·3)은 좌우로, 상악은 위아래로 뒤집습니다
  const quadrant = getQuadrant(tooth);
  const mirrored = quadrant === 2 || quadrant === 3;
  const flipped = arch === 'upper';

  // 100×100 경로를 실제 크기로 늘린 뒤 뒤집습니다.
  // 가로·세로를 따로 늘리므로 앞니가 작아지지 않습니다.
  const transform = [
    `translate(${x},${y})`,
    `scale(${width / 100},${height / 100})`,
    `translate(${mirrored ? 100 : 0},${flipped ? 100 : 0})`,
    `scale(${mirrored ? -1 : 1},${flipped ? -1 : 1})`,
  ].join(' ');

  const primary = placements[0];
  const style = primary ? TYPE_COLOR[primary.typeCode] ?? EMPTY_STYLE : EMPTY_STYLE;
  const isPontic = placements.some((p) => p.isPontic);
  const isDuplicate = placements.length >= 2;

  // 글자는 뒤집히면 안 되므로 바깥 좌표계에 그립니다
  const cx = x + width / 2;
  const cy = y + height * 0.58;

  return (
    <g
      className={onClick ? 'cursor-pointer' : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={`${tooth}번 치아${isPontic ? ' 폰틱' : ''}`}
    >
      <path
        d={shape.path}
        transform={transform}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={primary ? 2.4 : 1.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* 폰틱은 번호 대신 X (명세서 §4.2.5) */}
      {isPontic ? (
        <g stroke={style.text} strokeWidth={2.6} strokeLinecap="round" style={{ pointerEvents: 'none' }}>
          <line x1={cx - 7} y1={cy - 7} x2={cx + 7} y2={cy + 7} />
          <line x1={cx + 7} y1={cy - 7} x2={cx - 7} y2={cy + 7} />
        </g>
      ) : (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={13}
          fontWeight={600}
          fill={style.text}
          style={{ pointerEvents: 'none' }}
        >
          {tooth}
        </text>
      )}

      {/* 중복 등록 2 배지 (명세서 §4.2.7) */}
      {isDuplicate && (
        <g style={{ pointerEvents: 'none' }}>
          <circle cx={x + width - 3} cy={y + 5} r={8} fill={style.stroke} />
          <text
            x={x + width - 3}
            y={y + 9}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="#FFFFFF"
          >
            2
          </text>
        </g>
      )}
    </g>
  );
}
