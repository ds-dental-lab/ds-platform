// =========================================================
// 놓을 위치: src/app/not-found.tsx
//
// 못 찾은 화면. (사용자 요청 2026-08-13 —
//   "이문제가 로그인 문제라면 로그인창으로 출구를 만들어줘")
//
// ★ 지금까지는 Next 기본 404 였습니다.
//   글자 두 줄에 링크 하나 없는 화면이라, 거기 떨어지면 **주소창을
//   고치는 것 말고는 나갈 길이 없었습니다.**
//
// ★ 여기 떨어지는 가장 흔한 이유는 '없는 주소' 가 아닙니다.
//   requireSector 가 **다른 섹터 계정**을 이 화면으로 보냅니다
//   (설계서 §8.6 — 403 이 아니라 404 인 이유: "권한이 없다" 고
//   알려 주면 그 화면이 있다는 사실이 새어 나갑니다).
//   그래서 디자인센터 계정으로 /clinic/... 을 열면 여기로 옵니다.
//   실제로 사장님이 그렇게 막혔습니다.
//
// ★ 그렇다고 "계정이 달라서입니다" 라고 단정하지 않습니다.
//   진짜로 없는 주소일 수도 있습니다. **둘 다 짚어 주고 길을 둘 다**
//   냅니다 — 어느 쪽이든 여기서 빠져나갈 수 있습니다.
//
// ★ 세션을 읽지 않습니다.
//   이 화면은 안 걸린 주소에도 쓰이므로, 여기서 쿠키를 읽으면 정적으로
//   만들 수 있는 화면까지 매번 서버를 타게 됩니다. 문구로 대신합니다.
// =========================================================

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F4F6F9] px-6">
      <div className="w-full max-w-[460px] rounded-[12px] border border-[#E8EBF0] bg-white px-7 py-9 text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#F4F6F9] text-[#98A2B3]"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5 21 21" />
          </svg>
        </span>

        <h1 className="mt-5 text-[18px] font-bold tracking-tight text-[#1A2130]">
          화면을 찾지 못했습니다
        </h1>

        <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#4A5567]">
          주소가 바뀌었거나, <b className="font-bold text-[#1A2130]">지금 로그인한 계정으로는
          볼 수 없는 화면</b>일 수 있습니다.
          <br />
          치과 · 디자인센터 · 기공소는 서로의 화면에 들어갈 수 없습니다.
        </p>

        <div className="mt-7 flex flex-col gap-2">
          <Link
            href="/"
            className="grid h-[42px] place-items-center rounded-[8px] bg-[#1279E8] text-[13.5px] font-bold text-white hover:bg-[#1554C8]"
          >
            내 홈으로
          </Link>

          {/* ★ 사장님이 부탁한 출구 — 계정이 달라서 막힌 경우입니다 */}
          <Link
            href="/login"
            className="grid h-[42px] place-items-center rounded-[8px] border border-[#DDE2EA] bg-white text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
          >
            다른 계정으로 로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
