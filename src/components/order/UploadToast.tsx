// =========================================================
// 놓을 위치: src/components/order/UploadToast.tsx
//
// 파일을 올리는 동안의 화면. 두 가지를 합니다.
//
//   ① 올리는 중  — 화면을 덮고 **못 건드리게 막습니다**
//   ② 끝난 뒤    — 오른쪽 위에 결과만 남깁니다
//
// ★ 왜 경고가 아니라 막는가.
//   (2/3) 처럼 파일이 덜 올라가는 일은 대개 사람이 중간에 나가서 생깁니다 —
//   뒤로가기, 새로고침, 다른 메뉴 클릭. 글자로 "닫지 마세요" 를 적어 두면
//   급한 사람은 안 읽습니다. 누를 수 없게 하는 편이 확실합니다.
//
//   막는 것 세 가지 —
//     화면 클릭   덮개가 가로챕니다
//     뒤로가기    popstate 를 되돌립니다
//     새로고침·닫기 beforeunload 가 브라우저 창으로 묻습니다
//
// ★ 다 되면 저절로 사라지지만, 실패는 남습니다.
//   "몇 개 중 몇 개가 올라갔다" 를 눈으로 확인하는 것이 목적입니다.
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
  const uploading = state?.phase === 'uploading';

  // ---------- 올리는 동안 나가지 못하게 ----------
  useEffect(() => {
    if (!uploading) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    /**
     * 뒤로가기 막기.
     *
     * ★ 브라우저는 뒤로가기를 취소할 방법을 주지 않습니다.
     *   대신 덫 하나를 미리 쌓아 두고, 뒤로 가면 다시 쌓아 제자리에 둡니다.
     *   화면은 그대로 있고 덮개도 그대로라, 사람은 "안 눌리네" 로 느낍니다.
     */
    function onPopState() {
      history.pushState(null, '', window.location.href);
    }

    history.pushState(null, '', window.location.href);

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [uploading]);

  // 잘 끝났으면 잠깐 보여 주고 물러납니다. 실패는 남깁니다
  useEffect(() => {
    if (state?.phase !== 'done') return;

    const timer = setTimeout(onClose, 2600);
    return () => clearTimeout(timer);
  }, [state, onClose]);

  if (!state) return null;

  // ---------- ① 올리는 중 — 화면을 덮습니다 ----------
  if (state.phase === 'uploading') {
    return (
      <div
        role="alertdialog"
        aria-live="assertive"
        aria-label="파일 올리는 중"
        className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-6"
        // 덮개 위의 클릭·키를 여기서 먹습니다
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.preventDefault()}
      >
        <div className="w-full max-w-[400px] rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-center gap-2.5">
            <Spinner />
            <b className="text-[14px] font-bold text-[#1A2130]">
              파일 올리는 중 {state.progress.done} / {state.progress.total}
            </b>
            <b className="ml-auto text-[16px] font-extrabold tabular-nums text-[#1279E8]">
              {state.progress.overallPercent}%
            </b>
          </div>

          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#EDF0F4]">
            <div
              className="h-full rounded-full bg-[#1279E8] transition-[width] duration-200"
              style={{ width: `${state.progress.overallPercent}%` }}
            />
          </div>

          {/*
            ★ 한 번에 셋까지 올라갑니다 (작업지시서 §3-2).
              그래서 '지금 이 파일' 한 줄로는 못 그립니다 — 올라가는
              것을 다 보여 줍니다. 250MB 짜리가 20% 에 멈춰 있는지
              도는지를 사람이 봐야 창을 안 닫습니다.
          */}
          <ul className="mt-3 space-y-2">
            {state.progress.active.map((file) => (
              <li key={file.fileName}>
                <div className="flex items-baseline gap-2">
                  <span
                    className="min-w-0 flex-1 truncate text-[12.5px] text-[#4A5567]"
                    title={file.fileName}
                  >
                    {file.fileName}
                  </span>

                  {file.attempt > 1 && (
                    <span className="shrink-0 text-[11.5px] font-semibold text-[#C2721B]">
                      이어서 {file.attempt}번째
                    </span>
                  )}

                  <b className="shrink-0 text-[12px] font-bold tabular-nums text-[#98A2B3]">
                    {file.percent}%
                  </b>
                </div>

                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#F0F2F5]">
                  <div
                    className="h-full rounded-full bg-[#8FB6F5] transition-[width] duration-200"
                    style={{ width: `${file.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {state.progress.failed > 0 && (
            <p className="mt-2.5 text-[12.5px] font-semibold text-[#B3312C]">
              {state.progress.failed}개는 실패했습니다 — 올린 뒤 다시 시도할 수 있습니다
            </p>
          )}

          {/* ★ 여기가 이 창의 본론입니다 */}
          <p className="mt-4 rounded-md border border-[#F5D9A8] bg-[#FEF7EA] px-3 py-2.5 text-[13.5px] font-semibold leading-relaxed text-[#8A5A12]">
            창을 닫거나 뒤로 가지 마세요.
            <span className="mt-0.5 block font-normal text-[#A07636]">
              중간에 나가면 파일이 덜 올라가고, 디자인센터가 작업을 시작할 수 없습니다.
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ---------- ② 끝난 뒤 — 오른쪽 위 ----------
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-16 z-[60] w-[320px] rounded-lg border border-[#E8EBF0] bg-white p-4 shadow-lg"
    >
      {state.phase === 'done' ? (
        <Line tone="ok" onClose={onClose} title={`파일 ${state.total}개를 모두 올렸습니다`}>
          <span className="text-[13px] text-[#98A2B3]">
            디자인센터에서 바로 열어 볼 수 있습니다.
          </span>
        </Line>
      ) : (
        <Line
          tone="bad"
          onClose={onClose}
          title={`${state.total - state.failed.length} / ${state.total} 만 올라갔습니다`}
        >
          <span className="block text-[13px] text-[#B3312C]">
            못 올린 파일: {state.failed.join(', ')}
          </span>
          <span className="mt-1 block text-[13px] text-[#98A2B3]">
            주문은 등록됐습니다. 다시 시도를 눌러 주세요.
          </span>
        </Line>
      )}
    </div>
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
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white ' +
            (tone === 'ok' ? 'bg-[#12855B]' : 'bg-[#D8453F]')
          }
        >
          {tone === 'ok' ? '✓' : '!'}
        </span>

        <b className="text-[14px] font-bold leading-snug text-[#1A2130]">{title}</b>

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
      width="17"
      height="17"
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
