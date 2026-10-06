// =========================================================
// 놓을 위치: src/components/order/AutoPrintSendButton.tsx
//
// "자동 출력 보내기" 버튼 — 센터에서 누릅니다 (사용자 요청 2026-10-06).
//
// 덴트버드에서 내려받은 크라운 STL 을 고르면, 기공소 PC 가 돌려서 자르고
// 주문에 올린 뒤 '출력 대기' 로 넘깁니다. 그 뒤는 치과가 출력판을 비우면
// 저절로 갑니다.
//
// ★ 주소는 화면이 뜰 때 **미리** 받아 둡니다. Chrome 은 바깥
//   프로토콜(denflow://)을 **클릭 그 순간**에만 열어 주고, 서버를 갔다 오면
//   그 순간이 지나 **아무 말 없이** 막습니다 — exocad 보내기가 첫 실전에서
//   그렇게 안 떴습니다 (2026-09-10). 토큰이 10분이라 8분마다 새로 받습니다.
//
// ★ 브라우저는 처리기가 없으면 **아무 말 없이 아무 일도 안 합니다.**
//   그래서 버튼 아래에 "안 뜨면" 한 줄을 같이 둡니다.
//
// ★ 창을 새로 열지 않습니다 — 보던 주문 화면이 그대로입니다.
// =========================================================

'use client';

import { useEffect, useState } from 'react';
import { issueAutoPrintLaunch } from '@/server/actions/auto-print';

/** 토큰(10분)보다 짧게 — 눌렀을 때 늘 살아 있는 주소를 쥐고 있게 */
const REFRESH_MS = 8 * 60 * 1000;

export default function AutoPrintSendButton({ orderId }: { orderId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    let alive = true;

    const fetchUrl = async () => {
      const got = await issueAutoPrintLaunch(orderId);
      if (!alive) return;
      if (got.ok) setUrl(got.url);
      else setError(got.error);
    };

    void fetchUrl();
    const timer = setInterval(fetchUrl, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [orderId]);

  const press = () => {
    if (!url) return;
    setLaunched(true);
    window.location.href = url;
  };

  return (
    <div>
      <button
        type="button"
        onClick={press}
        disabled={!url}
        className="rounded-lg border border-[#CFE3FB] bg-[#F2F7FE] px-3 py-1.5 text-[12.5px] font-bold text-[#1279E8] disabled:opacity-50"
      >
        자동 출력 보내기
      </button>

      {launched ? (
        <p className="mt-1.5 text-[11.5px] text-[#7C8595]">
          기공소 PC 에서 STL 을 고르면 이어집니다.
        </p>
      ) : (
        <p className="mt-1.5 text-[11.5px] text-[#98A2B3]">
          안 뜨면 이 PC 에 런처가 깔려 있는지 봐 주세요.
        </p>
      )}

      {error ? <p className="mt-1 text-[11.5px] text-[#D64545]">{error}</p> : null}
    </div>
  );
}
