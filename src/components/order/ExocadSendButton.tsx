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

import { useEffect, useState, useTransition } from 'react';
import { issueExocadLaunch, recordExocadSend } from '@/server/actions/exocad';

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
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchUrl = async () => {
      const r = await issueExocadLaunch(orderId);
      if (!alive) return;
      if (r.ok) setUrl(r.url);
      else setError(r.error);
    };
    void fetchUrl();
    const timer = setInterval(fetchUrl, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [orderId]);

  /*
    ★ 진짜 <a href="denflow://…"> 입니다 (2026-09-10 두 번째 고침).
      location.href 로 가는 것도 Chrome 이 막았습니다. 링크를 사람이 직접
      누르는 것은 브라우저가 가장 확실하게 "사용자가 원했다" 로 치는 길이라
      바깥 프로그램을 열어 줍니다 (처음 한 번은 "열까요?" 를 묻습니다).
      주소는 미리 받아 두고, 누른 뒤에 기록만 남깁니다.
  */
  function onClick() {
    setLaunched(true);
    start(async () => {
      await recordExocadSend(orderId);
      const again = await issueExocadLaunch(orderId);
      if (again.ok) setUrl(again.url);
    });
  }

  const summary = summarize(last);

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <a
        href={url ?? undefined}
        onClick={url ? onClick : undefined}
        aria-disabled={!url}
        title="이 주문의 스캔과 치식을 PC 의 exocad 로 보냅니다"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#C9BFF5] bg-[#F5F2FE] px-2.5 text-[13px] font-bold text-[#6B3FD6] hover:bg-[#ECE6FA] aria-disabled:opacity-60"
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
        {url ? 'exocad 로 보내기' : '준비 중…'}
      </a>
      {error ? (
        <span className="text-[11.5px] text-[#D93025]">{error}</span>
      ) : launched ? (
        <span className="text-[11.5px] text-[#7C8595]">
          브라우저가 &ldquo;열까요?&rdquo; 를 물으면 열기를 누르세요. 안 뜨면 PC 에 덴플로우 런처가 설치돼 있는지 확인하세요.
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
