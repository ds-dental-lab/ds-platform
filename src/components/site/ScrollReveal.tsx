// =========================================================
// 놓을 위치: src/components/site/ScrollReveal.tsx
//
// 스크롤을 내리면 글이 아래에서 올라오는 효과.
// (사용자 요청 2026-08-18 — zircarlab 홈페이지처럼)
//
// ★ **글을 감추는 일**이라 조심할 것이 셋입니다.
//
//   ① 자바스크립트가 안 돌면 **그냥 다 보입니다.**
//      감추는 CSS 가 `@media (scripting: enabled)` 안에만 있습니다
//      (globals.css). 무조건 감춰 두면, JS 가 한 번 실패할 때
//      홈페이지가 백지가 됩니다 — 검색엔진에게도요.
//
//   ② **관찰자를 하나만** 씁니다.
//      조각마다 하나씩 만들면 스무 개가 넘습니다. 한 개로 모두 보고,
//      다 나타나면 스스로 끊습니다.
//
//   ③ **움직임을 싫어하는 분**께는 안 움직입니다.
//      `prefers-reduced-motion` 은 취향이 아니라 접근성입니다 —
//      멀미나 전정기관 문제로 이 설정을 켜 두는 분들이 있습니다.
//      그때는 애니메이션 없이 처음부터 보입니다(globals.css).
//
// ★ 한 번 나타나면 되돌아가지 않습니다.
//   위로 다시 스크롤할 때 사라졌다 나타나면, 읽던 사람이 글을 잃습니다.
// =========================================================

'use client';

import { useEffect } from 'react';

/** 화면 아래에서 이만큼 들어와야 나타납니다 (px) */
const ENTER_MARGIN = 60;

/** 이때까지 하나도 안 나타났으면 관찰자가 죽은 것으로 봅니다 */
const FAILSAFE_MS = 3000;

export default function ScrollReveal() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (targets.length === 0) return;

    /*
      ★ 관찰자를 못 만드는 브라우저면 전부 보여 주고 끝냅니다.
        효과보다 글이 먼저입니다.
    */
    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.setAttribute('data-shown', ''));
      return;
    }

    let left = targets.length;

    /*
      ★ 마지막 안전장치 — **관찰자가 한 번도 안 불렸을 때만** 입니다.
        효과 하나 때문에 홈페이지가 비면 안 되니 남은 것을 다 보여 주는데,
        조건 없이 시간만 보고 열어 버리면 **효과가 사라집니다.**
        처음 화면을 4초만 보고 있어도 아래 글이 전부 미리 나타나서,
        내려가 봐야 이미 다 떠 있습니다. 실제로 그렇게 만들었다가 고쳤습니다.

        그래서 '한 번이라도 나타난 것이 있는가' 로 가릅니다 —
        하나라도 나타났으면 관찰자가 도는 것이니 맡기고, 하나도
        없으면 관찰자가 죽은 것이니 전부 보여 줍니다.
    */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          entry.target.setAttribute('data-shown', '');
          worked = true;
          observer.unobserve(entry.target);
          left -= 1;
        }

        // 다 나타났으면 더 볼 것이 없습니다
        if (left <= 0) {
          observer.disconnect();
          window.clearTimeout(failsafe);
        }
      },
      { rootMargin: `0px 0px -${ENTER_MARGIN}px 0px`, threshold: 0.05 },
    );

    let worked = false;

    const failsafe = window.setTimeout(() => {
      if (worked) return;

      targets.forEach((el) => el.setAttribute('data-shown', ''));
      observer.disconnect();
    }, FAILSAFE_MS);

    targets.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return null;
}
