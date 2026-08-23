// =========================================================
// 놓을 위치: src/components/shade/WrongSector.tsx
//
// 치과 계정이 아닌 사람이 /m 에 온 경우. (2026-08-23)
//
// ★★ **왜 404 를 안 씁니까.** 설계서 §8.6 은 남의 화면을 403 이 아니라
//   404 로 가립니다 — "권한이 없다" 고 알려 주면 그 화면이 있다는 사실이
//   새어 나가니까요. 그 규칙은 **자료가 걸린 화면**을 위한 것입니다.
//
//   `/m` 은 그런 화면이 아닙니다. 우리가 대놓고 알리는 기능이고,
//   여기 있다는 사실만으로 새는 것이 하나도 없습니다.
//   반면 가린 값은 컸습니다 — 사장님이 폰으로 열었다가 404 를 보고
//   **고장인지 규칙인지 구분을 못 했습니다.** 그게 이 화면이 생긴 이유입니다.
//
// ★ 조직 이름을 적어 줍니다. "치과 계정이 아닙니다" 만으로는 자기가
//   무슨 계정으로 들어와 있는지 모릅니다.
// =========================================================

import Link from 'next/link';

export default function WrongSector({ orgName }: { orgName: string }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-[480px] place-items-center px-7">
      <div className="w-full text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4z"
              stroke="#9FB0C0"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M5 19 19 6" stroke="#9FB0C0" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>

        <h1 className="mt-5 text-[21px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">
          치과 계정으로 들어와야 합니다
        </h1>

        <p className="mt-3 text-[14px] leading-[1.7] text-[var(--muted)]">
          이 화면은 진료실에서 쉐이드 사진을 찍는 곳이라
          <br />
          <b className="text-[var(--ink)]">치과 계정</b>만 씁니다.
          {orgName && (
            <>
              <br />
              지금은 <b className="text-[var(--ink)]">{orgName}</b> 계정으로 로그인되어 있습니다.
            </>
          )}
        </p>

        <div className="mt-8 space-y-2.5">
          {/*
            ★ 이 버튼이 진짜로 로그인 칸을 내주려면 switch 가 있어야
              합니다. 없으면 이미 로그인한 사람은 제 홈으로 되튕깁니다.
            ★ next 로 여기를 적어 둡니다 — 치과 계정으로 들어오면
              데스크톱 홈이 아니라 **촬영 화면**으로 바로 옵니다.
          */}
          <Link
            href="/login?switch=1&next=%2Fm"
            className="block rounded-xl bg-[var(--ink)] py-3.5 text-[15px] font-bold text-white"
          >
            치과 계정으로 로그인
          </Link>

          <Link
            href="/"
            className="block rounded-xl border border-[var(--line)] bg-white py-3.5 text-[15px] font-bold text-[var(--muted)]"
          >
            내 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
