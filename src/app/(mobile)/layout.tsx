// =========================================================
// 놓을 위치: src/app/(mobile)/layout.tsx
//
// 진료실 폰 전용 껍데기. (명세서 SPEC_shade-photo)
//
// ★★ **데스크톱 껍데기(SectorShell)를 안 씁니다.**
//   거긴 사이드바 200px 와 상단바가 있습니다. 진료실에서 한 손으로
//   드는 폰에서는 그 자리가 곧 화면의 절반입니다.
//   여기는 껍데기가 없습니다 — 화면 하나가 곧 전부입니다.
//
// ★ 치과만 들어옵니다. 센터·기공소가 주소를 쳐도 404 입니다
//   (403 이 아닌 이유는 설계서 §8.6 — 있다는 사실도 안 알립니다).
//
// ★ 로그인은 **지금 계정 그대로** 씁니다 (사용자 결정 2026-08-21).
//   명세의 '공용계정 + PIN' 을 안 만든 이유 — 인증을 하나 더 두면
//   기존 권한 규칙과 섞이는 자리가 생깁니다. 누가 올렸는지도
//   지금처럼 기록에 남습니다.
// =========================================================

import type { Metadata, Viewport } from 'next';
import { requireSector } from '@/server/policies/session';
import PwaSetup from '@/components/shade/PwaSetup';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '쉐이드 촬영',
  /*
    ★ 아이폰은 매니페스트를 잘 안 봅니다. 이 값들이 있어야 '홈 화면에
      추가' 로 얹었을 때 주소창 없이 앱처럼 열립니다.
  */
  appleWebApp: { capable: true, title: '덴플로우', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#16324F',
  /*
    ★★ **확대를 막지 않습니다.** 폰 화면을 못 키우게 하면 눈이 어두운
      분들이 못 씁니다. 진료실에는 여러 사람이 씁니다.

    ★ `viewportFit: cover` — 노치 있는 폰에서 아래 버튼이 홈바에
      가리지 않게 합니다.
  */
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requireSector('clinic');

  return (
    <div
      className="min-h-screen bg-[#F4F7FA]"
      style={
        {
          // 시안의 브랜드 토큰 (CLAUDE.md 브랜드 규칙)
          '--ink': '#16324F',
          '--teal': '#14B8A6',
          '--muted': '#5B7186',
          '--line': '#E3E9EF',
          '--mist': '#EAF6F4',
        } as React.CSSProperties
      }
    >
      {children}
      <PwaSetup />
    </div>
  );
}
