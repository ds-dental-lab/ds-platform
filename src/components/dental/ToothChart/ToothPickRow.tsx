// =========================================================
// 놓을 위치: src/components/dental/ToothChart/ToothPickRow.tsx
//
// 고를 수 있는 치아만 켜지는 치식도. (리메이크 요청 화면 ①)
//
// ★ 주문등록의 ToothChart 를 쓰지 않습니다.
//   그쪽은 브릿지 이음새 · 폰틱 우클릭 · 치은포셀린 휠클릭까지 얹혀 있어,
//   "고를 수 있는 치아가 정해져 있다" 는 이 화면의 규칙과 섞이면
//   둘 다 읽기 어려워집니다. 여기서는 고르고 끄는 일만 합니다.
//
// 원주문에 없는 치아는 회색으로 눌리지 않습니다 — 리메이크는 만들었던 것을
// 다시 만드는 일이라, 없던 치아를 새로 넣는 자리가 아닙니다.
// =========================================================

'use client';

import { getAllTeeth, getArch, getToothType } from '@/server/domain/tooth';
import { getShape } from './toothShapes';

export interface ToothPickRowProps {
  /** 고를 수 있는 치아 — 원주문에 들어 있던 것들 */
  available: number[];
  selected: number[];
  onToggle: (tooth: number) => void;
}

export default function ToothPickRow({
  available,
  selected,
  onToggle,
}: ToothPickRowProps) {
  const { upper, lower } = getAllTeeth();

  return (
    <div className="w-full overflow-x-auto rounded-lg bg-[#F4F6F9] px-3 py-4">
      <div className="min-w-[760px] space-y-3">
        {[upper, lower].map((row, i) => (
          <div key={i} className="flex items-center justify-center gap-[3px]">
            {row.map((tooth) => (
              <PickTooth
                key={tooth}
                tooth={tooth}
                enabled={available.includes(tooth)}
                on={selected.includes(tooth)}
                onClick={() => onToggle(tooth)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PickTooth({
  tooth,
  enabled,
  on,
  onClick,
}: {
  tooth: number;
  enabled: boolean;
  on: boolean;
  onClick: () => void;
}) {
  const arch = getArch(tooth);
  const shape = getShape(getToothType(tooth), arch);

  // 고른 치아는 분홍, 고를 수 있는 치아는 흰 바탕, 나머지는 흐리게
  const stroke = on ? '#E0409A' : enabled ? '#98A2B3' : '#DDE2EA';
  const fill = on ? '#FCEAF3' : '#FFFFFF';

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      aria-label={`${tooth}번${enabled ? '' : ' (이 주문에 없습니다)'}`}
      aria-pressed={on}
      title={enabled ? undefined : '이 주문에 없는 치아입니다'}
      className={
        'relative grid shrink-0 place-items-center border-none bg-transparent p-0 transition-transform ' +
        (enabled ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-not-allowed opacity-45')
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
          fill={fill}
          stroke={stroke}
          strokeWidth={on ? 2 : 1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <span
        className="pointer-events-none absolute text-[13px] font-semibold tabular-nums"
        style={{
          color: on ? '#C43A7E' : enabled ? '#4A5567' : '#B6BECC',
          textShadow: '0 0 3px #fff, 0 0 3px #fff',
        }}
      >
        {tooth}
      </span>
    </button>
  );
}
