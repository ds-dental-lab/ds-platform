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

  const pill = pillOf(launched, last);

  /*
    ★ 한 줄짜리 단추 (사용자 지적 2026-09-10 — "열도 안 맞고 이뻐 보이지 않는다").
      전에는 단추 아래 안내 글이 한 줄 더 붙어 머리줄 높이가 흔들렸습니다. 이제 단추는
      기공의뢰서와 같은 키(h-8)·모양이고, 상태는 오른쪽의 작은 알약 하나로만 보입니다.
      긴 설명은 마우스를 올리면 나오는 title 에 둡니다.
  */
  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={url ?? undefined}
        onClick={url ? onClick : undefined}
        aria-disabled={!url}
        title={
          error ??
          (url
            ? 'PC 의 덴플로우 런처가 열리며 스캔·치식을 exocad 케이스로 만듭니다. 처음엔 브라우저가 "열까요?" 를 묻습니다.'
            : '준비 중…')
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#D9CFF8] bg-[#F7F4FF] px-2.5 text-[13px] font-bold text-[#6B3FD6] hover:bg-[#EFE9FD] aria-disabled:pointer-events-none aria-disabled:opacity-50"
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
          <path d="M10 2.5l6.5 3.75v7.5L10 17.5l-6.5-3.75v-7.5z" />
          <path d="M10 10l6.5-3.75M10 10L3.5 6.25M10 10v7.5" />
        </svg>
        exocad
      </a>
      {pill}
    </span>
  );
}

/** 오른쪽 작은 알약 — 마지막 보낸 결과. 없으면 아무것도 안 그립니다 */
function pillOf(launched: boolean, last: ExocadLastResult | null): React.ReactNode {
  if (launched) return <Pill tone="wait" title="런처가 여는 중입니다. 안 뜨면 PC 에 덴플로우 런처가 설치돼 있는지 확인하세요">여는 중</Pill>;
  if (!last) return null;
  const when = last.requestedAt.slice(11, 16);
  if (last.status === 'done') return <Pill tone="ok" title={`${last.requestedAt.slice(5, 16).replace('T', ' ')} exocad 로 보냄 · 완료`}>✓ {when}</Pill>;
  if (last.status === 'failed') return <Pill tone="bad" title={`${when} 실패${last.message ? `: ${last.message}` : ''}`}>! {when}</Pill>;
  if (last.fetchedAt) return <Pill tone="wait" title={`${when} 런처가 받아 감 · 아직 결과 없음`}>… {when}</Pill>;
  return <Pill tone="mute" title={`${when} 보냈지만 런처 응답이 없었습니다`}>– {when}</Pill>;
}

function Pill({ tone, title, children }: { tone: 'ok' | 'bad' | 'wait' | 'mute'; title: string; children: React.ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'bg-[#E6F6EC] text-[#1A7F37]'
      : tone === 'bad'
        ? 'bg-[#FDE7E7] text-[#C4383A]'
        : tone === 'wait'
          ? 'bg-[#F7F4FF] text-[#6B3FD6]'
          : 'bg-[#EEF1F5] text-[#7C8595]';
  return (
    <span title={title} className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold tabular-nums ${cls}`}>
      {children}
    </span>
  );
}
