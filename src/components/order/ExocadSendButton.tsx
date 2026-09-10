// =========================================================
// 놓을 위치: src/components/order/ExocadSendButton.tsx
//
// "exocad 로 보내기" 버튼. (2026-09-09, 설계서 exocad-연동-설계서.md v2)
//
// ★ 주소는 화면이 뜰 때 **미리** 받아 둡니다 (2026-09-10 고침). Chrome 은
//   바깥 프로토콜(denflow://)을 클릭 그 순간에만 열어 주고, 서버를 갔다 오면
//   그 순간이 지나 **아무 말 없이** 막습니다 — 첫 실전에서 그렇게 안 떴습니다.
//   클릭에서는 받아 둔 주소로 바로 가고, 기록은 그 뒤에 남깁니다.
//   토큰은 10분 살므로 8분마다 새로 받습니다.
//   브라우저는 프로토콜 처리기가 없으면 **아무 말 없이 아무 일도 안 하므로**
//   버튼 아래에 "안 뜨면 런처 설치" 를 같이 보여 줍니다.
// ★ 창을 새로 열지 않습니다 — 보던 주문 화면이 그대로입니다.
// ★ 마지막 결과가 있으면 버튼 옆에 짧게 — 런처가 안 뜬 것을 사람이 알게.
// =========================================================

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { issueExocadLaunch, recordExocadSend, requestExocadLaunch } from '@/server/actions/exocad';

/** 토큰(10분)보다 짧게 — 눌렀을 때 항상 살아 있는 주소를 쥐고 있게 */
const REFRESH_MS = 8 * 60 * 1000;

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
  const ready = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchUrl = async () => {
      const r = await issueExocadLaunch(orderId);
      if (alive && r.ok) ready.current = r.url;
    };
    void fetchUrl();
    const timer = setInterval(fetchUrl, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [orderId]);

  function send() {
    setError(null);
    const url = ready.current;
    if (url) {
      // ★ 클릭과 같은 순간에 — 서버를 기다리면 브라우저가 막습니다
      window.location.href = url;
      setLaunched(true);
      ready.current = null;
      start(async () => {
        await recordExocadSend(orderId);
        const again = await issueExocadLaunch(orderId);
        if (again.ok) ready.current = again.url;
      });
      return;
    }
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
