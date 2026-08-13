import type { Metadata } from "next";
import "./globals.css";
import EnvBadge from "@/components/layout/EnvBadge";

/*
  ★ 웹폰트를 안 씁니다 (2026-08-13 — 화면이 느리다는 지적을 재 보고).

    create-next-app 이 넣은 Geist·Geist Mono 가 **모든 화면에서 preload**
    되고 있었는데, 정작 어디에도 안 붙어 있었습니다.
    globals.css 의 `--font-sans: var(--font-sans)` 가 **자기 자신을 가리켜**
    값이 비었고, 그래서 브라우저 기본 글꼴이 그려지고 있었습니다.
    로그인 화면에서 잰 결과 woff2 두 개가 첫 그림을 붙잡고 있었습니다.

    빼도 **보이는 것은 그대로입니다** — 원래 안 쓰이던 글꼴입니다.
    대신 `--font-sans`·`--font-mono` 에 내려받을 것이 없는 시스템 글꼴을
    적어 두었습니다(globals.css). 로그인·가입 화면은 예전부터 자기
    글꼴 목록을 따로 갖고 있어 영향이 없습니다.

  ★ 청구서의 나눔고딕은 그대로입니다 (lib/fonts).
    거기는 인쇄물이라 기계마다 달라지면 안 됩니다.
*/

export const metadata: Metadata = {
  title: "DenFlow",
  description: "치과 · 디자인센터 · 기공소를 잇는 보철 주문 플랫폼",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      {/*
        ★ body 를 flex 로 두면 안 됩니다.
          create-next-app 이 남긴 `flex flex-col` 인데, 이 안의 페이지는
          **fit-content** 로 크기가 잡힙니다. 그래서 치식도처럼 넓은 것이
          하나만 있어도 **페이지 전체가 창보다 넓어집니다.**
          그러면 상단바·사이드바는 `fixed` 라 창에 붙어 있는데 본문만
          옆으로 밀려 — 오른쪽으로 스크롤하면 머리가 잘린 화면이 됩니다.
          블록으로 두면 페이지는 창 폭에 맞고, 넓은 것은 제자리에서
          가로로 스크롤합니다. 여기에 기대는 화면은 없습니다.
      */}
      <body className="min-h-full">
        {/* 시험 환경에서만 보이는 띠. 운영에서는 아무것도 안 그립니다 */}
        <EnvBadge />
        {children}
      </body>
    </html>
  );
}
