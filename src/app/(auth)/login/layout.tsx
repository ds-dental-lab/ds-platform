// =========================================================
// 놓을 위치: src/app/(auth)/login/layout.tsx
//
// 로그인 화면의 제목만 담습니다. (2026-09-04)
//
// ★ 화면이 'use client' 라 metadata 를 못 답니다. 그래서 얇은 레이아웃
//   하나를 둡니다 — 그리는 것은 아무것도 없습니다 (signup 과 같은 이유).
//
// ★★ 이걸 만든 이유 — 로그인 화면이 뿌리 레이아웃의 제목·설명을
//   **글자 하나까지** 그대로 물려받고 있었습니다. 홈페이지와 똑같은
//   글이 두 주소에 있으면 검색엔진은 둘 중 하나만 고르는데, 가입
//   화면이 그렇게 홈페이지를 밀어낸 적이 있습니다(signup/layout 참조).
//   로그인이 다음 차례가 되기 전에 제 이름을 달아 둡니다.
//   색인 금지는 (auth)/layout 이 겁니다.
// =========================================================

import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 뿌리 레이아웃의 틀이 붙어 "로그인 · 덴플로우 디지털 기공소" 가 됩니다
  title: '로그인',
  description: '덴플로우 거래처 로그인.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
