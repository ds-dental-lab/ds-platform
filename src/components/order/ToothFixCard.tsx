// =========================================================
// 놓을 위치: src/components/order/ToothFixCard.tsx
//
// 스캔과 주문서의 치식이 다를 때 치과가 고르는 칸 (사용자 2026-10-30).
//   "치식이 오류인 경우 UI 적으로 치과가 치식을 바꾸기 쉽게 도와줄 수 있는 루트는 없어?"
//
// ★ 숫자 상자가 아니라 **주문 화면과 같은 치아 모양**으로 그립니다. 옆 치아로 잘못 찍은 것이
//   한눈에 보입니다. 사이가 멀면 그만큼 길게, 위아래가 다르면 두 줄로 그립니다.
// ★ 답을 미리 정하지 않습니다 — 단추 둘은 같은 크기·같은 색입니다. 스캔을 잘못 읽었을 수 있습니다.
// ★ 번호를 다시 글로 쓰지 않습니다 — 바로 위 문장이 이미 말합니다. 책갈피와 주문 상세가 같이 씁니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { submitDismissAutoJob, submitToothFix } from '@/server/actions/auto-print';
import { getAllTeeth, getArch, getToothType } from '@/server/domain/tooth';
import { getShape } from '@/components/dental/ToothChart/toothShapes';

const ORDER_COLOR = { line: '#12A08A', fill: '#E6F6F3', ink: '#0B7A68' };
const SCAN_COLOR = { line: '#1279E8', fill: '#EAF3FE', ink: '#0F5FB8' };
/** 한 줄이 이 폭을 넘으면 그만큼 줄입니다 — 책갈피 카드 안쪽 폭 */
const ROW_WIDTH = 240;
const MAX_SCALE = 0.8;

/** 두 치아를 함께 보여 줄 줄들. 양옆에 한 개씩 더 그려 어디쯤인지 보이게 합니다 */
export function toothFixRows(a: number, b: number): number[][] {
  const { upper, lower } = getAllTeeth();
  const rows: number[][] = [];
  for (const arch of [upper, lower]) {
    const hit = [a, b].filter((t) => arch.includes(t)).map((t) => arch.indexOf(t));
    if (hit.length === 0) continue;
    const from = Math.max(0, Math.min(...hit) - 1);
    const to = Math.min(arch.length - 1, Math.max(...hit) + 1);
    rows.push(arch.slice(from, to + 1));
  }
  return rows;
}

function ToothRow({ teeth, from, to }: { teeth: number[]; from: number; to: number }) {
  const shapes = teeth.map((t) => getShape(getToothType(t), getArch(t)));
  const total = shapes.reduce((sum, s) => sum + s.width + 3, 0);
  const scale = Math.min(MAX_SCALE, ROW_WIDTH / total);

  return (
    <div className="flex items-center justify-center gap-[3px]">
      {teeth.map((t, i) => {
        const shape = shapes[i];
        const color = t === from ? ORDER_COLOR : t === to ? SCAN_COLOR : null;
        return (
          <span
            key={t}
            className="relative grid place-items-center"
            style={{ width: shape.width * scale, height: shape.height * scale }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <path
                d={shape.path}
                vectorEffect="non-scaling-stroke"
                fill={color ? color.fill : '#FFFFFF'}
                stroke={color ? color.line : '#D5DAE2'}
                strokeWidth={color ? 2 : 1.2}
              />
            </svg>
            <span
              className={'relative tabular-nums ' + (color ? 'font-extrabold' : 'font-medium')}
              // ★ 사이가 멀어 치아가 작아지면 글자도 같이 줄입니다 — 윤곽선을 넘던 것
              style={{
                color: color ? color.ink : '#A3ACB9',
                fontSize: Math.max(8, (color ? 15 : 12) * scale),
              }}
            >
              {t}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#5B6675]">
      <i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export default function ToothFixCard({
  orderId,
  fix,
  onChanged,
}: {
  orderId: string;
  fix: { from: number; to: number };
  onChanged: () => void | Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const got = await action(orderId);
      if (got.ok) await onChanged();
      else setError(got.error);
    });
  };

  const button =
    'rounded-lg border border-[#C9D1DC] bg-white py-2 text-[13px] font-bold text-[#1A2130] ' +
    'hover:border-[#1279E8] hover:text-[#0F5FB8] disabled:opacity-50';

  return (
    <div>
      <div className="space-y-1.5">
        {toothFixRows(fix.from, fix.to).map((teeth) => (
          <ToothRow key={teeth[0]} teeth={teeth} from={fix.from} to={fix.to} />
        ))}
      </div>

      <div className="mt-2 flex justify-center gap-3">
        <Legend color={ORDER_COLOR.line} label="주문서" />
        <Legend color={SCAN_COLOR.line} label="스캔" />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => run(submitToothFix)} disabled={pending} className={button}>
          {fix.to}번으로 진행
        </button>
        <button type="button" onClick={() => run(submitDismissAutoJob)} disabled={pending} className={button}>
          {fix.from}번 유지
        </button>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-[#7C8595]">
        {fix.from}번 유지를 고르면 이번 임시치아는 만들지 않습니다.
      </p>

      {error ? <p className="mt-1.5 text-[11.5px] text-[#D64545]">{error}</p> : null}
    </div>
  );
}
