import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Den Flow",
  description: "치과 · 디자인센터 · 기공소를 잇는 보철 주문 플랫폼",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
