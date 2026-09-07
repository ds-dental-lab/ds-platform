// =========================================================
// 놓을 위치: src/app/(dev)/playground/center-home/page.tsx
//
// 센터 폰 홈을 로그인 없이 눈으로 보는 시연 화면. (2026-09-07)
//
// ★ 폰 껍데기((mobile)/layout)의 브랜드 토큰을 같은 값으로 깔아야
//   색이 맞습니다 — 여기 없으면 var(--ink) 가 비어 글자가 검게 뜹니다.
// ★ 개발에서만 열립니다 ((dev)/layout 이 운영에서 404).
// =========================================================

import CenterHome from '@/components/center/CenterHome';

export const dynamic = 'force-dynamic';

export default async function CenterHomePlayground({
  searchParams,
}: {
  searchParams: Promise<{ manager?: string; chats?: string }>;
}) {
  const q = await searchParams;
  const manager = q.manager !== '0';
  const chats = Number(q.chats ?? '2') || 0;

  return (
    <div
      className="min-h-screen bg-[#F4F7FA]"
      style={
        {
          '--ink': '#16324F',
          '--teal': '#14B8A6',
          '--muted': '#5B7186',
          '--line': '#E3E9EF',
          '--mist': '#EAF6F4',
        } as React.CSSProperties
      }
    >
      <CenterHome
        orgName="덴플로우 디지털 기공소"
        counts={{ contacts: 1, signups: 0, chats }}
        manager={manager}
        pushKey={process.env.VAPID_PUBLIC_KEY ?? null}
      />
    </div>
  );
}
