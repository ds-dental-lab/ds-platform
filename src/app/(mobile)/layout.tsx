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
// ★ 치과만 들어옵니다. 센터·기공소는 못 씁니다.
//
// ★★ 다만 **404 로 가리지 않습니다** (2026-08-23). 설계서 §8.6 의
//   404 규칙은 자료가 걸린 화면을 위한 것이고, /m 은 그런 화면이
//   아닙니다. 가렸더니 사장님이 폰에서 그 화면을 보고 **고장인지
//   규칙인지 구분을 못 했습니다** — 가려서 지킨 것은 없고 잃은 것만
//   있었습니다. 이제 무슨 계정인지 적어 주고 나갈 길을 냅니다.
//
// ★ 로그인은 **지금 계정 그대로** 씁니다 (사용자 결정 2026-08-21).
//   명세의 '공용계정 + PIN' 을 안 만든 이유 — 인증을 하나 더 두면
//   기존 권한 규칙과 섞이는 자리가 생깁니다. 누가 올렸는지도
//   지금처럼 기록에 남습니다.
// =========================================================

import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/policies/session';
import PwaSetup from '@/components/shade/PwaSetup';
import WrongSector from '@/components/shade/WrongSector';

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
  const session = await getSession();

  /*
    ★★ 로그인 뒤에 **여기로 돌아옵니다** (next=/m).
      전에는 그냥 /login 이라 로그인하면 데스크톱 홈으로 떨어졌습니다.
      환자가 입을 벌리고 있는데 다시 찾아 들어가야 했습니다.
  */
  if (!session) redirect('/login?next=%2Fm');

  const wrongSector = session.orgType !== 'clinic';

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
      {wrongSector ? <WrongSector orgName={session.orgName ?? ''} /> : children}
      {!wrongSector && <PwaSetup />}
    </div>
  );
}
