// =========================================================
// 놓을 위치: src/components/order/UploadToast.tsx
//
// 파일 올리는 동안 오른쪽 위에 붙어 있는 알림.
//
// ★ 왜 필요한가.
//   스캔 데이터는 한 개가 수백 MB 입니다. 아무 표시가 없으면
//   되고 있는 건지 멈춘 건지 알 수 없어 창을 닫아 버립니다.
//   닫으면 주문은 남고 파일만 없는 상태가 됩니다.
//
// ★ 다 되면 저절로 사라지지 않습니다.
//   "몇 개 중 몇 개가 올라갔다" 를 눈으로 확인하는 것이 이 알림의 목적입니다.
//   실패가 있으면 빨갛게 남아 있고, 사람이 닫아야 없어집니다.
// =========================================================

'use client';

import { useEffect } from 'react';
import type { UploadProgress } from '@/lib/upload';

export type UploadState =
  | { phase: 'uploading'; progress: UploadProgress }
  | { phase: 'done'; total: number }
  | { phase: 'failed'; total: number; failed: string[] };

export interface UploadToastProps {
  state: UploadState | null;
  onClose: () => void;
}

export default function UploadToast({ state, onClose }: UploadToastProps) {
  // 다 잘 끝났으면 잠깐 보여 주고 물러납니다. 실패는 남깁니다
  useEffect(() => {
    if (state?.phase !== 'done') return;

    const timer = setTimeout(onClose, 2600);
    return () => clearTimeout(timer);
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-16 z-[60] w-[320px] rounded-lg border border-[#E8EBF0] bg-white p-4 shadow-lg"
    >
      {state.phase === 'uploading' && <Uploading progress={state.progress} />}

      {state.phase === 'done' && (
        <Line tone="ok" onClose={onClose} title={`파일 ${state.total}개를 모두 올렸습니다`}>
          <span className="text-[12px] text-[#98A2B3]">
            디자인센터에서 바로 열어 볼 수 있습니다.
          </span>
        </Line>
      )}

      {state.phase === 'failed' && (
        <Line
          tone="bad"
          onClose={onClose}
          title={`${state.total - state.failed.length} / ${state.total} 만 올라갔습니다`}
        >
          <span className="block text-[12px] text-[#B3312C]">
            못 올린 파일: {state.failed.join(', ')}
          </span>
          <span className="mt-1 block text-[12px] text-[#98A2B3]">
            주문은 등록됐습니다. 다시 시도를 눌러 주세요.
          </span>
        </Line>
      )}
    </div>
  );
}

function Uploading({ progress }: { progress: UploadProgress }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Spinner />
        <b className="text-[13px] font-bold text-[#1A2130]">
          파일 올리는 중 {progress.index} / {progress.total}
        </b>
        <b className="ml-auto text-[13px] font-bold tabular-nums text-[#1279E8]">
          {progress.overallPercent}%
        </b>
      </div>

      <p className="mt-1.5 truncate text-[12px] text-[#4A5567]" title={progress.fileName}>
        {progress.fileName}
      </p>

      {/* 전체 바이트 기준입니다 — 큰 파일 하나가 끝나야 크게 움직입니다 */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EDF0F4]">
        <div
          className="h-full rounded-full bg-[#1279E8] transition-[width] duration-200"
          style={{ width: `${progress.overallPercent}%` }}
        />
      </div>

      <p className="mt-1.5 text-[11.5px] text-[#98A2B3]">
        이 파일 {progress.percent}% · 창을 닫지 말아 주세요
      </p>
    </>
  );
}

function Line({
  tone,
  title,
  onClose,
  children,
}: {
  tone: 'ok' | 'bad';
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span
          className={
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white ' +
            (tone === 'ok' ? 'bg-[#12855B]' : 'bg-[#D8453F]')
          }
        >
          {tone === 'ok' ? '✓' : '!'}
        </span>

        <b className="text-[13px] font-bold leading-snug text-[#1A2130]">{title}</b>

        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto -mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded text-[#98A2B3] hover:bg-[#F4F6F9]"
        >
          ✕
        </button>
      </div>

      <div className="mt-1 pl-7">{children}</div>
    </>
  );
}

function Spinner() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 animate-spin text-[#1279E8]"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.4" stroke="#DDE6F5" strokeWidth={2} />
      <path d="M14.4 8A6.4 6.4 0 0 0 8 1.6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
