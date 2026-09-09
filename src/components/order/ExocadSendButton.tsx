// =========================================================
// 놓을 위치: src/components/order/ExocadSendButton.tsx
//
// "exocad 로 보내기" 버튼. (2026-09-09, 설계서 exocad-연동-설계서.md v2)
//
// ★ 누르면 서버가 10분짜리 토큰을 만들어 `denflow://exocad/…` 주소를 주고,
//   브라우저가 그 주소를 엽니다. PC 에 런처가 등록돼 있으면 그게 뜹니다.
//   브라우저는 프로토콜 처리기가 없으면 **아무 말 없이 아무 일도 안 하므로**
//   버튼 아래에 "안 뜨면 런처 설치" 를 같이 보여 줍니다.
// ★ 창을 새로 열지 않습니다 — 보던 주문 화면이 그대로입니다.
// ★ 마지막 결과가 있으면 버튼 옆에 짧게 — 런처가 안 뜬 것을 사람이 알게.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { requestExocadLaunch } from '@/server/actions/exocad';

export interface ExocadLastResult {
  requestedAt: string;
  fetchedAt: string | null;
  status: 'done' | 'failed' | null;
  message: string | null;
}

export default function ExocadSendButton({
  orderId,
  last,
}: {
  orderId: string;
  last: ExocadLastResult | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  function send() {
    setError(null);
    start(async () => {
      const r = await requestExocadLaunch(orderId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      window.location.href = r.url;
      setLaunched(true);
    });
  }

  const summary = summarize(last);

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        title="이 주문의 스캔과 치식을 PC 의 exocad 로 보냅니다"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#C9BFF5] bg-[#F5F2FE] px-2.5 text-[13px] font-bold text-[#6B3FD6] hover:bg-[#ECE6FA] disabled:opacity-60"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 14v3h14v-3" />
          <path d="M10 3v10" />
          <path d="M6 9l4 4 4-4" />
        </svg>
        {pending ? '여는 중…' : 'exocad 로 보내기'}
      </button>
      {error ? (
        <span className="text-[11.5px] text-[#D93025]">{error}</span>
      ) : launched ? (
        <span className="text-[11.5px] text-[#7C8595]">
          런처가 안 뜨면 PC 에 덴플로우 런처가 설치돼 있는지 확인하세요.
        </span>
      ) : summary ? (
        <span className="text-[11.5px] text-[#7C8595]">{summary}</span>
      ) : null}
    </span>
  );
}

function summarize(last: ExocadLastResult | null): string | null {
  if (!last) return null;
  const when = last.requestedAt.slice(5, 16).replace('T', ' ');
  if (last.status === 'done') return `${when} exocad 로 보냄 · 완료`;
  if (last.status === 'failed') return `${when} exocad 로 보냄 · 실패${last.message ? ` (${last.message})` : ''}`;
  if (last.fetchedAt) return `${when} exocad 로 보냄 · 런처가 받아 감`;
  return `${when} exocad 로 보냄 · 런처 응답 없음`;
}
