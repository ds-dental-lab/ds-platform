// =========================================================
// 놓을 위치: src/components/layout/SwitchPill.tsx
//
// 종 안의 켬/끔 스위치 — PC 알림·소리가 같이 씁니다.
// (사용자 지적 2026-09-06 — "켠 상태인지 아닌지 헷갈려. 더 직관적으로")
//
// ★★ 전에는 글자였습니다: 'PC 알림 끔'. 그런데 그 글자는 두 가지로
//   읽힙니다 — "지금 꺼져 있다" 인지, "누르면 끈다" 인지. 사장님도
//   헷갈리셨습니다. 상태와 동작이 한 단어에 겹쳐 있으면 늘 그렇습니다.
//
// ★ 그래서 **스위치 모양**으로 그립니다. 오른쪽에 초록으로 붙은 손잡이는
//   누구나 '켜짐' 으로 읽습니다 — 폰 설정 화면에서 매일 보는 모양이라
//   설명이 필요 없습니다. 글자는 상태만 적습니다: 켜짐 / 꺼짐.
//
// ★ 색은 상태에만 씁니다. 켜짐 = 초록(#12855B), 꺼짐 = 회색. 파랑은
//   이 화면에서 '눌러 볼 것' 이라 스위치에 쓰면 링크로 읽힙니다.
// =========================================================

'use client';

export interface SwitchPillProps {
  /** 'PC 알림' · '소리' */
  label: string;
  on: boolean;
  onToggle: () => void;
  /** 누르는 중 — 손잡이를 반쯤 흐리게 */
  busy?: boolean;
  /** 못 누르는 상태(브라우저가 차단). 이유를 title 로 */
  disabled?: boolean;
  title?: string;
}

export default function SwitchPill({
  label,
  on,
  onToggle,
  busy = false,
  disabled = false,
  title,
}: SwitchPillProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label} ${on ? '켜짐' : '꺼짐'}`}
      onClick={onToggle}
      disabled={disabled || busy}
      title={title}
      className="group inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-[12.5px] font-semibold text-[#4A5567]">{label}</span>

      {/* 트랙 + 손잡이 */}
      <span
        aria-hidden="true"
        className={
          'relative inline-block h-[18px] w-[32px] shrink-0 rounded-full transition-colors ' +
          (on ? 'bg-[#12855B]' : 'bg-[#C4CBD6]')
        }
      >
        <span
          className={
            'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-[left] ' +
            (on ? 'left-[16px]' : 'left-[2px]') +
            (busy ? ' opacity-60' : '')
          }
        />
      </span>

      <span
        className={
          'w-[26px] text-left text-[12px] font-bold ' + (on ? 'text-[#12855B]' : 'text-[#98A2B3]')
        }
      >
        {busy ? '…' : on ? '켜짐' : '꺼짐'}
      </span>
    </button>
  );
}
