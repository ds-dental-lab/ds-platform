// =========================================================
// 놓을 위치: src/components/order/OrderProgress.tsx
//
// 주문상세 머리줄 아래의 진행 막대. (사용자 요청 2026-08-13)
//
// ★ 세 섹터가 같은 것을 봅니다.
//   치과도 지금 어디쯤인지 알아야 합니다. 물건을 내주고 나면 상태가
//   '제작대기' 에 한참 머물러 있는데, 그것만 보면 아무 일도 안
//   일어나는 것처럼 보입니다.
//
// ★ 무엇을 그릴지는 domain/progress 가 정합니다.
//   여기서는 받은 칸을 늘어놓기만 합니다.
//
// ★ 좁아지면 가로로 스크롤합니다.
//   칸이 여덟 개까지 늘어날 수 있습니다(아날로그). 눌러 담으면
//   글자가 겹치므로 자기 스크롤을 줍니다 — 이 프로젝트의 규칙입니다.
// =========================================================

import type { ProgressStep } from '@/server/domain/progress';

const COLOR = {
  done: { dot: '#12855B', text: '#4A5567', line: '#12855B' },
  current: { dot: '#1279E8', text: '#1279E8', line: '#DDE2EA' },
  todo: { dot: '#DDE2EA', text: '#98A2B3', line: '#DDE2EA' },
} as const;

export default function OrderProgress({ steps }: { steps: ProgressStep[] }) {
  if (steps.length <= 1) return null;

  return (
    <ol
      aria-label="진행 상황"
      className="flex min-w-max items-start gap-0 px-0.5 py-0.5"
    >
      {steps.map((step, i) => {
        const color = COLOR[step.state];
        const last = i === steps.length - 1;

        return (
          <li key={step.key} className="flex items-start">
            <div className="flex w-[64px] flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className={
                  'grid h-[18px] w-[18px] place-items-center rounded-full ' +
                  (step.state === 'current' ? 'ring-4 ring-[#1279E8]/15' : '')
                }
                style={{ background: color.dot }}
              >
                {step.state === 'done' && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6.4 4.8 9 10 3.2" />
                  </svg>
                )}
              </span>

              <span
                className={
                  'whitespace-nowrap text-[12.5px] ' +
                  (step.state === 'current' ? 'font-bold' : 'font-semibold')
                }
                style={{ color: color.text }}
              >
                {step.label}
              </span>
            </div>

            {/*
              ★ 선은 **앞 칸의 상태**를 따릅니다.
                끝난 칸에서 나가는 선이 초록이면 "여기까지 왔다" 가
                한눈에 읽힙니다. 다음 칸 색을 쓰면 선이 늘 회색입니다.
            */}
            {!last && (
              <span
                aria-hidden="true"
                className="mt-[8px] h-[2px] w-[26px] shrink-0 rounded-full"
                style={{ background: color.line }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 막대 아래 한 줄. (치과에만 답니다)
 *
 * ★ 막대 **바깥**에 둡니다. 막대는 좁아지면 가로로 스크롤하는데,
 *   안에 넣으면 이 글도 같이 밀려 나가 안 보입니다.
 *
 * ★ 칸 이름은 우리 말이라 고객에게 안 통합니다.
 *   '수거대기' 를 보고 치과가 무엇을 알 수 있겠습니까.
 */
export function ProgressNote({ note }: { note: string }) {
  if (!note) return null;

  return (
    <p className="mt-2.5 text-[13.5px] font-semibold text-[#1279E8]">{note}</p>
  );
}
